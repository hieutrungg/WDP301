import mongoose from "mongoose";
import { promotionRepository } from "./promotion.repository.js";
import {
  assertPromotionStorage,
  storageUnavailable,
  validPromotion,
  validVoucher,
} from "./promotion.storage.js";
import {
  normalizeCode,
  promoError,
  promotionDto,
  voucherDto,
  discountForTickets,
} from "./promotion.policy.js";

export function createPromotionService({
  repository: r = promotionRepository,
  clock = () => new Date(),
  assertReady = assertPromotionStorage,
} = {}) {
  const requireSession = (session) => {
    if (!session?.inTransaction())
      throw new TypeError(
        "Promotion mutation requires the caller's transaction",
      );
  };
  const checkedVoucher = (v) => {
    if (!v || !validVoucher(v)) throw storageUnavailable();
    return v;
  };
  const checkedPromotion = (p) => {
    if (!p || !validPromotion(p)) throw storageUnavailable();
    return p;
  };
  const release = async ({
    reservationId,
    now = clock(),
    reason = "CHECKOUT_CLOSED",
    session,
  }) => {
    requireSession(session);
    const row = await r.redemption
      .findOneAndUpdate(
        { _id: reservationId, state: "RESERVED" },
        {
          $set: { state: "RELEASED", blocking: false, releasedAt: now, reason },
        },
        { returnDocument: "after", session },
      )
      .lean();
    if (!row) return;
    const result = await r.voucher.updateOne(
      { _id: row.voucherId, reservedCount: { $gte: 1 } },
      { $inc: { reservedCount: -1 } },
      { session },
    );
    if (result.modifiedCount !== 1) throw storageUnavailable();
  };
  const reclaim = async (voucherId, now, session) => {
    const rows = await r.redemption
      .find({ voucherId, state: "RESERVED", expiresAt: { $lte: now } })
      .session(session)
      .lean();
    for (const row of rows)
      await release({
        reservationId: row._id,
        now,
        reason: "EXPIRED",
        session,
      });
  };
  const eligibility = async ({
    code,
    customerAccountId,
    bookingId,
    ticketAmount,
    now = clock(),
    session,
  }) => {
    const v = await r.voucher
      .findOne({ code: normalizeCode(code) })
      .session(session ?? null)
      .lean();
    if (!v)
      throw promoError(
        "VOUCHER_UNAVAILABLE",
        "Invalid or unavailable voucher code",
      );
    checkedVoucher(v);
    const p = checkedPromotion(
      await r.promotion
        .findById(v.promotionId)
        .session(session ?? null)
        .lean(),
    );
    if (
      p.status !== "ACTIVE" ||
      v.status !== "ACTIVE" ||
      p.startDate > now ||
      p.endDate <= now ||
      +v.validFrom !== +p.startDate ||
      +v.validTo !== +p.endDate
    )
      throw promoError(
        "VOUCHER_UNAVAILABLE",
        "This voucher is disabled or outside its valid dates",
      );
    const claim = await r.redemption
      .findOne({ voucherId: v._id, customerAccountId, blocking: true })
      .session(session ?? null)
      .lean();
    if (claim?.state === "CONSUMED")
      throw promoError(
        "VOUCHER_ALREADY_USED",
        "You have already used this code successfully",
      );
    if (
      claim &&
      claim.expiresAt > now &&
      String(claim.bookingId) !== String(bookingId)
    )
      throw promoError(
        "VOUCHER_HELD_ELSEWHERE",
        "This code is held by your other checkout",
      );
    const expired = session
      ? 0
      : await r.redemption.countDocuments({
          voucherId: v._id,
          state: "RESERVED",
          expiresAt: { $lte: now },
        });
    const same =
      claim?.state === "RESERVED" &&
      String(claim.bookingId) === String(bookingId) &&
      claim.expiresAt > now;
    if (
      !same &&
      v.usageLimit !== null &&
      v.usedCount + v.reservedCount - expired >= v.usageLimit
    )
      throw promoError(
        "VOUCHER_LIMIT_REACHED",
        "All uses of this code are used or reserved",
      );
    return {
      v,
      p,
      discountAmount: discountForTickets(ticketAmount, p.discountValue),
    };
  };
  const page = (items, total, { page, limit }) => ({
    items,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
  return {
    assertReady,
    async listPromotions(query) {
      await assertReady();
      const filter = {
        ...(query.status ? { status: query.status } : {}),
        ...(query.q
          ? {
              name: {
                $regex: query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                $options: "i",
              },
            }
          : {}),
      };
      const [items, total] = await Promise.all([
        r.promotion
          .find(filter)
          .sort({ createdAt: -1, _id: -1 })
          .skip((query.page - 1) * query.limit)
          .limit(query.limit)
          .lean(),
        r.promotion.countDocuments(filter),
      ]);
      return page(
        items.map((p) => promotionDto(checkedPromotion(p), clock())),
        total,
        query,
      );
    },
    async getPromotion(id) {
      await assertReady();
      const p = await r.promotion.findById(id).lean();
      if (!p)
        throw promoError("PROMOTION_NOT_FOUND", "Promotion not found", 404);
      return promotionDto(checkedPromotion(p), clock());
    },
    async createPromotion(input, actorId) {
      await assertReady();
      return promotionDto(
        (
          await r.promotion.create({
            ...input,
            discountType: "PERCENTAGE",
            version: 0,
            createdBy: actorId,
            updatedBy: actorId,
          })
        ).toObject(),
        clock(),
      );
    },
    async updatePromotion(id, { expectedVersion, ...input }, actorId) {
      await assertReady();
      return r.transaction(async (session) => {
        const current = await r.promotion.findById(id).session(session).lean();
        if (!current)
          throw promoError("PROMOTION_NOT_FOUND", "Promotion not found", 404);
        checkedPromotion(current);
        const next = { ...current, ...input };
        if (next.startDate >= next.endDate)
          throw promoError("INVALID_PROMOTION", "End must be after start", 400);
        const p = await r.promotion
          .findOneAndUpdate(
            { _id: id, version: expectedVersion },
            { $set: { ...input, updatedBy: actorId }, $inc: { version: 1 } },
            { returnDocument: "after", session, runValidators: true },
          )
          .lean();
        if (!p)
          throw promoError(
            "PROMOTION_VERSION_CONFLICT",
            "Promotion changed. Reload before saving",
          );
        await r.voucher.updateMany(
          { promotionId: id },
          {
            $set: { validFrom: p.startDate, validTo: p.endDate },
            $inc: { version: 1 },
          },
          { session },
        );
        return promotionDto(p, clock());
      });
    },
    async listVouchers(promotionId, query) {
      await assertReady();
      if (!(await r.promotion.exists({ _id: promotionId })))
        throw promoError("PROMOTION_NOT_FOUND", "Promotion not found", 404);
      const filter = { promotionId };
      const [items, total] = await Promise.all([
        r.voucher
          .find(filter)
          .sort({ createdAt: -1, _id: -1 })
          .skip((query.page - 1) * query.limit)
          .limit(query.limit)
          .lean(),
        r.voucher.countDocuments(filter),
      ]);
      return {
        ...page(
          items.map((v) => voucherDto(checkedVoucher(v))),
          total,
          query,
        ),
        serverNow: clock(),
      };
    },
    async createVoucher(promotionId, input, actorId) {
      await assertReady();
      try {
        return await r.transaction(async (session) => {
          const p = await r.promotion
            .findOneAndUpdate(
              { _id: promotionId },
              { $inc: { reservationFence: 1 } },
              { returnDocument: "after", session },
            )
            .lean();
          if (!p)
            throw promoError("PROMOTION_NOT_FOUND", "Promotion not found", 404);
          checkedPromotion(p);
          const [v] = await r.voucher.create(
            [
              {
                ...input,
                promotionId,
                usedCount: 0,
                reservedCount: 0,
                version: 0,
                validFrom: p.startDate,
                validTo: p.endDate,
                createdBy: actorId,
                updatedBy: actorId,
              },
            ],
            { session },
          );
          return voucherDto(v.toObject());
        });
      } catch (e) {
        if (e.code === 11000)
          throw promoError("VOUCHER_CODE_TAKEN", "This code already exists");
        throw e;
      }
    },
    async updateVoucher(id, { expectedVersion, ...input }, actorId) {
      await assertReady();
      return r.transaction(async (session) => {
        await reclaim(id, clock(), session);
        const v = await r.voucher.findById(id).session(session).lean();
        if (!v) throw promoError("VOUCHER_NOT_FOUND", "Voucher not found", 404);
        checkedVoucher(v);
        if (
          input.usageLimit !== undefined &&
          input.usageLimit !== null &&
          input.usageLimit < v.usedCount + v.reservedCount
        )
          throw promoError(
            "VOUCHER_LIMIT_CONFLICT",
            "Limit cannot be below used plus reserved uses",
          );
        const updated = await r.voucher
          .findOneAndUpdate(
            { _id: id, version: expectedVersion },
            { $set: { ...input, updatedBy: actorId }, $inc: { version: 1 } },
            { returnDocument: "after", session, runValidators: true },
          )
          .lean();
        if (!updated)
          throw promoError(
            "PROMOTION_VERSION_CONFLICT",
            "Voucher changed. Reload before saving",
          );
        return voucherDto(updated);
      });
    },
    async quoteForBooking(command) {
      await assertReady();
      const { p, v, discountAmount } = await eligibility(command);
      return {
        voucherId: String(v._id),
        code: v.code,
        promotionName: p.name,
        discountValue: p.discountValue,
        discountAmount,
      };
    },
    async reserveForBooking(command) {
      requireSession(command.session);
      const now = command.now ?? clock();
      const v = await r.voucher
        .findOne({ code: normalizeCode(command.code) })
        .session(command.session)
        .lean();
      if (!v)
        throw promoError(
          "VOUCHER_UNAVAILABLE",
          "Invalid or unavailable voucher code",
        );
      await reclaim(v._id, now, command.session);
      const eligible = await eligibility({ ...command, now });
      const fence = await r.promotion.updateOne(
        { _id: eligible.p._id, version: eligible.p.version, status: "ACTIVE" },
        { $inc: { reservationFence: 1 } },
        { session: command.session },
      );
      if (fence.modifiedCount !== 1)
        throw promoError(
          "VOUCHER_UNAVAILABLE",
          "Promotion changed. Retry applying the code",
        );
      const counter = await r.voucher.updateOne(
        {
          _id: v._id,
          status: "ACTIVE",
          $expr: {
            $lt: [
              { $add: ["$usedCount", "$reservedCount"] },
              Number.MAX_SAFE_INTEGER,
            ],
          },
          $or: [
            { usageLimit: null },
            {
              $expr: {
                $lt: [
                  { $add: ["$usedCount", "$reservedCount"] },
                  "$usageLimit",
                ],
              },
            },
          ],
        },
        { $inc: { reservedCount: 1 } },
        { session: command.session },
      );
      if (counter.modifiedCount !== 1)
        throw promoError("VOUCHER_LIMIT_REACHED", "All uses are reserved");
      const reservationId = new mongoose.Types.ObjectId();
      const snapshot = {
        voucherId: v._id,
        reservationId,
        code: v.code,
        promotionName: eligible.p.name,
        discountValue: eligible.p.discountValue,
        discountAmount: eligible.discountAmount,
      };
      await r.redemption.create(
        [
          {
            _id: reservationId,
            bookingId: command.bookingId,
            customerAccountId: command.customerAccountId,
            voucherId: v._id,
            pricingVersion: command.pricingVersion,
            state: "RESERVED",
            blocking: true,
            expiresAt: command.expiresAt,
            snapshot,
          },
        ],
        { session: command.session },
      );
      return snapshot;
    },
    releaseForClosedBooking: release,
    releaseForPricingChange: release,
    async assertReservation({
      reservationId,
      bookingId,
      now = clock(),
      session,
    }) {
      await assertReady();
      const row = await r.redemption
        .findOne({
          _id: reservationId,
          bookingId,
          state: "RESERVED",
          expiresAt: { $gt: now },
        })
        .session(session ?? null)
        .lean();
      if (!row)
        throw promoError(
          "BOOKING_HOLD_EXPIRED",
          "Voucher reservation is no longer available",
        );
      return row;
    },
    async consumeForConfirmedBooking({
      reservationId,
      bookingId,
      paymentId,
      verifiedAt,
      session,
    }) {
      requireSession(session);
      await assertReady();
      const row = await r.redemption
        .findOne({ _id: reservationId, bookingId })
        .session(session)
        .lean();
      if (
        row?.state === "CONSUMED" &&
        String(row.paymentId) === String(paymentId)
      )
        return true;
      if (!row || row.state !== "RESERVED" || row.expiresAt <= verifiedAt)
        return false;
      const updated = await r.redemption.updateOne(
        { _id: row._id, state: "RESERVED" },
        { $set: { state: "CONSUMED", paymentId, consumedAt: verifiedAt } },
        { session },
      );
      if (updated.modifiedCount !== 1) return false;
      const counter = await r.voucher.updateOne(
        { _id: row.voucherId, reservedCount: { $gte: 1 } },
        { $inc: { reservedCount: -1, usedCount: 1 } },
        { session },
      );
      if (counter.modifiedCount !== 1) throw storageUnavailable();
      return true;
    },
    async readCommand({ bookingId, requestKey, fingerprint, session }) {
      const row = await r.command
        .findOne({ bookingId, requestKey })
        .session(session)
        .lean();
      if (row && row.fingerprint !== fingerprint)
        throw promoError(
          "VOUCHER_REQUEST_KEY_REUSED",
          "Request key was used for a different voucher command",
        );
      return row ? { ...row.result, idempotent: true } : null;
    },
    async recordCommand(input, session) {
      requireSession(session);
      await r.command.create([input], { session });
    },
  };
}
export const promotionService = createPromotionService();
