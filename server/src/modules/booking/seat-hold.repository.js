import mongoose from "mongoose";
import { SeatHold } from "./seat-hold.model.js";
import { ShowtimeSeat } from "./showtime-seat.model.js";
import { SEAT_HOLD_STATUS, SHOWTIME_SEAT_STATE } from "./seat-hold.constants.js";

export class SeatClaimConflictError extends Error {
  constructor() {
    super("One or more seats are unavailable");
    this.name = "SeatClaimConflictError";
  }
}

export class ShowtimeSeatInitializationConflictError extends Error {
  constructor() {
    super("Showtime seats were already initialized from a different layout snapshot");
    this.name = "ShowtimeSeatInitializationConflictError";
  }
}

const isDuplicateKey = (error) => error?.code === 11000;

const toPlainObject = (document) =>
  typeof document?.toObject === "function" ? document.toObject() : document;

export const createSeatHoldRepository = ({
  seatHoldModel = SeatHold,
  showtimeSeatModel = ShowtimeSeat,
  connection = mongoose.connection,
} = {}) => {
  const listByShowtime = (showtimeId, session) =>
    showtimeSeatModel.find({ showtimeId }).session(session ?? null).lean().exec();

  const deleteUnpublishedShowtimeSeats = (showtimeId) =>
    showtimeSeatModel.deleteMany({ showtimeId }).exec();

  const hasActiveShowtimeClaims = async (showtimeId, now = new Date()) => {
    const [claimedSeat, activeHold] = await Promise.all([
      showtimeSeatModel.exists({
        showtimeId,
        $or: [
          { state: SHOWTIME_SEAT_STATE.SOLD },
          { state: SHOWTIME_SEAT_STATE.HELD, holdExpiresAt: { $gt: now } },
        ],
      }),
      seatHoldModel.exists({ showtimeId, status: SEAT_HOLD_STATUS.ACTIVE, expiresAt: { $gt: now } }),
    ]);
    return Boolean(claimedSeat || activeHold);
  };

  const initializeShowtimeSeats = async ({ showtimeId, roomLayoutVersion, seats }) => {
    const session = await connection.startSession();
    let result;

    try {
      await session.withTransaction(async () => {
        const existing = await listByShowtime(showtimeId, session);
        const expectedSeatIds = new Set(seats.map(({ seatId }) => seatId.toString()));
        const hasDifferentSnapshot = existing.some(
          ({ seatId, roomLayoutVersion: storedVersion }) =>
            storedVersion !== roomLayoutVersion || !expectedSeatIds.has(seatId.toString()),
        );
        if (hasDifferentSnapshot || existing.length > seats.length) {
          throw new ShowtimeSeatInitializationConflictError();
        }

        if (existing.length < seats.length) {
          await showtimeSeatModel.bulkWrite(
            seats.map(({ seatId, state }) => ({
              updateOne: {
                filter: { showtimeId, seatId },
                update: {
                  $setOnInsert: { showtimeId, seatId, roomLayoutVersion, state },
                },
                upsert: true,
              },
            })),
            { ordered: false, session },
          );
        }

        const initialized = await listByShowtime(showtimeId, session);
        if (
          initialized.length !== seats.length ||
          initialized.some(
            ({ seatId, roomLayoutVersion: storedVersion }) =>
              storedVersion !== roomLayoutVersion || !expectedSeatIds.has(seatId.toString()),
          )
        ) {
          throw new ShowtimeSeatInitializationConflictError();
        }
        result = initialized;
      });
      return result;
    } catch (error) {
      if (isDuplicateKey(error)) throw new ShowtimeSeatInitializationConflictError();
      throw error;
    } finally {
      await session.endSession();
    }
  };

  const findByOwnerAndCheckoutKey = (ownerId, checkoutKey, session) =>
    seatHoldModel.findOne({ ownerId, checkoutKey }).session(session ?? null).lean().exec();

  const expireConflictingHolds = async ({ showtimeId, seatIds, now, session }) => {
    const expiredClaims = await showtimeSeatModel
      .find({
        showtimeId,
        seatId: { $in: seatIds },
        state: SHOWTIME_SEAT_STATE.HELD,
        holdExpiresAt: { $lte: now },
      })
      .select({ holdId: 1 })
      .session(session)
      .lean()
      .exec();

    const holdIds = [...new Set(expiredClaims.map(({ holdId }) => holdId?.toString()).filter(Boolean))];
    if (holdIds.length === 0) return;

    await showtimeSeatModel.updateMany(
      { holdId: { $in: holdIds }, state: SHOWTIME_SEAT_STATE.HELD },
      {
        $set: { state: SHOWTIME_SEAT_STATE.AVAILABLE },
        $unset: { holdId: "", holdOwnerId: "", holdExpiresAt: "" },
      },
      { session },
    );
    await seatHoldModel.updateMany(
      { _id: { $in: holdIds }, status: SEAT_HOLD_STATUS.ACTIVE, expiresAt: { $lte: now } },
      { $set: { status: SEAT_HOLD_STATUS.EXPIRED } },
      { session },
    );
  };

  const claimSeat = async ({ hold, seatId, unitPrice, session }) => {
    const key = { showtimeId: hold.showtimeId, seatId };
    const result = await showtimeSeatModel.updateOne(
      { ...key, state: SHOWTIME_SEAT_STATE.AVAILABLE },
      {
        $set: {
          roomLayoutVersion: hold.roomLayoutVersion,
          state: SHOWTIME_SEAT_STATE.HELD,
          holdId: hold._id,
          holdOwnerId: hold.ownerId,
          holdExpiresAt: hold.expiresAt,
          priceSnapshot: unitPrice,
        },
      },
      { session, runValidators: true },
    );

    if (result.matchedCount === 1) return;

    try {
      await showtimeSeatModel.create(
        [{
          ...key,
          roomLayoutVersion: hold.roomLayoutVersion,
          state: SHOWTIME_SEAT_STATE.HELD,
          holdId: hold._id,
          holdOwnerId: hold.ownerId,
          holdExpiresAt: hold.expiresAt,
          priceSnapshot: unitPrice,
        }],
        { session },
      );
    } catch (error) {
      if (isDuplicateKey(error)) throw new SeatClaimConflictError();
      throw error;
    }
  };

  const acquire = async (holdInput) => {
    const session = await connection.startSession();
    let result;

    try {
      await session.withTransaction(async () => {
        const existing = await findByOwnerAndCheckoutKey(
          holdInput.ownerId,
          holdInput.checkoutKey,
          session,
        );
        if (existing) {
          result = { hold: existing, created: false };
          return;
        }

        const holdId = new mongoose.Types.ObjectId();
        const hold = { ...holdInput, _id: holdId, status: SEAT_HOLD_STATUS.ACTIVE };
        await expireConflictingHolds({
          showtimeId: hold.showtimeId,
          seatIds: hold.seatIds,
          now: hold.heldAt,
          session,
        });

        const priceBySeat = new Map(
          hold.priceSnapshot.lines.map(({ seatId, unitPrice }) => [seatId.toString(), unitPrice]),
        );
        for (const seatId of hold.seatIds) {
          await claimSeat({
            hold,
            seatId,
            unitPrice: priceBySeat.get(seatId.toString()),
            session,
          });
        }

        const [created] = await seatHoldModel.create([hold], { session });
        result = { hold: toPlainObject(created), created: true };
      });
      return result;
    } catch (error) {
      if (isDuplicateKey(error)) {
        const existing = await findByOwnerAndCheckoutKey(
          holdInput.ownerId,
          holdInput.checkoutKey,
        );
        if (existing) return { hold: existing, created: false };
        throw new SeatClaimConflictError();
      }
      throw error;
    } finally {
      await session.endSession();
    }
  };

  const release = async ({ holdId, ownerId, now }) => {
    const session = await connection.startSession();
    let result;

    try {
      await session.withTransaction(async () => {
        const hold = await seatHoldModel.findById(holdId).session(session).lean().exec();
        if (!hold) {
          result = { outcome: "NOT_FOUND" };
          return;
        }
        if (hold.ownerId.toString() !== ownerId.toString()) {
          result = { outcome: "FORBIDDEN" };
          return;
        }
        if (hold.status !== SEAT_HOLD_STATUS.ACTIVE) {
          result = { outcome: "FINAL", hold };
          return;
        }

        const status = hold.expiresAt <= now ? SEAT_HOLD_STATUS.EXPIRED : SEAT_HOLD_STATUS.RELEASED;
        await showtimeSeatModel.updateMany(
          { holdId: hold._id, state: SHOWTIME_SEAT_STATE.HELD },
          {
            $set: { state: SHOWTIME_SEAT_STATE.AVAILABLE },
            $unset: { holdId: "", holdOwnerId: "", holdExpiresAt: "" },
          },
          { session },
        );
        const updated = await seatHoldModel
          .findOneAndUpdate(
            { _id: hold._id, status: SEAT_HOLD_STATUS.ACTIVE },
            {
              $set: {
                status,
                ...(status === SEAT_HOLD_STATUS.RELEASED ? { releasedAt: now } : {}),
              },
            },
            { new: true, session },
          )
          .lean()
          .exec();
        result = { outcome: "RELEASED", hold: updated };
      });
      return result;
    } finally {
      await session.endSession();
    }
  };

  return {
    acquire,
    deleteUnpublishedShowtimeSeats,
    findByOwnerAndCheckoutKey,
    hasActiveShowtimeClaims,
    initializeShowtimeSeats,
    listByShowtime,
    release,
  };
};

export const seatHoldRepository = createSeatHoldRepository();

