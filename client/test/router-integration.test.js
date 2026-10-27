import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let vite, AppRoutes, authStore;
const originalStorage = globalThis.sessionStorage;
before(async () => {
  globalThis.sessionStorage = { getItem: () => null };
  vite = await createServer({
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
  });
  ({ AppRoutes } = await vite.ssrLoadModule("/src/app/router/index.jsx"));
  ({ useAuthStore: authStore } = await vite.ssrLoadModule(
    "/src/features/auth/store/authStore.js",
  ));
});
after(async () => {
  if (vite) await vite.close();
  globalThis.sessionStorage = originalStorage;
});
const actor = (role, permissions = []) => ({
  id: "222222222222222222222222",
  username: "navigation-test",
  roles: [{ name: role }],
  permissions: permissions.map((name) => ({ name })),
});
function render(path, account = null, initialized = true) {
  const initial = authStore.getInitialState();
  const previous = { ...initial };
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  Object.assign(initial, { account, initialized });
  try {
    return renderToString(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          MemoryRouter,
          { initialEntries: [path] },
          createElement(AppRoutes),
        ),
      ),
    );
  } finally {
    Object.assign(initial, previous);
    client.clear();
  }
}

test("INT-FE-001 public catalog and unknown links resolve to real pages", () => {
  assert.match(render("/concessions?kind=combos"), /Movie time/);
  assert.match(render("/unknown-page"), /404.*Page not found/);
  const html = render("/concessions");
  assert.match(html, /href="\/concessions"/);
  assert.doesNotMatch(html, /href="\/#offers"/);
});
test("INT-FE-001 Staff menu mounts only inside the Staff role shell", () => {
  const html = render("/staff/concessions", actor("STAFF"));
  // The sidebar also says "Sell Concessions", so match the POS page heading itself.
  assert.match(html, /Counter F&amp;B POS/);
  assert.match(html, /<h1[^>]*>Sell Concessions<\/h1>/);
  assert.doesNotMatch(html, /404.*Page not found/);
  assert.match(render("/staff/concessions", actor("CUSTOMER")), /403/);
});
test("INT-FE-001 existing Manager navigation and permissions survive integration", () => {
  const account = actor("MANAGER", [
    "room.manage",
    "inventory.view",
    "movie.update",
    "shift.view",
  ]);
  const rooms = render("/manager/rooms", account);
  assert.match(rooms, /Facilities &amp; rooms/);
  for (const path of [
    "/manager/movies",
    "/manager/showtimes",
    "/manager/rooms",
    "/manager/seat-maps",
    "/manager/inventory",
    "/manager/staff-shifts",
  ])
    assert.ok(rooms.includes(`href="${path}"`), path);
  assert.match(
    render("/manager/staff-shifts", account),
    /Human resources &amp; operations/,
  );
  assert.match(
    render("/manager/movies", account),
    /Movie catalog &amp; distribution/,
  );
  assert.match(render("/manager/rooms", actor("MANAGER")), /403/);
  assert.match(
    render("/manager/rooms", actor("STAFF", ["room.manage"])),
    /403/,
  );
  const createOnly = render(
    "/manager/movies/new",
    actor("MANAGER", ["movie.create"]),
  );
  assert.match(createOnly, /href="\/manager\/movies\/new"/);
});
test("INT-FE-001 protected customer checkout, confirmation and history remain mounted", () => {
  const account = actor("CUSTOMER");
  assert.match(
    render("/booking/111111111111111111111111/checkout", account),
    /Select seats to begin checkout/,
  );
  for (const path of [
    "/my-tickets",
    "/booking-history",
    "/bookings/111111111111111111111111/confirmation",
    "/booking/111111111111111111111111/confirmation/333333333333333333333333",
  ]) {
    const html = render(path, account);
    assert.doesNotMatch(html, /404.*Page not found/);
    assert.match(html, /F-Cinema/);
  }
});
test("INT-FE-001 Admin and Staff permission boundaries remain enforced by frontend guards", () => {
  assert.match(
    render("/admin/rooms", actor("CUSTOMER", ["branch.manage", "room.view"])),
    /403/,
  );
  assert.doesNotMatch(
    render("/admin/rooms", actor("ADMIN", ["branch.manage", "room.view"])),
    /403.*Forbidden/,
  );
  assert.match(render("/staff/inventory", actor("STAFF")), /403/);
  assert.doesNotMatch(
    render("/staff/inventory", actor("STAFF", ["inventory.view"])),
    /403.*Forbidden/,
  );
});


test('CON-102 food selection is a real Customer route with Staff and Guest guards', () => {
  const path='/booking/111111111111111111111111/concessions'
  assert.match(render(path,actor('CUSTOMER')), /Select seats first/)
  assert.doesNotMatch(render(path), /Select seats first/)
  assert.match(render(path,actor('STAFF')), /Access denied|403|permission/i)
})

test("TICKET-001 C17 fullscreen E-Ticket requires a session and renders outside the site shell", () => {
  const path = "/tickets/333333333333333333333333";
  const customer = render(path, actor("CUSTOMER"));
  assert.match(customer, /Loading your E-Ticket/);
  assert.doesNotMatch(customer, /404.*Page not found/);
  assert.doesNotMatch(render(path), /Loading your E-Ticket/);
});
