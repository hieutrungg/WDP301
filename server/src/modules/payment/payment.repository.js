import mongoose from "mongoose";
import { Payment } from "./payment.model.js";
import { PAYMENT_STATUS } from "./payment.constants.js";

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

  async aggregateSuccessfulRevenue({ fromAt, toAt, session } = {}) {
    const match = {
      status: {
        $in: [
          PAYMENT_STATUS.PAID,
          PAYMENT_STATUS.PARTIALLY_REFUNDED,
          PAYMENT_STATUS.REFUNDED,
        ],
      },
      ...(fromAt || toAt
        ? { paidAt: { ...(fromAt ? { $gte: fromAt } : {}), ...(toAt ? { $lt: toAt } : {}) } }
        : {}),
    };
    const [summary] = await paymentModel
      .aggregate([
        { $match: match },
        { $group: { _id: null, amount: { $sum: "$amount" } } },
      ])
      .session(session ?? null)
      .exec();
    return { amount: summary?.amount ?? 0 };
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
