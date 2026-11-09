import { AI_LIMITS } from "../ai.constants.js";
import { TOOL_PATH_ALLOWLIST } from "./tool-registry.js";

// Calls this server's own REST API over loopback with the chatting person's session cookie, so a
// tool has exactly that person's rights: requireAuth, requirePermission, requireRole, branch scope
// and ownership checks all run unchanged. No other module's code is imported or changed.

export const isAllowedToolPath = (path) =>
  typeof path === "string" && TOOL_PATH_ALLOWLIST.some((pattern) => pattern.test(path));

const toSearchParams = (query = {}) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
};

export const createApiCaller = ({
  baseUrl,
  fetchImpl = globalThis.fetch,
  timeoutMs = AI_LIMITS.TOOL_TIMEOUT_MS,
}) =>
  async ({ method, path, query, body, accessToken }) => {
    if (!isAllowedToolPath(path)) {
      return { ok: false, status: 404, body: { success: false, code: "TOOL_PATH_FORBIDDEN" } };
    }

    const headers = { accept: "application/json", "x-fcinema-ai-tool": "1" };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (accessToken) headers.cookie = `accessToken=${accessToken}`;

    let response;
    try {
      response = await fetchImpl(`${baseUrl}${path}${toSearchParams(query)}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "error",
      });
    } catch (error) {
      return {
        ok: false,
        status: 0,
        body: { success: false, code: error?.name === "TimeoutError" ? "TOOL_TIMEOUT" : "TOOL_UNREACHABLE" },
      };
    }

    const text = await response.text();
    let parsed;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { success: false, code: "TOOL_BAD_RESPONSE" };
    }
    return { ok: response.ok, status: response.status, body: parsed };
  };
