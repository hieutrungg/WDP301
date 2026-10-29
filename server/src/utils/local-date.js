// Calendar dates in Asia/Ho_Chi_Minh (UTC+7, no DST). Times are stored in UTC and shown in this
// zone (A-15), so "which day is it" and "what UTC range is that day" are answered here.

const TIME_ZONE_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const localDateOf = (instant) => new Date(instant.getTime() + TIME_ZONE_OFFSET_MS).toISOString().slice(0, 10);

// Inclusive local dates -> half-open UTC range [from, to).
export const localDateRangeToUtc = (dateFrom, dateTo) => {
  const from = new Date(`${dateFrom}T00:00:00.000+07:00`);
  const to = new Date(new Date(`${dateTo}T00:00:00.000+07:00`).getTime() + DAY_MS);
  return { from, to };
};
