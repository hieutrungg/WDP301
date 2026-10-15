import { seatHoldRepository } from "./seat-hold.repository.js";

// Reads only immutable per-showtime seat prices. The publish/seed integration owns writing these
// snapshots; Booking never derives a price from the current Room or a client-provided amount.
export const createShowtimeSeatPriceQuoter = ({ repository = seatHoldRepository } = {}) => ({
  async quote(showtimeId, seatIds) {
    const states = await repository.listByShowtime(showtimeId);
    const priceBySeat = new Map(
      states
        .filter(({ priceSnapshot }) => Number.isSafeInteger(priceSnapshot))
        .map(({ seatId, priceSnapshot }) => [seatId.toString(), priceSnapshot]),
    );
    const lines = seatIds.map((seatId) => ({
      seatId: String(seatId),
      unitPrice: priceBySeat.get(String(seatId)),
    }));

    if (lines.some(({ unitPrice }) => !Number.isSafeInteger(unitPrice) || unitPrice < 0)) {
      return null;
    }

    return {
      quoteId: `showtime-seat:${showtimeId}`,
      currency: "VND",
      lines,
      totalAmount: lines.reduce((total, { unitPrice }) => total + unitPrice, 0),
    };
  },
});

export const showtimeSeatPriceQuoter = createShowtimeSeatPriceQuoter();
