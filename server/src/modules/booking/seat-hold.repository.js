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

const isDuplicateKey = (error) => error?.code === 11000;

const toPlainObject = (document) =>
  typeof document?.toObject === "function" ? document.toObject() : document;

export const createSeatHoldRepository = ({
  seatHoldModel = SeatHold,
  showtimeSeatModel = ShowtimeSeat,
  connection = mongoose.connection,
} = {}) => {
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
        $unset: { holdId: "", holdOwnerId: "", holdExpiresAt: "", priceSnapshot: "" },
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
            $unset: { holdId: "", holdOwnerId: "", holdExpiresAt: "", priceSnapshot: "" },
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

  return { acquire, findByOwnerAndCheckoutKey, release };
};

export const seatHoldRepository = createSeatHoldRepository();

