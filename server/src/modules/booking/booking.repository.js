import mongoose from "mongoose";
import { BOOKING_STATUS } from "./booking.constants.js";
import { Booking } from "./booking.model.js";

export const createBookingRepository = ({
  bookingModel = Booking,
  connection = mongoose.connection,
} = {}) => ({
  findById(bookingId, session) {
    return bookingModel
      .findById(bookingId)
      .session(session ?? null)
      .lean()
      .exec();
  },

  findByPayableReference(payableReference, session) {
    return bookingModel
      .findOne({ payableReference })
      .session(session ?? null)
      .lean()
      .exec();
  },

  findByCustomerRequestKey(customerAccountId, requestKey, session) {
    return bookingModel
      .findOne({ customerAccountId, requestKey })
      .session(session ?? null)
      .lean()
      .exec();
  },

  findByHoldId(holdId, session) {
    return bookingModel.findOne({ holdId }).session(session ?? null).lean().exec();
  },

  async createPending(input, session) {
    const [booking] = await bookingModel.create([input], { session });
    return booking.toObject();
  },

  markConfirmed({ bookingId, paymentId, confirmedAt }, session) {
    return bookingModel
      .findOneAndUpdate(
        { _id: bookingId, status: BOOKING_STATUS.PENDING_PAYMENT },
        {
          $set: {
            status: BOOKING_STATUS.CONFIRMED,
            confirmedAt,
            ...(paymentId ? { paymentId: new mongoose.Types.ObjectId(paymentId) } : {}),
            updatedAt: confirmedAt,
          },
        },
        { new: true, session },
      )
      .lean()
      .exec();
  },

  markExpired({ bookingId, expiredAt }, session) {
    return bookingModel
      .findOneAndUpdate(
        { _id: bookingId, status: BOOKING_STATUS.PENDING_PAYMENT },
        {
          $set: {
            status: BOOKING_STATUS.EXPIRED,
            expiredAt,
            updatedAt: expiredAt,
          },
        },
        { new: true, session },
      )
      .lean()
      .exec();
  },

  async withTransaction(work) {
    const session = await connection.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await work(session);
      });
      return result;
    } finally {
      await session.endSession();
    }
  },
});

export const bookingRepository = createBookingRepository();
