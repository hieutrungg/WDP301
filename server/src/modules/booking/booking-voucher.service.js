import { createHash } from "node:crypto";
import {
  promoError,
  discountForTickets,
} from "../promotion/promotion.policy.js";

export function assertVoucherBookingSnapshot(booking) {
  const snapshot = booking.voucherSnapshot;
  const invalid = () =>
    promoError(
      "VOUCHER_STORAGE_NOT_READY",
      "Discounted booking data requires review before checkout",
      503,
    );
  if (!snapshot) {
    if (booking.voucherId || (booking.discountAmount ?? 0) !== 0)
      throw invalid();
    return;
  }
  let expected;
  try {
    expected = discountForTickets(booking.subtotal, snapshot.discountValue);
  } catch {
    throw invalid();
  }
  if (
    !/^[a-f\d]{24}$/i.test(String(snapshot.reservationId)) ||
    String(snapshot.voucherId) !== String(booking.voucherId) ||
    snapshot.discountAmount !== expected ||
    booking.discountAmount !== expected ||
    booking.totalAmount !==
      booking.subtotal - expected + (booking.concessionAmount ?? 0)
  )
    throw invalid();
}

export const bookingPricingDto = (booking) => ({
  ticketAmount: booking.subtotal ?? booking.ticketAmount,
  discountAmount: booking.discountAmount ?? 0,
  concessionAmount: booking.concessionAmount ?? 0,
  pricingVersion: booking.pricingVersion ?? 0,
  pricingLocked: Boolean(booking.pricingLockedAt || booking.pricingLocked),
  voucher:
    (booking.voucherSnapshot ?? booking.voucher)
      ? {
          voucherId: String(
            (booking.voucherSnapshot ?? booking.voucher).voucherId,
          ),
          reservationId: String(
            (booking.voucherSnapshot ?? booking.voucher).reservationId,
          ),
          code: (booking.voucherSnapshot ?? booking.voucher).code,
          promotionName: (booking.voucherSnapshot ?? booking.voucher)
            .promotionName,
          discountValue: (booking.voucherSnapshot ?? booking.voucher)
            .discountValue,
          status: ["CONFIRMED", "REFUNDED"].includes(booking.status)
            ? "CONSUMED"
            : booking.status === "PENDING_PAYMENT"
              ? "RESERVED"
              : "RELEASED",
        }
      : null,
});
const result = (booking, now, idempotent = false) => ({
  ...bookingPricingDto(booking),
  bookingId: String(booking._id),
  amount: booking.totalAmount,
  currency: booking.currency,
  expiresAt: booking.expiresAt,
  serverNow: now,
  idempotent,
});

export function createBookingVoucherService({
  repository,
  promotionPort,
  seatHoldPort,
  paymentReader,
  clock = () => new Date(),
}) {
  const owned = async (bookingId, ownerId, session) => {
    const booking = await repository.findById(bookingId, session);
    if (!booking || String(booking.customerAccountId) !== String(ownerId))
      throw promoError("BOOKING_NOT_FOUND", "Booking not found", 404);
    return booking;
  };
  const live = async (booking, now, session) => {
    assertVoucherBookingSnapshot(booking);
    if (
      booking.status !== "PENDING_PAYMENT" ||
      new Date(booking.expiresAt) <= now
    )
      throw promoError("BOOKING_HOLD_EXPIRED", "Your checkout has expired");
    const hold = await seatHoldPort.getLiveHoldForBooking({
      holdId: booking.holdId,
      ownerId: booking.customerAccountId,
      now,
      session,
    });
    if (
      !hold ||
      hold.status !== "ACTIVE" ||
      +new Date(hold.expiresAt) !== +new Date(booking.expiresAt)
    )
      throw promoError(
        "BOOKING_HOLD_EXPIRED",
        "Your seat hold is no longer available",
      );
  };
  const unlocked = async (booking, session) => {
    if (
      booking.pricingLockedAt ||
      (await paymentReader?.hasPaymentForBooking(booking._id, session))
    )
      throw promoError(
        "BOOKING_PRICING_LOCKED",
        "Voucher changes are locked after the first payment initiation",
      );
  };
  const mutate = async ({
    bookingId,
    ownerId,
    code,
    requestKey,
    expectedPricingVersion,
  }) => {
    await promotionPort.assertReady();
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ code: code ?? null, expectedPricingVersion }))
      .digest("hex");
    // Duplicate key races are retried in a fresh transaction to resolve the winning command/claim.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await repository.withTransaction(async (session) => {
          const booking = await owned(bookingId, ownerId, session);
          const replay = await promotionPort.readCommand({
            bookingId,
            requestKey,
            fingerprint,
            session,
          });
          if (replay) return replay;
          const now = clock();
          await live(booking, now, session);
          await unlocked(booking, session);
          if ((booking.pricingVersion ?? 0) !== expectedPricingVersion)
            throw promoError(
              "BOOKING_PRICING_CHANGED",
              "Checkout changed. Reload before applying a voucher",
            );
          let snapshot = booking.voucherSnapshot;
          if (snapshot && snapshot.code === code) {
            await promotionPort.assertReservation({
              reservationId: snapshot.reservationId,
              bookingId,
              now,
              session,
            });
          } else {
            if (snapshot)
              await promotionPort.releaseForPricingChange({
                reservationId: snapshot.reservationId,
                now,
                reason: "PRICING_CHANGE",
                session,
              });
            snapshot = code
              ? await promotionPort.reserveForBooking({
                  bookingId: booking._id,
                  customerAccountId: booking.customerAccountId,
                  code,
                  ticketAmount: booking.subtotal,
                  expiresAt: booking.expiresAt,
                  now,
                  pricingVersion: expectedPricingVersion + 1,
                  session,
                })
              : null;
          }
          const totalAmount =
            booking.subtotal -
            (snapshot?.discountAmount ?? 0) +
            (booking.concessionAmount ?? 0);
          if (!Number.isSafeInteger(totalAmount) || totalAmount < 0)
            throw promoError("INVALID_VOUCHER", "Invalid checkout amount", 400);
          const updated = await repository.updatePricing(
            {
              bookingId,
              expectedPricingVersion,
              voucherSnapshot: snapshot,
              totalAmount,
              discountAmount: snapshot?.discountAmount ?? 0,
            },
            session,
          );
          if (!updated)
            throw promoError(
              "BOOKING_PRICING_CHANGED",
              "Checkout changed. Reload before applying a voucher",
            );
          const dto = result(updated, now);
          await promotionPort.recordCommand(
            { bookingId, requestKey, fingerprint, result: dto },
            session,
          );
          return dto;
        });
      } catch (e) {
        if (e.code !== 11000) throw e;
      }
    }
    throw promoError(
      "BOOKING_PRICING_CHANGED",
      "Another checkout is using this code. Reload and try again",
    );
  };
  return {
    applyVoucher: mutate,
    removeVoucher: (command) => mutate({ ...command, code: undefined }),
    async quoteVoucher({ bookingId, ownerId, code }) {
      const booking = await owned(bookingId, ownerId);
      const now = clock();
      await live(booking, now);
      await unlocked(booking);
      const quote = await promotionPort.quoteForBooking({
        bookingId,
        customerAccountId: booking.customerAccountId,
        code,
        ticketAmount: booking.subtotal,
        expiresAt: booking.expiresAt,
        now,
      });
      return {
        ...result(booking, now),
        voucher: {
          voucherId: quote.voucherId,
          code: quote.code,
          promotionName: quote.promotionName,
          discountValue: quote.discountValue,
        },
        quoted: true,
        discountAmount: quote.discountAmount,
        amount:
          booking.subtotal -
          quote.discountAmount +
          (booking.concessionAmount ?? 0),
      };
    },
    async lockPricingForPayment({ bookingId, ownerId }) {
      return repository.withTransaction(async (session) => {
        const booking = await owned(bookingId, ownerId, session);
        // Preserve existing terminal-state/retry handling in the Payment owner.
        if (
          booking.status !== "PENDING_PAYMENT" ||
          new Date(booking.expiresAt) <= clock()
        )
          return booking;
        await live(booking, clock(), session);
        if (booking.voucherSnapshot)
          await promotionPort.assertReservation({
            reservationId: booking.voucherSnapshot.reservationId,
            bookingId,
            now: clock(),
            session,
          });
        if (booking.pricingLockedAt) return booking;
        const locked = await repository.lockPricing(
          bookingId,
          clock(),
          session,
        );
        if (!locked)
          throw promoError(
            "BOOKING_PRICING_CHANGED",
            "Checkout changed. Retry payment",
          );
        return locked;
      });
    },
  };
}
