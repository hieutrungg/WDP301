import assert from "node:assert/strict";
import { fixture, expireCheckout } from "./fixture.mjs";

const visible = async (locator) =>
  locator.first().waitFor({ state: "visible" });
const textIncludes = async (locator, text) => {
  await visible(locator.filter({ hasText: text }));
};
const request = async (page, method, path, data, status = 200, errorCode) => {
  const response = await page.request.fetch(`/api${path}`, {
    method,
    ...(data === undefined ? {} : { data }),
  });
  assert.equal(
    response.status(),
    status,
    `${method} ${path}: unexpected HTTP status`,
  );
  const body = await response.json();
  if (errorCode) assert.equal(body.code, errorCode);
  return body.data;
};
async function login(page, f, other = false) {
  await page
    .getByLabel("Email or username", { exact: true })
    .fill(other ? f.otherUsername : f.username);
  try {
    await page.locator("#login-password").fill(f.password);
  } catch {
    throw new Error("Login password control unavailable (value suppressed)");
  }
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await page.waitForURL((url) => url.pathname !== "/login");
}
async function begin(env, label) {
  const { page, db } = env;
  const f = await fixture(db, label);
  await page.goto(`/movies?q=${encodeURIComponent(f.title)}`);
  await page.locator(`a[href="/movies/${f.movie}"]`).first().click();
  await visible(page.getByRole("heading", { name: f.title, exact: true }));
  await page.getByRole("link", { name: "View Showtimes" }).click();
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(f.startAt);
  await page.getByRole("button", { name: "Select Another Date" }).click();
  await page.getByLabel("Select a show date").fill(date);
  await page
    .getByRole("combobox", { name: "Select a branch" })
    .selectOption(String(f.branch));
  await page.getByRole("button").filter({ hasText: f.title }).first().click();
  await page
    .getByRole("button", { name: "Continue to seat selection" })
    .click();
  await page.waitForURL("**/login");
  await login(page, f);
  await page.waitForURL(`**/booking/${f.showtime}/seats`);
  await page
    .getByRole("button", { name: "A1, STANDARD, Available", exact: true })
    .click();
  await textIncludes(page.locator("main"), f.branchName);
  await textIncludes(page.locator("main"), f.title);
  await textIncludes(
    page.locator("main"),
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
    }).format(f.startAt),
  );
  await textIncludes(page.locator("main"), /90[,.]000/);
  await page.getByRole("button", { name: "Lock seats & continue" }).click();
  await page.waitForURL(`**/booking/${f.showtime}/concessions`);
  await visible(
    page.getByRole("button", { name: `Add one ${f.popcornName}`, exact: true }),
  );
  f.hold = await db
    .collection("seat_holds")
    .findOne({ ownerId: f.owner, showtimeId: f.showtime });
  assert.ok(f.hold, "UI acquired a durable hold");
  assert.equal(f.hold.priceSnapshot.totalAmount, 90000);
  assert.equal(f.hold.status, "ACTIVE");
  assert.equal(String(f.hold.seatIds[0]), String(f.seats[0]._id));
  return f;
}
async function selectFood(page, f, combo = true) {
  await page
    .getByRole("button", { name: `Add one ${f.popcornName}`, exact: true })
    .click();
  if (combo) {
    await page.getByRole("button", { name: "Combos", exact: true }).click();
    await page
      .getByRole("button", { name: `Add one ${f.comboName}`, exact: true })
      .click();
  }
  const quoteResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/concession-checkout/quote") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Review prices", exact: true })
    .click();
  const quote = (await (await quoteResponse).json()).data;
  assert.equal(quote.branchId, String(f.branch));
  assert.equal(quote.ticketAmount, 90000);
  assert.equal(quote.concessionAmount, combo ? 80000 : 30000);
  assert.equal(quote.amount, combo ? 170000 : 120000);
  await page
    .getByRole("button", { name: "Confirm selection & continue" })
    .click();
  await page.waitForURL("**/checkout");
  return quote;
}
async function pay(page) {
  await page
    .getByRole("button", { name: "Complete Payment", exact: true })
    .click();
  await visible(
    page.getByRole("button", {
      name: "Simulate successful payment",
      exact: true,
    }),
  );
}
async function state(db, f) {
  const booking = await db
    .collection("bookings")
    .findOne({ holdId: f.hold._id });
  return {
    booking,
    hold: await db.collection("seat_holds").findOne({ _id: f.hold._id }),
    seat: await db
      .collection("showtime_seats")
      .findOne({ showtimeId: f.showtime, seatId: f.seats[0]._id }),
    order:
      booking &&
      (await db.collection("orders").findOne({ bookingId: booking._id })),
    payment:
      booking &&
      (await db.collection("payments").findOne({ bookingId: booking._id })),
    reservation:
      booking &&
      (await db
        .collection("inventory_reservations")
        .findOne({ bookingId: booking._id })),
    stock: await db
      .collection("inventories")
      .findOne({ branchId: f.branch, concessionId: f.popcorn }),
  };
}
async function assertConfirmed(db, f, food) {
  const s = await state(db, f);
  assert.equal(s.booking.status, "CONFIRMED");
  assert.equal(s.payment.status, "PAID");
  assert.equal(s.hold.status, "CONSUMED");
  assert.equal(s.seat.state, "SOLD");
  assert.equal(String(s.seat.bookingId), String(s.booking._id));
  assert.equal(s.booking.totalAmount, food ? 170000 : 90000);
  assert.equal(s.payment.amount, s.booking.totalAmount);
  assert.equal(+s.booking.expiresAt, +f.hold.expiresAt);
  assert.equal(+s.payment.expiresAt, +f.hold.expiresAt);
  assert.equal(
    await db.collection("bookings").countDocuments({ holdId: f.hold._id }),
    1,
  );
  assert.equal(
    await db
      .collection("payments")
      .countDocuments({ bookingId: s.booking._id }),
    1,
  );
  assert.equal(
    await db.collection("orders").countDocuments({ bookingId: s.booking._id }),
    food ? 1 : 0,
  );
  assert.equal(
    await db
      .collection("inventory_reservations")
      .countDocuments({ bookingId: s.booking._id }),
    food ? 1 : 0,
  );
  const sales = await db
    .collection("stock_transactions")
    .find({ bookingId: s.booking._id })
    .toArray();
  assert.equal(sales.length, food ? 2 : 0);
  if (food) {
    assert.equal(s.order.status, "CONFIRMED");
    assert.equal(s.order.paymentStatus, "PAID");
    assert.equal(s.order.pickupStatus, "AWAITING_PICKUP");
    assert.equal(s.reservation.status, "CONSUMED");
    assert.equal(s.stock.quantity, 17);
    assert.equal(s.stock.reservedQuantity, 0);
    const water = await db
      .collection("inventories")
      .findOne({ branchId: f.branch, concessionId: f.water });
    assert.equal(water.quantity, 19);
    for (const sale of sales)
      assert.equal(String(sale.recordedBy), String(f.owner));
    assert.equal(
      (
        await db
          .collection("inventories")
          .findOne({ branchId: f.otherBranch, concessionId: f.popcorn })
      ).quantity,
      99,
    );
  }
  assert.equal(
    await db.collection("tickets").countDocuments({ bookingId: s.booking._id }),
    0,
    "Ticket module remains a demo boundary",
  );
  return s;
}
async function success(page) {
  await page
    .getByRole("button", { name: "Simulate successful payment", exact: true })
    .click();
  await page.waitForURL("**/confirmation/**");
}

export const cases = [
  [
    "01 Public login continuation and Skip payment exactly once",
    async (env) => {
      const f = await begin(env, "skip");
      const { page, db } = env;
      await page.getByRole("button", { name: "Skip food & continue" }).click();
      await page.waitForURL("**/checkout");
      await textIncludes(page.locator("main"), /90[,.]000/);
      await pay(page);
      const before = await state(db, f);
      assert.equal(before.booking.concessionAmount ?? 0, 0);
      assert.equal(before.order, null);
      await success(page);
      let s = await assertConfirmed(db, f, false);
      const attempt = s.payment.attempts.at(-1);
      await request(
        page,
        "POST",
        `/payments/${s.payment._id}/attempts/${attempt.attemptId}/simulate`,
        {
          outcome: "SUCCESS",
          notificationKey: `ui-confirm:${attempt.attemptId}`,
        },
      );
      s = await assertConfirmed(db, f, false);
      assert.equal(s.stock.quantity, 20);
      await page.reload();
      await textIncludes(page.locator("main"), f.title);
    },
  ],
  [
    "02 Food combo shared components snapshots and idempotent replay",
    async (env) => {
      const f = await begin(env, "food");
      const { page, db } = env;
      assert.equal(
        await page.getByRole("combobox").count(),
        1,
        "Only category selection; branch is locked",
      );
      await page
        .getByRole("button", { name: `Add one ${f.popcornName}`, exact: true })
        .click();
      await page
        .getByRole("button", { name: `Add one ${f.popcornName}`, exact: true })
        .click();
      await page
        .getByRole("button", {
          name: `Remove one ${f.popcornName}`,
          exact: true,
        })
        .click();
      assert.equal(
        await page
          .getByLabel(`Quantity ${f.popcornName}`, { exact: true })
          .textContent(),
        "1",
      );
      await page
        .getByRole("button", {
          name: `Remove one ${f.popcornName}`,
          exact: true,
        })
        .click();
      assert.equal(
        await page
          .getByLabel(`Quantity ${f.popcornName}`, { exact: true })
          .textContent(),
        "0",
      );
      const quote = await selectFood(page, f);
      assert.equal(
        await db
          .collection("inventory_reservations")
          .countDocuments({ ownerId: f.owner }),
        0,
      );
      const bookingPosts = [];
      page.on("request", (r) => {
        if (
          new URL(r.url()).pathname === "/api/bookings" &&
          r.method() === "POST"
        )
          bookingPosts.push(r.postDataJSON());
      });
      await pay(page);
      let s = await state(db, f);
      assert.equal(s.stock.quantity, 20);
      assert.equal(s.stock.reservedQuantity, 3);
      assert.equal(s.order.totalAmount, quote.concessionAmount);
      assert.equal(s.order.pickupStatus, "NOT_READY");
      assert.equal(
        await page.getByText(s.order.orderCode, { exact: true }).count(),
        0,
      );
      assert.equal(
        await page.getByText("Awaiting pickup", { exact: true }).count(),
        0,
      );
      const replay = await request(page, "POST", "/bookings", bookingPosts[0]);
      assert.equal(replay.bookingId, String(s.booking._id));
      await success(page);
      s = await assertConfirmed(db, f, true);
      const attempt = s.payment.attempts.at(-1);
      await request(
        page,
        "POST",
        `/payments/${s.payment._id}/attempts/${attempt.attemptId}/simulate`,
        {
          outcome: "SUCCESS",
          notificationKey: `ui-confirm:${attempt.attemptId}`,
        },
      );
      await request(
        page,
        "POST",
        `/payments/${s.payment._id}/attempts/${attempt.attemptId}/simulate`,
        { outcome: "SUCCESS", notificationKey: "e2e-new-notification" },
      );
      await assertConfirmed(db, f, true);
      await db
        .collection("concessions")
        .updateOne(
          { _id: f.popcorn },
          { $set: { name: "Renamed after purchase", price: 99000 } },
        );
      await page.reload();
      await textIncludes(
        page.getByRole("region", { name: "Food order" }),
        f.popcornName,
      );
      await textIncludes(
        page.getByRole("region", { name: "Food order" }),
        s.order.orderCode,
      );
      await page.goto("/booking-history");
      await page
        .getByRole("button", { name: "Xem Chi Tiết & QR", exact: true })
        .click();
      await textIncludes(
        page.getByRole("region", { name: "Food order" }),
        f.popcornName,
      );
      await textIncludes(
        page.getByRole("region", { name: "Food order" }),
        s.order.orderCode,
      );
    },
  ],
  [
    "03 Reload back navigation and account showtime tab isolation",
    async (env) => {
      const f = await begin(env, "reload");
      const { page, db, context, browser, baseURL } = env;
      await page
        .getByRole("button", { name: `Add one ${f.popcornName}`, exact: true })
        .click();
      await page.reload();
      await visible(
        page.getByLabel(`Quantity ${f.popcornName}`, { exact: true }),
      );
      assert.equal(
        await page
          .getByLabel(`Quantity ${f.popcornName}`, { exact: true })
          .textContent(),
        "1",
      );
      assert.equal(+(await state(db, f)).hold.expiresAt, +f.hold.expiresAt);
      await page
        .getByRole("button", { name: "Review prices", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Confirm selection & continue" })
        .click();
      await page.waitForURL("**/checkout");
      await page.reload();
      await textIncludes(page.locator("main"), /120[,.]000/);
      await page.goBack();
      await page.waitForURL("**/concessions");
      await visible(
        page.getByLabel(`Quantity ${f.popcornName}`, { exact: true }),
      );
      assert.equal(
        await page
          .getByLabel(`Quantity ${f.popcornName}`, { exact: true })
          .textContent(),
        "1",
      );
      assert.equal(+(await state(db, f)).hold.expiresAt, +f.hold.expiresAt);
      const freshTab = await context.newPage();
      await freshTab.goto(`/booking/${f.showtime}/checkout`);
      await textIncludes(freshTab.locator("main"), "Select seats");
      await freshTab.close();
      const otherContext = await browser.newContext({ baseURL });
      try {
        const other = await otherContext.newPage();
        await other.goto(`/booking/${f.showtime}/checkout`);
        await other.waitForURL("**/login");
        await login(other, f, true);
        await textIncludes(other.locator("main"), "Select seats");
      } finally {
        await otherContext.close();
      }
      const differentShowtime = await fixture(db, "other-showtime");
      await page.goto(`/booking/${differentShowtime.showtime}/checkout`);
      await textIncludes(page.locator("main"), "Select seats");
      // Reuse the same tab's existing storage while switching identity through real Login.
      await request(page, "POST", "/auth/logout", {});
      await page.goto(`/booking/${f.showtime}/checkout`);
      await page.waitForURL("**/login");
      await login(page, f, true);
      await textIncludes(page.locator("main"), "Select seats");
      await request(page, "POST", "/auth/logout", {});
      await page.goto(`/booking/${f.showtime}/concessions`);
      await page.waitForURL("**/login");
      await login(page, f);
      await visible(
        page.getByLabel(`Quantity ${f.popcornName}`, { exact: true }),
      );
      assert.equal(
        await page
          .getByLabel(`Quantity ${f.popcornName}`, { exact: true })
          .textContent(),
        "1",
      );
      assert.equal(+(await state(db, f)).hold.expiresAt, +f.hold.expiresAt);
      assert.equal(
        await db.collection("seat_holds").countDocuments({ ownerId: f.owner }),
        1,
      );
    },
  ],
  [
    "04 Failed and cancelled attempts retry within original expiry",
    async (env) => {
      const f = await begin(env, "retry");
      const { page, db } = env;
      await selectFood(page, f);
      await pay(page);
      await page
        .getByRole("button", { name: "Simulate failure", exact: true })
        .click();
      await textIncludes(page.getByRole("dialog"), "FAILED");
      await page
        .getByRole("button", { name: "Cancel attempt & return", exact: true })
        .click();
      await page.reload();
      await visible(
        page.getByRole("button", { name: "Complete Payment", exact: true }),
      );
      await pay(page);
      const pendingBeforeReload = (await state(db, f)).payment.attempts.at(-1);
      await page.reload();
      await pay(page);
      const recovered = await state(db, f);
      assert.equal(recovered.payment.attempts.length, 2);
      assert.equal(
        recovered.payment.attempts.at(-1).attemptId,
        pendingBeforeReload.attemptId,
      );
      await page
        .getByRole("button", { name: "Cancel attempt & return", exact: true })
        .click();
      await visible(
        page.getByRole("button", { name: "Complete Payment", exact: true }),
      );
      let s = await state(db, f);
      assert.equal(s.booking.status, "PENDING_PAYMENT");
      assert.equal(s.reservation.status, "ACTIVE");
      assert.equal(s.hold.status, "ACTIVE");
      assert.equal(+s.hold.expiresAt, +f.hold.expiresAt);
      await pay(page);
      await success(page);
      s = await assertConfirmed(db, f, true);
      assert.deepEqual(
        s.payment.attempts.map((a) => a.status),
        ["FAILED", "CANCELLED", "SUCCEEDED"],
      );
    },
  ],
  [
    "05 Cancel entire checkout releases seats and food reservation",
    async (env) => {
      const f = await begin(env, "cancel");
      const { page, db } = env;
      await selectFood(page, f);
      await pay(page);
      await page
        .getByRole("button", { name: "Cancel attempt & return", exact: true })
        .click();
      await page
        .getByRole("button", {
          name: "Cancel entire checkout & release reservations",
          exact: true,
        })
        .click();
      await page.waitForURL("**/seats");
      const s = await state(db, f);
      assert.equal(s.booking.status, "EXPIRED");
      assert.equal(s.order.status, "EXPIRED");
      assert.equal(s.reservation.status, "RELEASED");
      assert.equal(s.seat.state, "AVAILABLE");
      assert.equal(s.stock.quantity, 20);
      assert.equal(s.stock.reservedQuantity, 0);
      assert.equal(
        await db
          .collection("stock_transactions")
          .countDocuments({ bookingId: s.booking._id }),
        0,
      );
      assert.equal(
        await db
          .collection("tickets")
          .countDocuments({ bookingId: s.booking._id }),
        0,
      );
      await request(
        page,
        "POST",
        `/bookings/${s.booking._id}/cancel-checkout`,
        {},
      );
      assert.equal((await state(db, f)).stock.reservedQuantity, 0);
    },
  ],
  [
    "06 Shortage recovery Skip unavailable and special offer",
    async (env) => {
      const f = await begin(env, "shortage");
      const { page, db } = env;
      await textIncludes(
        page.locator("article").filter({ hasText: f.unavailableName }),
        "Unavailable",
      );
      assert.equal(
        await page
          .getByRole("button", {
            name: `Add one ${f.unavailableName}`,
            exact: true,
          })
          .isDisabled(),
        true,
      );
      await textIncludes(
        page.locator("article").filter({ hasText: f.waterName }),
        "Special offer",
      );
      await selectFood(page, f);
      // External stock movement after quote, before checkout (only in the disposable DB).
      await db
        .collection("inventories")
        .updateOne(
          { branchId: f.branch, concessionId: f.popcorn },
          { $set: { quantity: 1 } },
        );
      const rejected = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === "/api/bookings" &&
          r.request().method() === "POST",
      );
      await page
        .getByRole("button", { name: "Complete Payment", exact: true })
        .click();
      const response = await rejected;
      assert.equal(response.status(), 409);
      assert.equal(
        (await response.json()).code,
        "INSUFFICIENT_CONCESSION_STOCK",
      );
      assert.equal((await state(db, f)).hold.status, "ACTIVE");
      assert.equal(
        await db.collection("bookings").countDocuments({ holdId: f.hold._id }),
        0,
      );
      await page
        .getByRole("link", { name: "Edit food selection or skip", exact: true })
        .click();
      await page.getByRole("button", { name: "Skip food & continue" }).click();
      await pay(page);
      await success(page);
      await assertConfirmed(db, f, false);
    },
  ],
  [
    "07 Expired hold blocks booking and late successful payment requires review",
    async (env) => {
      const f = await begin(env, "expired");
      const { page, db } = env;
      await selectFood(page, f);
      await pay(page);
      let s = await state(db, f);
      const attempt = s.payment.attempts.at(-1);
      await expireCheckout(db, f.hold._id);
      const result = await request(
        page,
        "POST",
        `/payments/${s.payment._id}/attempts/${attempt.attemptId}/simulate`,
        { outcome: "SUCCESS", notificationKey: "e2e-late-success" },
      );
      assert.equal(result.payment.status, "REVIEW_REQUIRED");
      s = await state(db, f);
      assert.equal(s.booking.status, "EXPIRED");
      assert.equal(s.order.status, "EXPIRED");
      assert.equal(s.order.pickupStatus, "NOT_READY");
      assert.equal(s.reservation.status, "RELEASED");
      assert.equal(
        await db
          .collection("tickets")
          .countDocuments({ bookingId: s.booking._id }),
        0,
      );
      assert.equal(s.seat.state, "AVAILABLE");
      assert.equal(s.stock.quantity, 20);
      assert.equal(s.stock.reservedQuantity, 0);
      assert.equal(
        await db
          .collection("stock_transactions")
          .countDocuments({ bookingId: s.booking._id }),
        0,
      );
      await page.goto(`/booking/${f.showtime}/confirmation/${s.booking._id}`);
      await textIncludes(page.locator("main"), /review|kiểm tra/i);
      assert.equal(
        await page.getByText(s.order.orderCode, { exact: true }).count(),
        0,
      );
      assert.equal(
        await page.getByText("Awaiting pickup", { exact: true }).count(),
        0,
      );
      await request(page, "POST", "/auth/logout", {});
      const g = await begin(env, "expired-before-booking");
      await expireCheckout(db, g.hold._id);
      await request(
        page,
        "POST",
        "/bookings",
        { holdId: String(g.hold._id), requestKey: "e2e-expired-request" },
        409,
      );
      await page.reload();
      await textIncludes(page.locator("main"), /expired/i);
      assert.equal(
        await db.collection("bookings").countDocuments({ holdId: g.hold._id }),
        0,
      );
    },
  ],
  [
    "08 Backend ownership guest rejection and client amount branch tampering",
    async (env) => {
      const f = await begin(env, "security");
      const { page, db, browser, baseURL } = env;
      const items = [
        { itemType: "CONCESSION", itemId: String(f.popcorn), quantity: 1 },
      ];
      for (const extra of [
        { branchId: String(f.otherBranch) },
        { amount: 1 },
        { totalAmount: 1 },
        { price: 1 },
      ]) {
        await request(
          page,
          "POST",
          "/concession-checkout/quote",
          { holdId: String(f.hold._id), items, ...extra },
          400,
        );
      }
      await request(
        page,
        "POST",
        "/concession-checkout/quote",
        { holdId: String(f.hold._id), items: [{ ...items[0], price: 1 }] },
        400,
      );
      await selectFood(page, f);
      await pay(page);
      const s = await state(db, f);
      await request(
        page,
        "POST",
        "/payments",
        {
          bookingId: String(s.booking._id),
          method: "MOMO_WALLET",
          amount: 1,
          idempotencyKey: "e2e-tampered-price",
        },
        400,
        "PAYMENT_AMOUNT_MISMATCH",
      );
      const isolated = await browser.newContext({ baseURL });
      try {
        const other = await isolated.newPage();
        const paths = [
          ["GET", `/payments/bookings/${s.booking._id}`, undefined],
          ["POST", `/bookings/${s.booking._id}/cancel-checkout`, {}],
          [
            "POST",
            "/concession-checkout/quote",
            { holdId: String(f.hold._id), items },
          ],
          [
            "POST",
            "/bookings",
            { holdId: String(f.hold._id), requestKey: "e2e-another-owner" },
          ],
          [
            "POST",
            `/payments/${s.payment._id}/attempts/${s.payment.attempts[0].attemptId}/simulate`,
            { outcome: "SUCCESS" },
          ],
          ["DELETE", `/seat-holds/${f.hold._id}`, undefined],
        ];
        for (const [method, path, data] of paths)
          await request(other, method, path, data, 401);
        await other.goto("/login");
        await login(other, f, true);
        for (const [method, path, data] of paths) {
          // Hold reads intentionally hide other ownership as an unavailable/expired hold.
          const hiddenHold =
            path === "/concession-checkout/quote" || path === "/bookings";
          await request(other, method, path, data, hiddenHold ? 409 : 403);
        }
      } finally {
        await isolated.close();
      }
      const after = await state(db, f);
      assert.equal(after.booking.status, "PENDING_PAYMENT");
      assert.equal(after.booking.totalAmount, 170000);
      assert.equal(after.payment.amount, 170000);
      assert.equal(after.stock.reservedQuantity, 3);
    },
  ],
];
