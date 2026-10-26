import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import { pricePlanCodeForShowtime } from "../src/modules/ticket-pricing/ticket-pricing.service.js";

const oid = () => new mongoose.Types.ObjectId();

// Only called with the runner's verified disposable database. Never uses dev seed data.
export async function fixture(db, label) {
  if (!/^fcinema_e2e_\d+_[a-f0-9]+$/.test(db.databaseName))
    throw new Error("Unsafe fixture database");
  const ids = Object.fromEntries(
    [
      "owner",
      "other",
      "role",
      "permission",
      "movie",
      "branch",
      "otherBranch",
      "room",
      "showtime",
      "category",
      "popcorn",
      "water",
      "unavailable",
      "combo",
    ].map((k) => [k, oid()]),
  );
  const seats = Array.from({ length: 6 }, (_, i) => ({
    _id: oid(),
    row: "A",
    number: i + 1,
    column: i + 1,
    type: "STANDARD",
    status: "ENABLED",
    isAccessible: false,
  }));
  const password = `E2e!${randomBytes(12).toString("hex")}`;
  const passwordHash = await bcrypt.hash(password, 10);
  const suffix = String(ids.movie).slice(-8);
  const title = `E2E ${label} ${suffix}`;
  const branchName = `E2E Cinema ${suffix}`;
  const startAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const code = pricePlanCodeForShowtime(startAt);
  await db
    .collection("ticket_price_plans")
    .updateOne(
      { code, version: 1 },
      {
        $setOnInsert: {
          code,
          version: 1,
          status: "ACTIVE",
          currency: "VND",
          seatTypePrices: {
            STANDARD: 90000,
            VIP: 110000,
            DOUBLE_LUXURY: 180000,
          },
        },
      },
      { upsert: true },
    );
  const plan = await db
    .collection("ticket_price_plans")
    .findOne({ code, version: 1 });
  await db
    .collection("permissions")
    .insertOne({ _id: ids.permission, name: "booking.create" });
  await db
    .collection("roles")
    .insertOne({
      _id: ids.role,
      name: "CUSTOMER",
      permissionIds: [ids.permission],
    });
  for (const who of ["owner", "other"]) {
    await db
      .collection("accounts")
      .insertOne({
        _id: ids[who],
        username: `${who}_${suffix}`,
        email: `${who}_${suffix}@example.invalid`,
        passwordHash,
        status: "ACTIVE",
        roleIds: [ids.role],
        directPermissionIds: [],
        profile: { fullName: "E2E Customer" },
        phone: "0901234567",
      });
  }
  await db.collection("branches").insertMany([
    {
      _id: ids.branch,
      branchName,
      address: "Test cinema",
      email: "cinema@example.invalid",
      hotline: "0901234567",
      status: "ACTIVE",
    },
    {
      _id: ids.otherBranch,
      branchName: `Other ${suffix}`,
      address: "Other test cinema",
      status: "ACTIVE",
    },
  ]);
  await db
    .collection("movies")
    .insertOne({
      _id: ids.movie,
      title,
      synopsis: "Isolated browser journey fixture.",
      genres: ["Adventure"],
      duration: 100,
      releaseDate: new Date(Date.now() - 86400000),
      releaseYear: new Date().getUTCFullYear(),
      language: "English",
      director: "E2E Director",
      ageRating: "P",
      posterUrl: "/favicon.ico",
      status: "PUBLISHED",
    });
  await db
    .collection("rooms")
    .insertOne({
      _id: ids.room,
      branchId: ids.branch,
      roomName: "E2E Room",
      roomType: "STANDARD",
      status: "AVAILABLE",
      capacity: seats.length,
      layoutVersion: 1,
      seatLayout: { rowLabels: ["A"], columnCount: 6 },
      seats,
    });
  await db
    .collection("showtimes")
    .insertOne({
      _id: ids.showtime,
      movieId: ids.movie,
      roomId: ids.room,
      startAt,
      endAt: new Date(+startAt + 115 * 60000),
      status: "PUBLISHED",
      roomLayoutVersion: 1,
      ticketPricePlanId: plan._id,
    });
  // The approved publish contract stores immutable per-showtime seat prices here.
  await db
    .collection("showtime_seats")
    .insertMany(
      seats.map((seat) => ({
        showtimeId: ids.showtime,
        seatId: seat._id,
        roomLayoutVersion: 1,
        state: "AVAILABLE",
        priceSnapshot: 90000,
      })),
    );
  await db
    .collection("concession_categories")
    .insertOne({ _id: ids.category, name: "E2E Snacks", status: "ACTIVE" });
  await db.collection("concessions").insertMany([
    {
      _id: ids.popcorn,
      categoryId: ids.category,
      name: `Popcorn ${suffix}`,
      size: "Large",
      unit: "box",
      status: "ACTIVE",
      price: 30000,
    },
    {
      _id: ids.water,
      categoryId: ids.category,
      name: `Water ${suffix}`,
      unit: "bottle",
      status: "ACTIVE",
      price: 0,
    },
    {
      _id: ids.unavailable,
      categoryId: ids.category,
      name: `Soldout ${suffix}`,
      unit: "box",
      status: "ACTIVE",
      price: 20000,
    },
  ]);
  await db.collection("combos").insertOne({
    _id: ids.combo,
    name: `Duo ${suffix}`,
    status: "ACTIVE",
    price: 50000,
    items: [
      { concessionId: ids.popcorn, quantity: 2 },
      { concessionId: ids.water, quantity: 1 },
    ],
  });
  await db.collection("inventories").insertMany(
    ["popcorn", "water", "unavailable"].flatMap((key) => [
      {
        branchId: ids.branch,
        concessionId: ids[key],
        quantity: key === "unavailable" ? 0 : 20,
        reservedQuantity: 0,
        minThreshold: 5,
      },
      {
        branchId: ids.otherBranch,
        concessionId: ids[key],
        quantity: 99,
        reservedQuantity: 0,
        minThreshold: 5,
      },
    ]),
  );
  return {
    ...ids,
    seats,
    password,
    title,
    branchName,
    startAt,
    username: `owner_${suffix}`,
    otherUsername: `other_${suffix}`,
    popcornName: `Popcorn ${suffix}`,
    waterName: `Water ${suffix}`,
    unavailableName: `Soldout ${suffix}`,
    comboName: `Duo ${suffix}`,
  };
}

// Time-boundary fixture: move only this checkout's persisted deadlines into the past.
// No product timeout change, public clock endpoint, or replacement service is involved.
export async function expireCheckout(db, holdId) {
  if (!/^fcinema_e2e_\d+_[a-f0-9]+$/.test(db.databaseName))
    throw new Error("Unsafe expiry database");
  const _id = new mongoose.Types.ObjectId(holdId);
  const expiresAt = new Date(Date.now() - 1000);
  const booking = await db.collection("bookings").findOne({ holdId: _id });
  await db.collection("seat_holds").updateOne({ _id }, { $set: { expiresAt } });
  await db
    .collection("showtime_seats")
    .updateMany({ holdId: _id }, { $set: { holdExpiresAt: expiresAt } });
  if (booking) {
    await db
      .collection("bookings")
      .updateOne({ _id: booking._id }, { $set: { expiresAt } });
    await db
      .collection("orders")
      .updateMany({ bookingId: booking._id }, { $set: { expiresAt } });
    await db
      .collection("inventory_reservations")
      .updateMany({ bookingId: booking._id }, { $set: { expiresAt } });
  }
}
