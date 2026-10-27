import mongoose from "mongoose";
import { SeatHold } from "./seat-hold.model.js";
import { ShowtimeSeat } from "./showtime-seat.model.js";
import { Booking } from "./booking.model.js";
import {
  SEAT_HOLD_STATUS,
  SHOWTIME_SEAT_STATE,
} from "./seat-hold.constants.js";

export class SeatClaimConflictError extends Error {
  constructor() {
    super("One or more seats are unavailable");
    this.name = "SeatClaimConflictError";
  }
}

export class ShowtimeSeatInitializationConflictError extends Error {
  constructor() {
    super(
      "Showtime seats were already initialized from a different layout snapshot",
    );
    this.name = "ShowtimeSeatInitializationConflictError";
  }
}

const isDuplicateKey = (error) => error?.code === 11000;

const toPlainObject = (document) =>
  typeof document?.toObject === "function" ? document.toObject() : document;

export const createSeatHoldRepository = ({
  seatHoldModel = SeatHold,
  showtimeSeatModel = ShowtimeSeat,
  bookingModel = Booking,
  connection = mongoose.connection,
} = {}) => {
  const listByShowtime = (showtimeId, session) =>
    showtimeSeatModel
      .find({ showtimeId })
      .session(session ?? null)
      .lean()
      .exec();

  const summarizeAvailabilityByShowtime = (showtimeIds, now = new Date()) =>
    showtimeSeatModel.aggregate([
      { $match: { showtimeId: { $in: showtimeIds } } },
      {
        $group: {
          _id: "$showtimeId",
          totalSeatCount: {
            $sum: { $cond: [{ $ne: ["$state", SHOWTIME_SEAT_STATE.UNAVAILABLE] }, 1, 0] },
          },
          availableSeatCount: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ["$state", SHOWTIME_SEAT_STATE.AVAILABLE] },
                    {
                      $and: [
                        { $eq: ["$state", SHOWTIME_SEAT_STATE.HELD] },
                        { $ne: [{ $ifNull: ["$holdExpiresAt", null] }, null] },
                        { $lte: ["$holdExpiresAt", now] },
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]).exec();

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
      seatHoldModel.exists({
        showtimeId,
        status: SEAT_HOLD_STATUS.ACTIVE,
        expiresAt: { $gt: now },
      }),
    ]);
    return Boolean(claimedSeat || activeHold);
  };

  const initializeShowtimeSeats = async ({
    showtimeId,
    roomLayoutVersion,
    seats,
  }) => {
    const session = await connection.startSession();
    let result;

    try {
      await session.withTransaction(async () => {
        const existing = await listByShowtime(showtimeId, session);
        const expectedSeatIds = new Set(
          seats.map(({ seatId }) => seatId.toString()),
        );
        const hasDifferentSnapshot = existing.some(
          ({ seatId, roomLayoutVersion: storedVersion }) =>
            storedVersion !== roomLayoutVersion ||
            !expectedSeatIds.has(seatId.toString()),
        );
        const expectedPrices = new Map(seats.filter((seat) => seat.priceSnapshot !== undefined)
          .map(({ seatId, priceSnapshot }) => [String(seatId), priceSnapshot]));
        const hasDifferentPrices = existing.some(({ seatId, priceSnapshot }) =>
          expectedPrices.has(String(seatId)) && expectedPrices.get(String(seatId)) !== priceSnapshot,
        );
        if (hasDifferentSnapshot || hasDifferentPrices || existing.length > seats.length) {
          throw new ShowtimeSeatInitializationConflictError();
        }

        if (existing.length < seats.length) {
          await showtimeSeatModel.bulkWrite(
            seats.map(({ seatId, state, priceSnapshot }) => ({
              updateOne: {
                filter: { showtimeId, seatId },
                update: {
                  $setOnInsert: {
                    showtimeId,
                    seatId,
                    roomLayoutVersion,
                    state,
                    ...(priceSnapshot !== undefined ? { priceSnapshot } : {}),
                  },
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
              storedVersion !== roomLayoutVersion ||
              !expectedSeatIds.has(seatId.toString()),
          )
        ) {
          throw new ShowtimeSeatInitializationConflictError();
        }
        result = initialized;
      });
      return result;
    } catch (error) {
      if (isDuplicateKey(error))
        throw new ShowtimeSeatInitializationConflictError();
      throw error;
    } finally {
      await session.endSession();
    }
  };

  const repriceUnclaimedShowtime = async ({ showtimeId, roomLayoutVersion, seats, now, commit }) => {
    const session = await connection.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        const booking = await bookingModel.exists({ showtimeId }).session(session).exec();
        if (booking) throw new SeatClaimConflictError();
        await expireConflictingHolds({ showtimeId, seatIds: seats.map(({ seatId }) => seatId), now, session });
        const activeHold = await seatHoldModel.exists({ showtimeId, status: SEAT_HOLD_STATUS.ACTIVE, expiresAt: { $gt: now } })
          .session(session).exec();
        const rows = await listByShowtime(showtimeId, session);
        const expected = new Set(seats.map(({ seatId }) => String(seatId)));
        if (activeHold || rows.length !== seats.length || rows.some((row) =>
          !expected.has(String(row.seatId)) || row.roomLayoutVersion !== roomLayoutVersion ||
          ![SHOWTIME_SEAT_STATE.AVAILABLE, SHOWTIME_SEAT_STATE.UNAVAILABLE].includes(row.state) || row.holdId || row.bookingId,
        )) throw new SeatClaimConflictError();
        const updated = await showtimeSeatModel.bulkWrite(seats.map(({ seatId, priceSnapshot }) => ({
          updateOne: {
            filter: { showtimeId, seatId, roomLayoutVersion, state: { $in: [SHOWTIME_SEAT_STATE.AVAILABLE, SHOWTIME_SEAT_STATE.UNAVAILABLE] } },
            update: { $set: { priceSnapshot, updatedAt: now } },
          },
        })), { session, ordered: true });
        if (updated.matchedCount !== seats.length) throw new SeatClaimConflictError();
        result = await commit(session);
        if (!result) throw new SeatClaimConflictError();
      });
      return result;
    } finally { await session.endSession(); }
  };

  // Legacy Showtimes without a price-plan reference still need the same transactional
  // booking-activity fence as repricing. Touching each seat row conflicts with concurrent
  // hold/booking writes, while leaving its historical price snapshot unchanged.
  const updateUnclaimedShowtime = async ({ showtimeId, roomLayoutVersion, seatIds, now, commit }) => {
    const session = await connection.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        const booking = await bookingModel.exists({ showtimeId }).session(session).exec();
        if (booking) throw new SeatClaimConflictError();
        await expireConflictingHolds({ showtimeId, seatIds, now, session });
        const activeHold = await seatHoldModel.exists({ showtimeId, status: SEAT_HOLD_STATUS.ACTIVE, expiresAt: { $gt: now } })
          .session(session).exec();
        const rows = await listByShowtime(showtimeId, session);
        const expected = new Set(seatIds.map(String));
        if (activeHold || rows.length !== expected.size || rows.some((row) =>
          !expected.has(String(row.seatId)) || row.roomLayoutVersion !== roomLayoutVersion ||
          ![SHOWTIME_SEAT_STATE.AVAILABLE, SHOWTIME_SEAT_STATE.UNAVAILABLE].includes(row.state) || row.holdId || row.bookingId,
        )) throw new SeatClaimConflictError();
        const fence = await showtimeSeatModel.bulkWrite(seatIds.map((seatId) => ({
          updateOne: {
            filter: { showtimeId, seatId, roomLayoutVersion, state: { $in: [SHOWTIME_SEAT_STATE.AVAILABLE, SHOWTIME_SEAT_STATE.UNAVAILABLE] } },
            update: { $set: { updatedAt: now } },
          },
        })), { session, ordered: true });
        if (fence.matchedCount !== seatIds.length) throw new SeatClaimConflictError();
        result = await commit(session);
        if (!result) throw new SeatClaimConflictError();
      });
      return result;
    } finally { await session.endSession(); }
  };

  const findByOwnerAndCheckoutKey = (ownerId, checkoutKey, session) =>
    seatHoldModel
      .findOne({ ownerId, checkoutKey })
      .session(session ?? null)
      .lean()
      .exec();

  const findLiveForBooking = async ({ holdId, ownerId, now, session }) => {
    const hold = await seatHoldModel
      .findOne({
        _id: holdId,
        ownerId,
      })
      .session(session ?? null)
      .lean()
      .exec();
    if (!hold) return null;
    if (
      hold.status !== SEAT_HOLD_STATUS.ACTIVE ||
      new Date(hold.expiresAt).getTime() <= now.getTime()
    ) {
      return hold;
    }

    const claims = await showtimeSeatModel
      .find({
        holdId: hold._id,
        holdOwnerId: hold.ownerId,
        state: SHOWTIME_SEAT_STATE.HELD,
        holdExpiresAt: { $gt: now },
      })
      .select({ seatId: 1, priceSnapshot: 1 })
      .session(session ?? null)
      .lean()
      .exec();
    const expectedSeatIds = [...hold.seatIds].map(String).sort();
    const claimedSeatIds = claims.map(({ seatId }) => seatId.toString()).sort();
    if (
      expectedSeatIds.length !== claimedSeatIds.length ||
      expectedSeatIds.some((seatId, index) => seatId !== claimedSeatIds[index])
    ) {
      return null;
    }

    if (!Array.isArray(hold.priceSnapshot?.lines)) return hold;

    const holdPrices = new Map(
      hold.priceSnapshot.lines.map(({ seatId, unitPrice }) => [
        seatId.toString(),
        unitPrice,
      ]),
    );
    if (
      claims.some(
        ({ seatId, priceSnapshot }) =>
          holdPrices.get(seatId.toString()) !== priceSnapshot,
      )
    ) {
      return null;
    }

    // Establish a write dependency on the hold in the caller's transaction. Release and lazy
    // expiry also write this document, so MongoDB will abort one side instead of allowing a
    // Booking to commit from seat claims that changed concurrently.
    return seatHoldModel
      .findOneAndUpdate(
        {
          _id: hold._id,
          ownerId: hold.ownerId,
          status: SEAT_HOLD_STATUS.ACTIVE,
          expiresAt: { $gt: now },
          updatedAt: hold.updatedAt,
        },
        { $set: { updatedAt: now } },
        { new: true, session },
      )
      .lean()
      .exec();
  };

  const expireConflictingHolds = async ({
    showtimeId,
    seatIds,
    now,
    session,
  }) => {
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

    const holdIds = [
      ...new Set(
        expiredClaims.map(({ holdId }) => holdId?.toString()).filter(Boolean),
      ),
    ];
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
      {
        _id: { $in: holdIds },
        status: SEAT_HOLD_STATUS.ACTIVE,
        expiresAt: { $lte: now },
      },
      { $set: { status: SEAT_HOLD_STATUS.EXPIRED } },
      { session },
    );
  };

  const claimSeat = async ({ hold, seatId, unitPrice, session }) => {
    const key = { showtimeId: hold.showtimeId, seatId };
    const result = await showtimeSeatModel.updateOne(
      {
        ...key,
        state: SHOWTIME_SEAT_STATE.AVAILABLE,
        // Reject a quote read before an unsold Showtime was repriced concurrently.
        priceSnapshot: unitPrice,
      },
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
        [
          {
            ...key,
            roomLayoutVersion: hold.roomLayoutVersion,
            state: SHOWTIME_SEAT_STATE.HELD,
            holdId: hold._id,
            holdOwnerId: hold.ownerId,
            holdExpiresAt: hold.expiresAt,
            priceSnapshot: unitPrice,
          },
        ],
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
        const hold = {
          ...holdInput,
          _id: holdId,
          status: SEAT_HOLD_STATUS.ACTIVE,
        };
        await expireConflictingHolds({
          showtimeId: hold.showtimeId,
          seatIds: hold.seatIds,
          now: hold.heldAt,
          session,
        });

        const priceBySeat = new Map(
          hold.priceSnapshot.lines.map(({ seatId, unitPrice }) => [
            seatId.toString(),
            unitPrice,
          ]),
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
        const hold = await seatHoldModel
          .findById(holdId)
          .session(session)
          .lean()
          .exec();
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

        const status =
          hold.expiresAt <= now
            ? SEAT_HOLD_STATUS.EXPIRED
            : SEAT_HOLD_STATUS.RELEASED;
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
                ...(status === SEAT_HOLD_STATUS.RELEASED
                  ? { releasedAt: now }
                  : {}),
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

  const expireForBooking = async ({ holdId, now = new Date(), session }) => {
    const hold = await seatHoldModel
      .findById(holdId)
      .session(session ?? null)
      .lean()
      .exec();
    if (!hold || hold.status !== SEAT_HOLD_STATUS.ACTIVE) {
      return hold;
    }

    await showtimeSeatModel.updateMany(
      { holdId: hold._id, state: SHOWTIME_SEAT_STATE.HELD },
      {
        $set: { state: SHOWTIME_SEAT_STATE.AVAILABLE },
        $unset: { holdId: "", holdOwnerId: "", holdExpiresAt: "" },
      },
      session ? { session } : {},
    );

    return seatHoldModel
      .findOneAndUpdate(
        { _id: hold._id, status: SEAT_HOLD_STATUS.ACTIVE },
        { $set: { status: SEAT_HOLD_STATUS.EXPIRED, updatedAt: now } },
        { new: true, ...(session ? { session } : {}) },
      )
      .lean()
      .exec();
  };

  const consumeForBooking = async ({
    holdId,
    bookingId,
    ownerId,
    seatIds,
    verifiedAt = new Date(),
    session,
  }) => {
    const hold = await seatHoldModel
      .findOne({ _id: holdId, ownerId })
      .session(session ?? null)
      .lean()
      .exec();

    if (!hold) {
      return { outcome: "EXPIRED" };
    }

    if (hold.status === SEAT_HOLD_STATUS.CONSUMED) {
      return { outcome: "ALREADY_CONSUMED", hold };
    }

    if (
      hold.status !== SEAT_HOLD_STATUS.ACTIVE ||
      new Date(hold.expiresAt).getTime() <= new Date(verifiedAt).getTime()
    ) {
      await expireForBooking({ holdId: hold._id, now: verifiedAt, session });
      return { outcome: "EXPIRED" };
    }

    const expectedSeatIds = (seatIds ?? hold.seatIds ?? []).map(
      (id) => new mongoose.Types.ObjectId(id),
    );
    const seatUpdate = await showtimeSeatModel.updateMany(
      {
        holdId: hold._id,
        holdOwnerId: hold.ownerId,
        seatId: { $in: expectedSeatIds },
        state: SHOWTIME_SEAT_STATE.HELD,
        holdExpiresAt: { $gt: verifiedAt },
      },
      {
        $set: {
          state: SHOWTIME_SEAT_STATE.SOLD,
          bookingId: new mongoose.Types.ObjectId(bookingId),
          updatedAt: verifiedAt,
        },
        $unset: { holdExpiresAt: "" },
      },
      session ? { session } : {},
    );

    if ((seatUpdate?.modifiedCount ?? seatUpdate?.matchedCount ?? 0) !== expectedSeatIds.length) {
      return { outcome: "EXPIRED" };
    }

    const consumedHold = await seatHoldModel
      .findOneAndUpdate(
        {
          _id: hold._id,
          ownerId: hold.ownerId,
          status: SEAT_HOLD_STATUS.ACTIVE,
        },
        {
          $set: {
            status: SEAT_HOLD_STATUS.CONSUMED,
            consumedAt: verifiedAt,
            updatedAt: verifiedAt,
          },
        },
        { new: true, ...(session ? { session } : {}) },
      )
      .lean()
      .exec();

    if (!consumedHold) {
      return { outcome: "EXPIRED" };
    }

    return { outcome: "CONSUMED", hold: consumedHold };
  };

  return {
    acquire,
    consumeForBooking,
    deleteUnpublishedShowtimeSeats,
    expireForBooking,
    findByOwnerAndCheckoutKey,
    findLiveForBooking,
    hasActiveShowtimeClaims,
    initializeShowtimeSeats,
    repriceUnclaimedShowtime,
    updateUnclaimedShowtime,
    listByShowtime,
    summarizeAvailabilityByShowtime,
    release,
  };
};

export const seatHoldRepository = createSeatHoldRepository();
