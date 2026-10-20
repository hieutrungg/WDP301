import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import mongoose from "mongoose";
import { configureMongoDns } from "../config/mongo-dns.js";
import { createTicketPricingService, pricePlanCodeForShowtime, TicketPricingUnavailableError } from "../modules/ticket-pricing/ticket-pricing.service.js";

class BackfillSkip extends Error {}
const skip = (reason) => { throw new BackfillSkip(reason); };

// Migration-only reads: the runtime pricing policy is reused through its exported service.
const inspect = async (database, showtimeId, now, session) => {
  const read = { session };
  const showtime = await database.collection("showtimes").findOne({ _id: showtimeId }, read);
  if (!showtime) skip("SHOWTIME_NOT_FOUND");
  const startAt = new Date(showtime.startAt ?? showtime.startTime);
  if (showtime.status !== "PUBLISHED" || !Number.isFinite(startAt.getTime()) || startAt <= now) skip("NOT_UPCOMING_PUBLISHED");
  if (showtime.ticketPricePlanId != null) skip("ALREADY_LINKED");
  for (const name of ["bookings", "seat_holds", "tickets"]) {
    if (await database.collection(name).findOne({ showtimeId }, { ...read, projection: { _id: 1 } })) skip(`HAS_${name.toUpperCase()}`);
  }
  const room = await database.collection("rooms").findOne({ _id: showtime.roomId }, read);
  if (!room || !["ACTIVE", "AVAILABLE"].includes(room.status)) skip("ROOM_UNAVAILABLE");
  const branch = await database.collection("branches").findOne({ _id: room.branchId }, read);
  const movie = await database.collection("movies").findOne({ _id: showtime.movieId }, read);
  if (branch?.status !== "ACTIVE" || movie?.status !== "PUBLISHED") skip("INACTIVE_REFERENCE");
  let layout = room;
  if (room.layoutVersion !== showtime.roomLayoutVersion) {
    layout = await database.collection("room_layout_versions").findOne({ roomId: showtime.roomId, layoutVersion: showtime.roomLayoutVersion }, read);
  }
  if (!layout?.seats?.length) skip("LAYOUT_SNAPSHOT_MISSING");
  const layoutById = new Map(layout.seats.map((seat) => [String(seat._id ?? seat.seatId), seat]));
  if (layoutById.size !== layout.seats.length) skip("DUPLICATE_LAYOUT_SEAT");
  const rows = await database.collection("showtime_seats").find({ showtimeId }, read).toArray();
  if (rows.length !== layout.seats.length || new Set(rows.map(({ seatId }) => String(seatId))).size !== rows.length) skip("SEAT_SNAPSHOT_INCOMPLETE");
  const pricing = createTicketPricingService({
    findPlan: (filter) => database.collection("ticket_price_plans").findOne(filter, read),
  });
  let plan;
  try { plan = await pricing.resolveForShowtime({ startAt, roomType: room.roomType }); }
  catch (error) { if (error instanceof TicketPricingUnavailableError) skip("PRICING_UNAVAILABLE"); throw error; }
  const updates = rows.map((row) => {
    const seat = layoutById.get(String(row.seatId));
    if (!seat || row.roomLayoutVersion !== showtime.roomLayoutVersion) skip("LAYOUT_VERSION_MISMATCH");
    if (!["ENABLED", "DISABLED"].includes(seat.status)) skip("UNKNOWN_PHYSICAL_SEAT_STATUS");
    const expectedState = seat.status === "ENABLED" ? "AVAILABLE" : "UNAVAILABLE";
    if (row.state !== expectedState || row.holdId != null || row.bookingId != null) skip("SEAT_HAS_ACTIVITY_OR_STATE_MISMATCH");
    const price = plan.seatTypePrices[seat.type];
    if (!Number.isSafeInteger(price) || price < 0) skip("UNKNOWN_SEAT_PRICE");
    const missing = !Object.hasOwn(row, "priceSnapshot");
    // Explicit zero, different prices and invalid/null values are never overwritten.
    if (!missing && row.priceSnapshot !== price) skip("EXISTING_PRICE_DIFFERS");
    return { row, price, missing };
  });
  const missingCount = updates.filter(({ missing }) => missing).length;
  if (missingCount === 0) skip("NO_MISSING_PRICES");
  return {
    showtime, updates, plan,
    summary: {
      showtimeId: String(showtimeId), startAt: startAt.toISOString(),
      plan: pricePlanCodeForShowtime(startAt), seatCount: rows.length, missingPrices: missingCount,
    },
  };
};

export const backfillShowtimePrices = async (database, {
  apply = false, showtimeIds = [], clock = () => new Date(), startSession,
} = {}) => {
  if (apply && (!showtimeIds.length || typeof startSession !== "function")) {
    throw new BackfillSkip("Apply requires explicit Showtime IDs and a transaction session factory");
  }
  const ids = showtimeIds.length
    ? [...new Set(showtimeIds.map(String))].map((value) => new mongoose.Types.ObjectId(value))
    : (await database.collection("showtimes").find({
      status: "PUBLISHED",
      $expr: { $gt: [{ $ifNull: ["$startAt", "$startTime"] }, clock()] },
    }, { projection: { _id: 1 } }).sort({ _id: 1 }).toArray()).map(({ _id }) => _id);
  const results = [];
  for (const showtimeId of ids) {
    let session;
    try {
      if (!apply) {
        const { summary } = await inspect(database, showtimeId, clock());
        results.push({ ...summary, action: "READY" });
        continue;
      }
      session = await startSession();
      let summary;
      await session.withTransaction(async () => {
        const now = clock();
        // Reinspect inside the transaction; preview data is never trusted for writes.
        const context = await inspect(database, showtimeId, now, session);
        const { showtime, updates, plan } = context;
        const result = await database.collection("showtime_seats").bulkWrite(updates.map(({ row, price, missing }) => ({
          updateOne: {
            filter: {
              _id: row._id, showtimeId, roomLayoutVersion: showtime.roomLayoutVersion,
              state: row.state, holdId: null, bookingId: null,
              priceSnapshot: missing ? { $exists: false } : row.priceSnapshot,
            },
            // Touch every seat to conflict with a concurrent hold; only absent prices are filled.
            update: { $set: { ...(missing ? { priceSnapshot: price } : {}), updatedAt: now } },
          },
        })), { session, ordered: true });
        if (result.matchedCount !== updates.length) skip("CONCURRENT_SEAT_CHANGE");
        const updated = await database.collection("showtimes").updateOne({
          _id: showtimeId, status: "PUBLISHED", ticketPricePlanId: null,
          roomId: showtime.roomId, roomLayoutVersion: showtime.roomLayoutVersion,
          ...(showtime.startAt ? { startAt: showtime.startAt } : { startAt: { $exists: false }, startTime: showtime.startTime }),
        }, { $set: { ticketPricePlanId: plan.ticketPricePlanId, updatedAt: now } }, { session });
        if (updated.matchedCount !== 1) skip("CONCURRENT_SHOWTIME_CHANGE");
        summary = context.summary;
      });
      results.push({ ...summary, action: "UPDATED" });
    } catch (error) {
      if (!(error instanceof BackfillSkip)) throw error;
      results.push({ showtimeId: String(showtimeId), action: "SKIPPED", reason: error.message });
    } finally { if (session) await session.endSession(); }
  }
  return { database: database.databaseName, apply, results };
};

const run = async () => {
  const { values } = parseArgs({ options: {
    database: { type: "string" }, showtime: { type: "string", multiple: true, default: [] },
    apply: { type: "boolean", default: false }, "dry-run": { type: "boolean", default: false },
    json: { type: "boolean", default: false },
  } });
  if (values.apply && values["dry-run"]) throw new BackfillSkip("Choose --apply or --dry-run");
  const databaseName = values.database?.trim();
  if (!databaseName || !/^[A-Za-z0-9_-]{1,63}$/.test(databaseName)) throw new BackfillSkip("Specify an explicit --database <name>");
  if (values.showtime.some((value) => !/^[a-f\d]{24}$/i.test(value))) throw new BackfillSkip("Invalid --showtime ObjectId");
  if (values.apply && !values.showtime.length) throw new BackfillSkip("Use --showtime <id> for every reviewed target before --apply");
  if (!process.env.MONGODB_URI?.trim()) throw new BackfillSkip("MONGODB_URI is required in server/.env");
  configureMongoDns();
  const connection = mongoose.createConnection();
  try {
    await connection.openUri(process.env.MONGODB_URI, { dbName: databaseName, autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
    const report = await backfillShowtimePrices(connection.db, {
      apply: values.apply, showtimeIds: values.showtime, startSession: () => connection.startSession(),
    });
    if (values.json) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(`${databaseName}: ${values.apply ? "migration result" : "read-only Atlas preview"}`);
      console.table(report.results);
    }
  } finally { await connection.close(); }
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  run().catch((error) => {
    console.error(error instanceof BackfillSkip ? error.message : "Price backfill failed; check connectivity, permissions and transaction support. No seed was run.");
    process.exitCode = 1;
  });
}
