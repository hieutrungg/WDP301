import { createSeatAvailabilityService } from "../booking/seat-availability.service.js";
import { getLayoutVersionForBooking } from "../room/room.service.js";
import { findPublicShowtimes } from "./showtime.repository.js";

const seatAvailability = createSeatAvailabilityService({
  roomLayoutReader: { getLayoutVersion: getLayoutVersionForBooking },
});

// Validate the full published price snapshot before either consumer paginates.
export async function* scanBookableShowtimes(scope) {
  const limit = 50;
  let total = 0;
  for (let page = 1; page === 1 || (page - 1) * limit < total; page += 1) {
    const result = await findPublicShowtimes({ ...scope, page, limit });
    total = result.total;
    const entries = await Promise.all(
      result.items.map(async (item) => ({
        item,
        priceSnapshot: await seatAvailability.getPriceSnapshot({
          showtimeId: item._id,
          roomId: item.roomId,
          roomLayoutVersion: item.roomLayoutVersion,
        }),
      })),
    );
    yield entries.filter(({ priceSnapshot }) => priceSnapshot);
  }
}
