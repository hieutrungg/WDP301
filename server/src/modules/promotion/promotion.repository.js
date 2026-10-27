import mongoose from "mongoose";
import {
  Promotion,
  Voucher,
  VoucherRedemption,
  VoucherCommand,
} from "./promotion.model.js";

export const promotionRepository = {
  promotion: Promotion,
  voucher: Voucher,
  redemption: VoucherRedemption,
  command: VoucherCommand,
  async transaction(work) {
    const session = await mongoose.connection.startSession();
    try {
      return await session.withTransaction(() => work(session));
    } finally {
      await session.endSession();
    }
  },
};
