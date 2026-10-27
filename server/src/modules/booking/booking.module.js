import { getLayoutVersionForBooking } from "../room/room.service.js";
import { getBookableShowtimeForBooking } from "../showtime/showtime.service.js";
import { createSeatAvailabilityController } from "./seat-availability.controller.js";
import { createSeatAvailabilityRouter } from "./seat-availability.routes.js";
import { createSeatAvailabilityService } from "./seat-availability.service.js";
import { createSeatHoldController } from "./seat-hold.controller.js";
import { createSeatHoldRouter } from "./seat-hold.routes.js";
import { createSeatHoldService } from "./seat-hold.service.js";
import { showtimeSeatPriceQuoter } from "./seat-price.service.js";
import { createBookingController } from "./booking.controller.js";
import { createBookingRouter } from "./booking.routes.js";
import { createBookingService } from "./booking.service.js";
import { createConcessionCheckoutService, selectionFingerprint } from "../concession/checkout.service.js";
import { createConcessionCheckoutRouter } from "../concession/checkout.routes.js";
import { promotionService } from "../promotion/promotion.service.js";
import { bookingRepository } from "./booking.repository.js";
import { createBookingVoucherService } from "./booking-voucher.service.js";
import { createBookingVoucherRouter } from "./booking-voucher.routes.js";
import { paymentPricingReader } from "../payment/payment-pricing.read-service.js";

const showtimeReader = {
  getBookableShowtime: (...args) => getBookableShowtimeForBooking(...args),
};

const roomLayoutReader = {
  getLayoutVersion: (...args) => getLayoutVersionForBooking(...args),
};

export const seatAvailabilityService = createSeatAvailabilityService({
  showtimeReader,
  roomLayoutReader,
  priceQuoter: showtimeSeatPriceQuoter,
});

export const seatHoldService = createSeatHoldService({
  showtimeReader,
  roomLayoutReader,
  priceQuoter: showtimeSeatPriceQuoter,
});

export const concessionCheckoutService = createConcessionCheckoutService({
  getLiveHold: command => seatHoldService.getLiveHoldForBooking(command),
  getShowtime: (...args) => getBookableShowtimeForBooking(...args),
});
export const concessionCheckoutRoutes = createConcessionCheckoutRouter(concessionCheckoutService);
export const bookingService = createBookingService({
  promotionPort: promotionService,
  concessionPort: { ...concessionCheckoutService, fingerprint: selectionFingerprint },
  seatHoldPort: {
    getLiveHoldForBooking: (command) => seatHoldService.getLiveHoldForBooking(command),
    consumeHoldForBooking: (command) => seatHoldService.consumeHoldForBooking(command),
    expireHoldForBooking: (command) => seatHoldService.expireHoldForBooking(command),
  },
  showtimeReader,
  roomLayoutReader,
});

export const bookingVoucherService = createBookingVoucherService({ repository: bookingRepository, promotionPort: promotionService, seatHoldPort: seatHoldService, paymentReader: paymentPricingReader });
bookingService.lockPricingForPayment = bookingVoucherService.lockPricingForPayment;
export const bookingVoucherRoutes = createBookingVoucherRouter(bookingVoucherService);

export const seatAvailabilityRoutes = createSeatAvailabilityRouter(
  createSeatAvailabilityController(seatAvailabilityService),
);

export const seatHoldRoutes = createSeatHoldRouter(createSeatHoldController(seatHoldService));

export const bookingRoutes = createBookingRouter(createBookingController(bookingService));
