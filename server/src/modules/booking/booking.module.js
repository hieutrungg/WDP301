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

const showtimeReader = {
  getBookableShowtime: getBookableShowtimeForBooking,
};

const roomLayoutReader = {
  getLayoutVersion: getLayoutVersionForBooking,
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
  getLiveHold: command => seatHoldService.getLiveHoldForBooking(command), getShowtime: getBookableShowtimeForBooking,
});
export const concessionCheckoutRoutes = createConcessionCheckoutRouter(concessionCheckoutService);
export const bookingService = createBookingService({
  concessionPort: { ...concessionCheckoutService, fingerprint: selectionFingerprint },
  seatHoldPort: {
    getLiveHoldForBooking: (command) => seatHoldService.getLiveHoldForBooking(command),
    consumeHoldForBooking: (command) => seatHoldService.consumeHoldForBooking(command),
    expireHoldForBooking: (command) => seatHoldService.expireHoldForBooking(command),
  },
  showtimeReader,
  roomLayoutReader,
});

export const seatAvailabilityRoutes = createSeatAvailabilityRouter(
  createSeatAvailabilityController(seatAvailabilityService),
);

export const seatHoldRoutes = createSeatHoldRouter(createSeatHoldController(seatHoldService));

export const bookingRoutes = createBookingRouter(createBookingController(bookingService));
