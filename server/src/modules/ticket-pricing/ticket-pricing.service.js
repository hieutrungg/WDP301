import mongoose from "mongoose";

const planVersion = 1; // Explicitly use the two versions approved and seeded on 2026-10-20.
const seatTypes = ["STANDARD", "VIP", "DOUBLE_LUXURY"];
const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Ho_Chi_Minh", weekday: "short",
});

export class TicketPricingUnavailableError extends Error {}

export const pricePlanCodeForShowtime = (startAt) => {
  const date = new Date(startAt);
  if (!Number.isFinite(date.getTime())) throw new TicketPricingUnavailableError("Invalid showtime date for pricing");
  const day = weekdayFormatter.format(date);
  return ["Fri", "Sat", "Sun"].includes(day) ? "ADULT_2D_WEEKEND" : "ADULT_2D_WEEKDAY";
};

export const createTicketPricingService = ({
  findPlan = (filter) => mongoose.connection.db.collection("ticket_price_plans").findOne(filter),
} = {}) => ({
  async resolveForShowtime({ startAt, roomType }) {
    // This policy is adult 2D only. Never silently apply it to IMAX/3D/other room formats.
    if (!["STANDARD", "2D"].includes(String(roomType ?? "").trim().toUpperCase())) {
      throw new TicketPricingUnavailableError("No approved adult 2D price policy for this room format");
    }
    const code = pricePlanCodeForShowtime(startAt);
    const plan = await findPlan({ code, version: planVersion, status: "ACTIVE" });
    if (
      !plan || plan.code !== code || plan.version !== planVersion || plan.status !== "ACTIVE" ||
      plan.currency !== "VND" || !mongoose.isObjectIdOrHexString(plan._id) ||
      !seatTypes.every((type) => Number.isSafeInteger(plan.seatTypePrices?.[type]) && plan.seatTypePrices[type] >= 0)
    ) {
      throw new TicketPricingUnavailableError(`Configure the complete ACTIVE ${code} v${planVersion} before publishing`);
    }
    return {
      ticketPricePlanId: plan._id,
      currency: plan.currency,
      seatTypePrices: Object.fromEntries(seatTypes.map((type) => [type, plan.seatTypePrices[type]])),
    };
  },
});

export const ticketPricingService = createTicketPricingService();
