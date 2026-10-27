import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import { createStaffDashboardService } from "../src/modules/staff-dashboard/staff-dashboard.service.js";

test("Staff Dashboard summarizes only the supplied Staff activity for the local day", async () => {
  const staffId = new mongoose.Types.ObjectId().toString();
  let range;
  const getDashboard = createStaffDashboardService({
    clock: () => new Date("2026-10-27T03:00:00.000Z"),
    activityReader: async (query) => {
      range = query;
      return {
        bookings: [
          {
            _id: new mongoose.Types.ObjectId(),
            bookingCode: "FC-001",
            seatIds: [
              new mongoose.Types.ObjectId(),
              new mongoose.Types.ObjectId(),
            ],
            totalAmount: 210000,
            confirmedAt: new Date("2026-10-27T02:55:00.000Z"),
          },
        ],
        orders: [
          {
            _id: new mongoose.Types.ObjectId(),
            orderCode: "FD-001",
            items: [{ quantity: 2 }, { quantity: 1 }],
            totalAmount: 94000,
            paidAt: new Date("2026-10-27T02:58:00.000Z"),
          },
        ],
      };
    },
  });

  const result = await getDashboard({ staffId });

  assert.equal(range.staffId, staffId);
  assert.equal(range.from.toISOString(), "2026-10-26T17:00:00.000Z");
  assert.equal(range.to.toISOString(), "2026-10-27T17:00:00.000Z");
  assert.deepEqual(result.metrics, {
    ticketSales: 2,
    concessionOrders: 1,
    transactions: 2,
    grossAmount: 304000,
  });
  assert.equal(result.activity[0].type, "CONCESSION");
  assert.equal(result.activity[0].quantity, 3);
  assert.equal(result.activity[1].type, "TICKET");
});
