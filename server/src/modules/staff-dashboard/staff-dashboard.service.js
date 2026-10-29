import { localDateOf, localDateRangeToUtc } from "../../utils/local-date.js";
import { readStaffCounterActivity } from "./staff-dashboard.repository.js";

export const createStaffDashboardService =
  ({
    activityReader = readStaffCounterActivity,
    clock = () => new Date(),
  } = {}) =>
  async ({ staffId, now = clock() }) => {
    const localDate = localDateOf(now);
    const { from, to } = localDateRangeToUtc(localDate, localDate);
    const { bookings, orders } = await activityReader({ staffId, from, to });
    const activity = [
      ...bookings.map((item) => ({
        id: item._id.toString(),
        type: "TICKET",
        reference: item.bookingCode,
        amount: item.totalAmount,
        quantity: item.seatIds?.length ?? 0,
        occurredAt: item.confirmedAt,
      })),
      ...orders.map((item) => ({
        id: item._id.toString(),
        type: "CONCESSION",
        reference: item.orderCode,
        amount: item.totalAmount,
        quantity:
          item.items?.reduce((sum, line) => sum + (line.quantity ?? 0), 0) ?? 0,
        occurredAt: item.paidAt,
      })),
    ]
      .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))
      .slice(0, 5);

    return {
      date: localDate,
      metrics: {
        ticketSales: bookings.reduce(
          (sum, item) => sum + (item.seatIds?.length ?? 0),
          0,
        ),
        concessionOrders: orders.length,
        transactions: bookings.length + orders.length,
        grossAmount: [...bookings, ...orders].reduce(
          (sum, item) => sum + (item.totalAmount ?? 0),
          0,
        ),
      },
      activity,
    };
  };

export const getStaffDashboard = createStaffDashboardService();
