import { getLayoutVersionForBooking } from "../room/room.service.js";
import { getBookableShowtimeForBooking } from "../showtime/showtime.service.js";
import { createSeatAvailabilityController } from "./seat-availability.controller.js";
import { createSeatAvailabilityRouter } from "./seat-availability.routes.js";
import { createSeatAvailabilityService } from "./seat-availability.service.js";
import { createSeatHoldController } from "./seat-hold.controller.js";
import { createSeatHoldRouter } from "./seat-hold.routes.js";
import { createSeatHoldService } from "./seat-hold.service.js";
import { showtimeSeatPriceQuoter } from "./seat-price.service.js";

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

export const seatAvailabilityRoutes = createSeatAvailabilityRouter(
  createSeatAvailabilityController(seatAvailabilityService),
);

export const seatHoldRoutes = createSeatHoldRouter(createSeatHoldController(seatHoldService));

