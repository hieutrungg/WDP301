import { z } from "zod";
import { TOOL_KIND, FAQ_CACHE_TTL_SECONDS } from "../ai.constants.js";

// AI-001 tool catalog. Every tool maps onto an existing REST API, called with the chatting
// person's own session (tools/api-caller.js), so route guards, branch scope and ownership checks
// apply unchanged. `roles` / `permissions` mirror each route's requireRole / requirePermission and
// only decide which tools the model is offered; the API stays the security boundary.
//
// Fields:
//   kind            read: runs at once. write: becomes a PendingAction the user must confirm.
//   roles           null = everyone (also guests); otherwise the actor needs one of these roles.
//   requiresAccount true = signed-in only.
//   permissions     all must be granted.
//   cacheTtlSeconds > 0 = public data; an answer built only from such tools may be cached.
//   local           handled inside the AI module (vector search) instead of the REST API.
//   precheck        write tools only: a read call that must pass before a confirmation card is
//                   created ({ request(args), evaluate(data) → { ok, code?, hint? } }).

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Must be a 24-character ObjectId");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD (Vietnam local date)");
const page = z.number().int().min(1).max(100).optional();
const text = (max) => z.string().trim().min(1).max(max);
const id = (value) => encodeURIComponent(value);

// Reasons from GET /api/movies/:id/review-eligibility (REV-102, Hiếu), explained for the model.
const REVIEW_REFUSAL_HINT = Object.freeze({
  NO_ELIGIBLE_BOOKING:
    "No review card was created. The customer can only review a movie after buying a ticket for it (paid, not refunded) and after that showtime has ended. Explain this kindly.",
  ALREADY_REVIEWED:
    "No review card was created. The customer already reviewed this movie; they can edit it on the movie page /movies/<movieId>.",
  AUTHOR_NAME_REQUIRED:
    "No review card was created. The customer needs a full name in their profile first; offer update_my_profile.",
});

const tool = (definition) => Object.freeze({
  kind: TOOL_KIND.READ,
  roles: null,
  requiresAccount: false,
  permissions: [],
  cacheTtlSeconds: 0,
  local: null,
  precheck: null,
  ...definition,
});

export const TOOLS = Object.freeze([
  // --- Everyone, guests included -------------------------------------------------------------
  tool({
    name: "search_knowledge",
    description:
      "Search F-Cinema policies and FAQ (seat holding, payment, refunds, e-tickets, check-in, food & drink, accounts, reviews). Use before answering any policy question.",
    schema: z.strictObject({ query: text(300).describe("The question, in the user's words") }),
    local: "knowledge",
    cacheTtlSeconds: FAQ_CACHE_TTL_SECONDS,
  }),
  tool({
    name: "recommend_movies",
    description:
      "Find currently published movies that match a free-text description (mood, audience, genre, actor). Returns live movie data.",
    schema: z.strictObject({ description: text(300) }),
    local: "movies",
    cacheTtlSeconds: 600,
  }),
  tool({
    name: "search_movies",
    description: "List published movies, optionally filtered by title keyword, genre or language.",
    schema: z.strictObject({
      q: z.string().trim().max(100).optional(),
      genre: z.string().trim().max(60).optional(),
      language: z.string().trim().max(60).optional(),
      page,
    }),
    request: ({ q, genre, language, page: pageNumber }) => ({
      method: "GET",
      path: "/movies",
      query: { q, genre, language, page: pageNumber, limit: 12 },
    }),
    cacheTtlSeconds: 300,
  }),
  tool({
    name: "get_movie",
    description: "Get one published movie's details (synopsis, cast, duration, age rating).",
    schema: z.strictObject({ movieId: objectId }),
    request: ({ movieId }) => ({ method: "GET", path: `/movies/${id(movieId)}` }),
    cacheTtlSeconds: 300,
  }),
  tool({
    name: "list_cinemas",
    description: "List F-Cinema branches (cinemaId, name, address).",
    schema: z.strictObject({ q: z.string().trim().max(100).optional() }),
    request: ({ q }) => ({ method: "GET", path: "/cinemas", query: { q, limit: 50 } }),
    cacheTtlSeconds: 3600,
  }),
  tool({
    name: "list_showtimes",
    description:
      "List bookable showtimes, filtered by movie, cinema and/or Vietnam local date. Times in results are UTC.",
    schema: z.strictObject({
      movieId: objectId.optional(),
      cinemaId: objectId.optional(),
      date: date.optional(),
      page,
    }),
    request: ({ movieId, cinemaId, date: day, page: pageNumber }) => ({
      method: "GET",
      path: "/showtimes",
      query: { movieId, cinemaId, date: day, page: pageNumber, limit: 30 },
    }),
    cacheTtlSeconds: 60,
  }),
  tool({
    name: "list_combos",
    description: "List food & drink combos sold at one cinema branch.",
    schema: z.strictObject({ branchId: objectId }),
    request: ({ branchId }) => ({ method: "GET", path: "/combos", query: { branchId, limit: 50 } }),
    cacheTtlSeconds: 300,
  }),
  tool({
    name: "list_concessions",
    description: "List single food & drink items sold at one cinema branch.",
    schema: z.strictObject({ branchId: objectId }),
    request: ({ branchId }) => ({
      method: "GET",
      path: "/concessions",
      query: { branchId, limit: 50 },
    }),
    cacheTtlSeconds: 300,
  }),
  tool({
    name: "list_movie_reviews",
    description: "Read approved public reviews of a movie.",
    schema: z.strictObject({ movieId: objectId, page }),
    request: ({ movieId, page: pageNumber }) => ({
      method: "GET",
      path: `/movies/${id(movieId)}/reviews`,
      query: { page: pageNumber },
    }),
    cacheTtlSeconds: 300,
  }),

  // --- Signed-in accounts ----------------------------------------------------------------------
  tool({
    name: "get_seat_availability",
    description:
      "Seat map of one showtime with each seat's state (AVAILABLE, HELD, SOLD) and price. Use to tell the user which seats are free before sending them to /booking/<showtimeId>/seats.",
    schema: z.strictObject({ showtimeId: objectId }),
    requiresAccount: true,
    request: ({ showtimeId }) => ({ method: "GET", path: `/showtimes/${id(showtimeId)}/seats` }),
  }),
  tool({
    name: "get_my_profile",
    description: "The signed-in user's own profile (name, phone, roles).",
    schema: z.strictObject({}),
    requiresAccount: true,
    request: () => ({ method: "GET", path: "/auth/me" }),
  }),
  tool({
    name: "update_my_profile",
    kind: TOOL_KIND.WRITE,
    description:
      "Change the signed-in user's own full name and/or phone number. Needs the user's confirmation. These are the ONLY profile fields F-Cinema can change: birthday, gender, address and interests cannot be saved anywhere in the app yet (say so plainly; do not point the user to a page for them).",
    schema: z
      .strictObject({
        fullName: z.string().trim().min(2).max(100).optional(),
        phone: z.string().trim().min(9).max(20).optional(),
      })
      .refine((value) => value.fullName || value.phone, "Provide fullName or phone"),
    requiresAccount: true,
    request: (body) => ({ method: "PATCH", path: "/accounts/me", body }),
    summarize: ({ fullName, phone }) =>
      ["Cập nhật hồ sơ", fullName && `họ tên: ${fullName}`, phone && `số điện thoại: ${phone}`]
        .filter(Boolean)
        .join(" — "),
  }),

  // --- Customer -------------------------------------------------------------------------------
  tool({
    name: "my_bookings",
    description: "The customer's own bookings with payment state.",
    schema: z.strictObject({}),
    roles: ["CUSTOMER"],
    requiresAccount: true,
    request: () => ({ method: "GET", path: "/payments/me/bookings" }),
  }),
  tool({
    name: "my_booking_tickets",
    description: "E-tickets (ticket code, seat, status) of one of the customer's own confirmed bookings.",
    schema: z.strictObject({ bookingId: objectId }),
    roles: ["CUSTOMER"],
    requiresAccount: true,
    request: ({ bookingId }) => ({ method: "GET", path: `/tickets/bookings/${id(bookingId)}` }),
  }),
  tool({
    name: "my_refunds",
    description:
      "Read-only list of the customer's own refund requests. The assistant never creates refund requests; send the user to /refunds.",
    schema: z.strictObject({}),
    roles: ["CUSTOMER"],
    requiresAccount: true,
    permissions: ["refund.request"],
    request: () => ({ method: "GET", path: "/refunds/me" }),
  }),
  tool({
    name: "check_review_eligibility",
    description:
      "Whether the customer may review a movie: they need a paid, not refunded booking for it whose showtime has ended, and no earlier review of that movie.",
    schema: z.strictObject({ movieId: objectId }),
    roles: ["CUSTOMER"],
    requiresAccount: true,
    request: ({ movieId }) => ({ method: "GET", path: `/movies/${id(movieId)}/review-eligibility` }),
  }),
  tool({
    name: "submit_movie_review",
    kind: TOOL_KIND.WRITE,
    description:
      "Post the customer's rating (1-5) and optional comment for a movie they watched. Needs the user's confirmation. Eligibility is checked first; when the customer is not eligible no card is shown and the reason comes back.",
    schema: z.strictObject({
      movieId: objectId,
      movieTitle: z.string().trim().max(200).describe("Title shown on the confirmation card"),
      rating: z.number().int().min(1).max(5),
      content: z.string().trim().max(2000).optional(),
    }),
    roles: ["CUSTOMER"],
    requiresAccount: true,
    request: ({ movieId, rating, content }) => ({
      method: "POST",
      path: `/movies/${id(movieId)}/reviews`,
      body: { rating, content: content ?? "" },
    }),
    // Runs before a card is created, so the customer never confirms a review the API would refuse.
    precheck: {
      request: ({ movieId }) => ({ method: "GET", path: `/movies/${id(movieId)}/review-eligibility` }),
      evaluate: (data) =>
        data?.canReview === true
          ? { ok: true }
          : { ok: false, code: data?.reason ?? "NOT_ELIGIBLE", hint: REVIEW_REFUSAL_HINT[data?.reason] ?? REVIEW_REFUSAL_HINT.NO_ELIGIBLE_BOOKING },
    },
    summarize: ({ movieTitle, rating, content }) =>
      `Đánh giá phim "${movieTitle}": ${rating}/5${content ? ` — "${content.slice(0, 120)}"` : ""}`,
  }),

  // --- Staff ----------------------------------------------------------------------------------
  tool({
    name: "staff_dashboard",
    description: "Today's overview for the staff member's own branch.",
    schema: z.strictObject({}),
    roles: ["STAFF"],
    requiresAccount: true,
    request: () => ({ method: "GET", path: "/staff-dashboard" }),
  }),
  tool({
    name: "check_in_ticket",
    kind: TOOL_KIND.WRITE,
    description:
      "Check a ticket in at the staff member's branch by its code (format TK-XXXXXXXXXX). Needs the user's confirmation.",
    schema: z.strictObject({ ticketCode: z.string().trim().min(5).max(30) }),
    roles: ["STAFF", "MANAGER"],
    requiresAccount: true,
    permissions: ["ticket.validate"],
    request: ({ ticketCode }) => ({ method: "POST", path: "/tickets/check-in", body: { ticketCode } }),
    summarize: ({ ticketCode }) => `Check-in vé ${ticketCode.replace(/\s+/g, "").toUpperCase()}`,
  }),
  tool({
    name: "stock_summary",
    description: "Food & drink stock summary (in stock, low, out of stock) for the user's branch.",
    schema: z.strictObject({}),
    roles: ["STAFF", "MANAGER"],
    requiresAccount: true,
    permissions: ["inventory.view"],
    request: () => ({ method: "GET", path: "/inventory/stock-levels/summary" }),
  }),
  tool({
    name: "stock_levels",
    description: "Food & drink stock levels, optionally filtered by name or status.",
    schema: z.strictObject({
      q: z.string().trim().max(100).optional(),
      status: z.enum(["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"]).optional(),
      page,
    }),
    roles: ["STAFF", "MANAGER"],
    requiresAccount: true,
    permissions: ["inventory.view"],
    request: ({ q, status, page: pageNumber }) => ({
      method: "GET",
      path: "/inventory/stock-levels",
      query: { q, status, page: pageNumber },
    }),
  }),

  // --- Manager --------------------------------------------------------------------------------
  tool({
    name: "analytics_dashboard",
    description: "Revenue, tickets and occupancy dashboard for the manager (TODAY, WTD, QTD).",
    schema: z.strictObject({ period: z.enum(["TODAY", "WTD", "QTD"]).optional() }),
    roles: ["MANAGER"],
    requiresAccount: true,
    permissions: ["analytics.view"],
    request: ({ period }) => ({ method: "GET", path: "/analytics/dashboard", query: { period } }),
  }),
  tool({
    name: "manager_showtimes",
    description: "The manager's showtime schedule (or history) including drafts.",
    schema: z.strictObject({
      view: z.enum(["schedule", "history"]).optional(),
      date: date.optional(),
      cinemaId: objectId.optional(),
      q: z.string().trim().max(100).optional(),
      page,
    }),
    roles: ["MANAGER"],
    requiresAccount: true,
    permissions: ["showtime.view"],
    request: ({ view, date: day, cinemaId, q, page: pageNumber }) => ({
      method: "GET",
      path: "/showtimes/manage",
      query: { view, date: day, cinemaId, q, page: pageNumber },
    }),
  }),
  tool({
    name: "pending_refunds",
    description:
      "Read-only refund review queue. The assistant never approves or rejects refunds; send the manager to /manager/refunds.",
    schema: z.strictObject({}),
    roles: ["MANAGER"],
    requiresAccount: true,
    permissions: ["refund.manage"],
    request: () => ({ method: "GET", path: "/refunds/manager" }),
  }),

  // --- Admin ----------------------------------------------------------------------------------
  tool({
    name: "list_staff_accounts",
    description: "Read-only list of staff and manager accounts.",
    schema: z.strictObject({
      q: z.string().trim().max(100).optional(),
      status: z.enum(["ACTIVE", "DISABLED"]).optional(),
      page,
    }),
    roles: ["ADMIN"],
    requiresAccount: true,
    permissions: ["account.manage"],
    request: ({ q, status, page: pageNumber }) => ({
      method: "GET",
      path: "/staff-accounts",
      query: { q, status, page: pageNumber },
    }),
  }),
  tool({
    name: "list_roles",
    description: "Read-only list of roles and their permissions.",
    schema: z.strictObject({}),
    roles: ["ADMIN"],
    requiresAccount: true,
    permissions: ["role.view"],
    request: () => ({ method: "GET", path: "/roles" }),
  }),
]);

export const TOOLS_BY_NAME = new Map(TOOLS.map((entry) => [entry.name, entry]));

// Only these API prefixes can ever be reached by a tool (defence in depth for api-caller).
export const TOOL_PATH_ALLOWLIST = Object.freeze([
  /^\/movies(\/[a-f\d]{24}(\/reviews|\/review-eligibility)?)?$/i,
  /^\/cinemas$/,
  /^\/showtimes(\/manage)?$/,
  /^\/showtimes\/[a-f\d]{24}\/seats$/i,
  /^\/combos$/,
  /^\/concessions$/,
  /^\/auth\/me$/,
  /^\/accounts\/me$/,
  /^\/payments\/me\/bookings$/,
  /^\/tickets\/bookings\/[a-f\d]{24}$/i,
  /^\/tickets\/check-in$/,
  /^\/refunds\/(me|manager)$/,
  /^\/staff-dashboard$/,
  /^\/inventory\/stock-levels(\/summary)?$/,
  /^\/analytics\/dashboard$/,
  /^\/staff-accounts$/,
  /^\/roles$/,
]);
