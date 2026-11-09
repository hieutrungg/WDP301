# AI-001: Popo, trợ lý AI F-Cinema — Implementation

Date: 2026-11-09. Owner: Cường (requester; Auth/RBAC/Payment/Ticket and backend integration). Status: `PROPOSED`, in the working tree (see `docs/REQUIREMENTS_STATUS.md` → Approval queue). Plan: `docs/AI-001-PLAN.md`. Setup steps: `docs/AI-001-ATLAS-SETUP.md`.

## 1. Scope

The assistant uses the OpenAI API and serves every role, guests included. It has:
- a versioned system prompt;
- RAG over MongoDB Atlas Vector Search;
- role-filtered tool calling over the existing REST APIs;
- prompt-injection guardrails;
- an exact and semantic response cache;
- a trace for every chat and a log line for every tool call.

**No other owner's code or API was changed.** Each tool calls the existing route over loopback HTTP and forwards the chatting person's `accessToken` cookie. `requireAuth`, `requirePermission`, `requireRole`, branch scope and ownership checks therefore run unchanged, and the assistant never has more rights than the user.

### Changes from the plan

| Plan | Implemented | Why |
| --- | --- | --- |
| `hold_seats` write tool | Dropped. The assistant checks seats and links to `/booking/:showtimeId/seats`. | Checkout state lives in the client `sessionStorage` (`checkoutSession.js`: `checkoutKey` and `requestKey`). A hold created on the server would be orphaned from the checkout page. Integrating it would mean changing Hà's and Hiếu's checkout code. |
| `openai` npm SDK | No new dependency. The client is `fetch`-based (`llm/openai.client.js`). | Dependency approval (AGENTS.md) is not needed. Node 20+ has `fetch`. |
| `ai.trace.view` permission | ADMIN role only (`requireAiAdmin`). | Avoids a seed or permission migration on shared RBAC data. Can be added later. |
| Admin trace page in the client | API only (`GET /api/ai/traces`). | Phase 2. |
| — | Added `update_my_profile` write tool | A basic action the user asked for ("các hành động cơ bản"). |

## 2. API (`/api/ai`, mounted in `app.js`)

| Route | Who | Notes |
| --- | --- | --- |
| `POST /chat` `{ conversationId?, message }` | everyone | Guests 10/min per IP, accounts 20/min per account (429 `AI_RATE_LIMITED`). Response: `{ conversationId, traceId, reply, pendingActions[], citations[], cache }`. |
| `POST /actions/:actionId/confirm` | owner of the action | Runs the proposed write once. 404 `AI_ACTION_NOT_FOUND`, 410 `AI_ACTION_EXPIRED` (after 5 min), 409 `AI_ACTION_ALREADY_HANDLED`. |
| `POST /actions/:actionId/cancel` | owner | Never calls the API. |
| `GET /conversations/:conversationId` | owner (guest: the id holder) | 404 `AI_CONVERSATION_NOT_FOUND`. |
| `GET /traces`, `GET /traces/:traceId` | ADMIN | A trace includes its tool-call spans. |
| `POST /knowledge/sync` `{ faq?, movies? }` | ADMIN | Ingests `approved` FAQ files and published movies. |

All routes answer 503 `AI_DISABLED` while `OPENAI_API_KEY` is empty, and the server still starts. Errors use the standard `{ success:false, code, message, errors }`.

## 3. Tools (`tools/tool-registry.js`)

| Who | Read (runs at once) | Write (PendingAction, needs a click) |
| --- | --- | --- |
| Everyone | `search_knowledge` (RAG), `recommend_movies` (vector match + live re-read), `search_movies`, `get_movie`, `list_cinemas`, `list_showtimes`, `list_combos`, `list_concessions`, `list_movie_reviews` | — |
| Signed in | `get_seat_availability`, `get_my_profile` | `update_my_profile` → `PATCH /api/accounts/me` |
| CUSTOMER | `my_bookings`, `my_booking_tickets`, `my_refunds` | `submit_movie_review` → `POST /api/movies/:id/reviews` |
| STAFF (+MANAGER) | `staff_dashboard` (STAFF), `stock_summary`, `stock_levels` | `check_in_ticket` → `POST /api/tickets/check-in` (`ticket.validate`) |
| MANAGER | `analytics_dashboard`, `manager_showtimes`, `pending_refunds` (read-only) | — |
| ADMIN | `list_staff_accounts`, `list_roles` | — |

- Each tool's `roles` and `permissions` mirror its route guards. They only decide which tools the model is offered.
- Arguments are validated again with zod.
- `api-caller.js` only reaches the paths in `TOOL_PATH_ALLOWLIST`. It cannot reach `/ai`, `/auth/*` (except `/auth/me`) or payment and refund writes.
- On confirmation, the action's arguments and the actor's rights are checked again.

## 4. Guardrails

1. **System prompt** (`prompt/system-prompt.js`, `PROMPT_VERSION = ai-001.v1`):
   - Covers scope, no invented data, the data-not-instructions rule, no prompt disclosure, the write-needs-click rule, the forbidden actions, Vietnam time and VND, and internal links only.
   - A per-request canary is added.
2. **Input** (`guardrails.js`):
   - NFKC normalization and removal of zero-width and control characters.
   - English and Vietnamese injection rules, matched with diacritics folded.
   - Fake role tags and long encoded payloads are caught.
   - OpenAI moderation runs too. A moderation outage does not block, because the structural defences still apply.
3. **Isolation**:
   - Every tool result goes back inside an `untrusted_data` envelope.
   - Credentials, QR payloads, payment instructions and similar fields are dropped (`sanitize.js`).
   - Envelope-closing tags inside data are neutralized.
   - Output is capped at 6,000 characters.
4. **Action limits**:
   - Tools are filtered by role.
   - At most 5 tool rounds; a sixth model call has `tool_choice: "none"`.
   - Writes never run without a click on "Xác nhận".
5. **Output**:
   - A leaked canary or rules marker replaces the answer.
   - Markdown links outside the internal route allow-list are reduced to plain text, on the server and again in the client renderer. No HTML is rendered.

## 5. RAG and cache

- `ai_knowledge_chunks`:
  - FAQ markdown is chunked by heading (`rag/chunker.js`), one `###` Q&A per chunk.
  - Movies are one chunk each, built from the Movie module's exported `movieService.listMovies` and `parseMovieListQuery`.
  - Embeddings use `text-embedding-3-small` (1536 dimensions).
  - `$vectorSearch` filters on `audience` inside the index, so guests and customers only get `public` chunks.
  - Hits below score 0.70 are dropped.
  - If vector search fails, retrieval fails closed and the model is told the library is unavailable.
- Ingest (`npm run ai:ingest`):
  - Only `status: approved` files are ingested, unless `--include-draft` is passed.
  - Only changed chunks (by `contentHash`) are embedded again. Stale chunks are deleted.
  - Any change bumps `knowledgeVersion`.
- `ai_response_cache`:
  - Cache is used on first turns only.
  - The key is `sha256(scope + promptVersion + knowledgeVersion + normalized question)`, so entries never cross roles.
  - An answer is written to the cache only when every tool used is public with a TTL, there is no pending action and no tool problem. The entry's TTL is the shortest TTL of the tools used (showtimes 60 s, FAQ 24 h).
  - Semantic hits (score ≥ 0.97) are allowed only for FAQ-only answers.
  - The provider's prompt caching is helped by keeping the fixed rules first.

## 6. Trace and logs

- **`ai_traces`** (one per chat, TTL 30 days) holds:
  - status (`ok`, `blocked`, `cached`, `error`);
  - input and output;
  - guardrail verdicts and cache mode/score;
  - retrieval (chunk ids and scores);
  - each model call (round, latency, tokens, output item types);
  - token totals (input, cached, output, embedding);
  - the full prompt (instructions + every input item; encrypted reasoning reduced to its id; canary stripped);
  - errors.
- **`ai_tool_calls`** (one per tool call, TTL 30 days) holds:
  - `traceId`, tool, kind and arguments;
  - `status`: `executed`, `failed`, `denied`, `invalid_args`, `pending_confirmation`, `confirmed` or `cancelled`;
  - HTTP status, error code, output size and latency.
  - A confirmation or cancellation adds a span to the trace that proposed the action.
- Everything logged is redacted (`trace/redact.js`): emails, phone numbers, JWTs, API keys, ticket codes and long card-like numbers; credential keys are dropped.
- Each event is also written to the console as one JSON line with the `traceId`. A failed log write never fails a chat.
- `audit_logs` is not used, because its enums belong to the administration module.

## 7. Data and migration

- Collections:
  - `ai_conversations` (7 days)
  - `ai_pending_actions` (5-minute validity, purged after 30 days)
  - `ai_knowledge_chunks`
  - `ai_response_cache`
  - `ai_traces`
  - `ai_tool_calls`
  - `ai_meta`
- All models use `autoIndex: false`.
- `node src/migrations/20261109-ai-001-indexes.js` creates the collections and their TTL and unique indexes (`ai.indexes.js`). It never drops anything; an incompatible index stops it.
- `--vector` also creates the two Atlas Vector Search indexes (`ai_knowledge_vector`, `ai_cache_vector`). Alternatively, follow the UI steps in `AI-001-ATLAS-SETUP.md`.
- No existing collection, validator, index or seed was changed.
- Env (`server/.env.example`): `OPENAI_API_KEY`, plus optional `OPENAI_CHAT_MODEL` (default `gpt-5-mini`), `OPENAI_EMBEDDING_MODEL`, `OPENAI_MODERATION_MODEL`, `AI_TRACE_RETENTION_DAYS`, `AI_STORE_RESPONSES` (default `false`).
- `reasoning: { effort: "low" }` and `include: ["reasoning.encrypted_content"]` are sent only for `gpt-5*` and `o*` models.

## 8. Changed files

- **Server, new:** `src/modules/ai/` with these files:
  - `ai.module.js`, `ai.routes.js`, `ai.controller.js`, `ai.validation.js`, `ai.constants.js`, `ai.models.js`, `ai.indexes.js`, `ai.repository.js`
  - `ai-actor.js`, `ai-actor.middleware.js`, `ai-chat.service.js`
  - `llm/openai.client.js`, `prompt/system-prompt.js`, `guardrails/guardrails.js`
  - `tools/{tool-registry,tool-policy,api-caller,sanitize}.js`
  - `rag/{chunker,retriever,knowledge-ingest}.js`, `cache/response-cache.js`, `trace/{tracer,redact}.js`, `scripts/ai-ingest.js`
- **Server, new (other):** `src/migrations/20261109-ai-001-indexes.js`, `test/ai-assistant.test.js`, `test/ai-routes.test.js`, `test/helpers/ai-fakes.js`.
- **Server, shared (cross-review):**
  - `src/app.js` (1 import + 1 mount)
  - `src/config/env.js` (`ai` getter)
  - `package.json` (`ai:ingest` script, no dependency)
  - `.env.example`
- **Client, new:** `src/features/ai-assistant/` with these files, plus `test/ai-message.test.js`:
  - `api/aiApi.js`, `hooks/useAiChat.js`, `store/aiChatStore.js`, `utils/aiMessage.js`
  - `components/{AiAssistantWidget,AiMessageContent,PendingActionCard}.jsx`
- **Client, shared (cross-review):** `src/app/router/index.jsx` (1 import + `<AiAssistantWidget />` inside `BrowserRouter`). The widget is hidden on the fullscreen E-Ticket `/tickets/:id`.
- **Docs:**
  - this file, `AI-001-PLAN.md`, `AI-001-ATLAS-SETUP.md`
  - `ai-knowledge/README.md` and the 8 FAQ files, all `status: draft`
  - an Approval queue entry in `REQUIREMENTS_STATUS.md`

The reviewers are named in the next section.

## 9. Reviewers

- **Hiếu:** frontend router mount and widget; `faq-danh-gia-phim.md` and `faq-bap-nuoc.md`; use of `movieService.listMovies` and `parseMovieListQuery` for ingest.
- **Hà:** `faq-dat-ve-giu-ghe.md`, `faq-hoan-tien.md`; tools that read bookings and seats.
- **Đạt:** `list_showtimes` / `manager_showtimes` / `analytics_dashboard` tool usage.
- **Nam:** `stock_*` tools, `faq-bap-nuoc.md` (stock).
- **Shared `app.js` mount:** a second backend reviewer.

## 10. Verification (2026-11-09)

| Check | Result |
| --- | --- |
| `server`: `npm run lint` | Clean. |
| `server`: `node --test test/ai-assistant.test.js test/ai-routes.test.js` | 34/34 pass. |
| `server`: all unit tests (`test/*.test.js` without e2e, mongo, migration, seed) | 262 tests, 260 pass, 2 skipped. The 2 skips existed before this change; before it the run was 228 tests, 226 pass. |
| `client`: `node --test test/` | 95 tests, 89 pass, **6 fail**. The 6 failures existed before this work and are stale RBAC expectations (403→404 and `showtime.view`) from commits `57b342b` and `64f61c7`. The 3 new AI tests pass. |
| `client`: `npm run build` | Succeeds. |
| `client`: `npx eslint` on the new feature and the router | Clean. `npm run lint` still shows the 2 errors from before this work, in `ManagerShowtimesPage.jsx` and `useInventory.js`. |
| Real app import without a key | `POST /api/ai/chat` → 503 `AI_DISABLED`; `/api/health` → 200. |
| FAQ dry run | 8 files, 44 chunks, the longest 361 characters. With approved-only, all 8 are skipped (all are draft). |

**Not run:**
- No call to the real OpenAI API was made (no key in this session). The Responses, Embeddings and Moderation request shapes follow the public API but have not been confirmed live.
- Nothing was run against Atlas: no migration, no vector index, no ingest, and no `*.e2e`/`*.mongo` tests. The Atlas steps are for Cường to do by hand (`AI-001-ATLAS-SETUP.md`).
- The loopback tool calls were not exercised against a running server with a real database.
- No browser QA of the widget.

## 11. Name and avatar: "Popo" (2026-11-09)

Cường asked to name the assistant **Popo** and to use `popo.svg` as its avatar. The SVG is a popcorn mascot in a red-striped cup.

**Asset**
- Copied to `client/src/assets/icons/popo.svg`.
- Only `<title>` and `<desc>` were changed (from "Bắp Cốc" to "Popo"); the drawing is untouched.
- The file was checked before use: 1,434 bytes, `path` and `ellipse` only, no script, event handler, `foreignObject` or external reference.
- It is rendered through `<img>`, so an SVG could not run script even if it had one.

**Widget** (`AiAssistantWidget.jsx`)
- Popo's face replaces the chat icon on the floating button, in the header, in the greeting, next to each assistant message and in the "Popo đang tra cứu…" indicator.
- The labels say Popo.

**Server**
- The system prompt makes the model introduce itself as Popo: friendly tone, first person "Popo"/"mình".
- Rule 4 now forbids taking another name or role. `RULES_MARKER` is `"[Quy tắc vận hành của Popo]"`.
- `PROMPT_VERSION` is now `ai-001.v2`, so every answer cached under the old name is invalidated.

**Guardrails**
- New rule `vi_rename` blocks renaming on command, such as "từ giờ bạn tên là…" and "đổi tên bạn thành…".
- `vi_role_hijack` and `role_hijack` now also cover "từ giờ bạn là admin", "your name is GPT" and other assistant names.
- These still pass: "Bạn tên là gì?", "Popo là ai?", and "đổi tên trong hồ sơ" (a legitimate `update_my_profile` request).

**RAG**
- `faq-tro-ly.md` gained "Popo là ai?".
- Mentions of the assistant now say Popo in `faq-hoan-tien.md`, `faq-bap-nuoc.md`, `faq-danh-gia-phim.md`, `faq-tai-khoan.md` and `README.md`. Policy content is unchanged; all files stay `status: draft`.
- **Re-ingest is needed**: `npm run ai:ingest -- --include-draft --faq`.

**Internal names are unchanged:** `ai-assistant`, `AiAssistantWidget`, `/api/ai`.

**Verification**
- `server`: `npm run lint` clean; AI tests 34/34 pass. They cover the new injection samples, the benign samples and a prompt that starts with Popo at version v2.
- `client`: eslint clean on the feature; AI tests 3/3 pass; `npm run build` succeeds with the SVG bundled.
- FAQ dry run: 45 chunks (was 44, plus "Popo là ai?").
- No "Trợ lý F-Cinema" is left in `server/src`, `client/src` or `docs/ai-knowledge`.
- No browser QA of the new avatar.

## 12. Plain language for guests and customers (2026-11-09)

**Problem.** Cường shared a real Popo answer to a customer who asked to add "birthday 10/02/2005, male, Hà Nội, likes dogs". It had two faults:
- It used system words such as "API mà Popo có thể gọi" and "công cụ hiện có".
- It **invented** a feature, telling the customer to add birthday, gender, address and interests on the Profile page.

In fact, `PATCH /api/accounts/me` and `EditProfilePage` change only `fullName` and `phone`. `profile.dateOfBirth` and `profile.address` exist in the model but no API or screen writes them. Gender and interests exist nowhere.

**Fix**
- System prompt:
  - Rule 12 (how to speak): talk like a friendly cinema staff member, and never mention how Popo works inside. Banned words include API, công cụ/tool, endpoint, backend/server, database, JSON, HTTP, error codes, field names and tool names. Errors are explained in everyday words.
  - Rule 13: only describe features and pages that really exist. It names the profile limits explicitly.
  - Role context: guests and customers get a plain-language reminder; Staff, Manager and Admin may use cinema business terms but still never mention APIs or tools.
- The `update_my_profile` tool description states that full name and phone are the only changeable fields.
- The tool-result envelope note tells the model to report results in plain words.
- `PROMPT_VERSION` is now `ai-001.v3`, so cached answers are invalidated.
- Output guard: `detectJargon` adds `jargon:<word>` reasons to the trace for guest and customer answers. The words checked are api, tool/công cụ, endpoint, database/cơ sở dữ liệu, backend/server, json, http, ERROR_CODE and tool_name. Visible text only, link targets ignored.
  - It **flags, never rewrites or blocks**. Search `ai_traces` for `guardrails.output.reasons` to tune the prompt from real conversations.
- RAG: `faq-tai-khoan.md` gained "Tôi có thể thêm ngày sinh, giới tính, địa chỉ hay sở thích vào hồ sơ không?", answered "not yet". FAQ total is now 46 chunks. Re-ingest with `npm run ai:ingest -- --include-draft --faq`.

**Verification**
- `server`: `npm run lint` clean; AI tests 36/36 pass.
- `server`: all unit tests 264 tests, 262 pass, 2 skipped (the same 2 skips as before).
- Not checked against the live model: whether the model now follows rule 12 is a prompt behaviour. The jargon flag in the trace is the way to measure it.

No commit, push, merge or task-board/Google Sheet update was made.
