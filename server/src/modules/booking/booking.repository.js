import mongoose from "mongoose";
import { Booking } from "./booking.model.js";

export const createBookingRepository = ({
  bookingModel = Booking,
  connection = mongoose.connection,
} = {}) => ({
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
