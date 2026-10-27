import mongoose from "mongoose";
import { Payment } from "./payment.model.js";

const toPlainObject = (document) =>
  typeof document?.toObject === "function" ? document.toObject() : document;

export const createPaymentRepository = ({
  paymentModel = Payment,
  connection = mongoose.connection,
} = {}) => ({
  findById(paymentId, session) {
    return paymentModel
      .findById(paymentId)
      .session(session ?? null)
      .lean()
      .exec();
  },

  findByBookingId(bookingId, session) {
    return paymentModel
      .findOne({ bookingId })
      .session(session ?? null)
      .lean()
      .exec();
  },

  findByPayableReference(payableReference, session) {
    return paymentModel
      .findOne({ payableReference })
      .session(session ?? null)
      .lean()
      .exec();
  },

  findByProviderOrderCode(providerOrderCode, session) {
    return paymentModel
      .findOne({ "attempts.providerOrderCode": providerOrderCode })
      .session(session ?? null)
      .lean()
      .exec();
  },

  findByAttemptIdempotencyKey(idempotencyKey, session) {
    return paymentModel
      .findOne({ "attempts.idempotencyKey": idempotencyKey })
      .session(session ?? null)
      .lean()
      .exec();
  },

  async create(input, session) {
    const [created] = await paymentModel.create(
      [input],
      session ? { session } : {},
    );
    return toPlainObject(created);
  },

  saveState(paymentId, nextDocument, filter = {}, session) {
    return paymentModel
      .findOneAndUpdate(
        { _id: paymentId, ...filter },
        { $set: nextDocument },
        { new: true, runValidators: true, ...(session ? { session } : {}) },
      )
      .lean()
      .exec();
  },

  replaceById(paymentId, nextDocument, filter = {}, session) {
    return paymentModel
      .findOneAndUpdate(
        { _id: paymentId, ...filter },
        { $set: nextDocument },
        { new: true, runValidators: true, ...(session ? { session } : {}) },
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

export const paymentRepository = createPaymentRepository();
