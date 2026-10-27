export const toVietnamInput = (value) =>
  value
    ? new Date(Date.parse(value) + 7 * 3600000).toISOString().slice(0, 16)
    : "";
export const fromVietnamInput = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error("Enter a valid start and end date in Vietnam time.");
  return new Date(`${value}:00+07:00`).toISOString();
};
export const validPercentage = (value) =>
  Number.isFinite(value) &&
  value > 0 &&
  value <= 20 &&
  Math.round(value * 100) / 100 === value;
export const dateLabel = (date) =>
  new Date(date).toLocaleString("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "medium",
    timeStyle: "short",
  });
