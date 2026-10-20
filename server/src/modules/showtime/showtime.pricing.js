// Iteration 2 uses seed-first pricing. Copy these MVP defaults into each showtime's seats at
// publish time; changing this table later must not reprice already-published showtimes.
// Replace this source only when a reviewed Pricing owner contract is integrated.
export const MVP_SEAT_TYPE_PRICES_VND = Object.freeze({
  STANDARD: 90_000,
  VIP: 120_000,
  DOUBLE_LUXURY: 180_000,
});
