// Redaction for everything the assistant logs (prompts, tool arguments, tool results, answers).
// Logs keep the shape of the conversation without personal data or credentials.

const SECRET_KEY = /pass(word)?|hash|secret|token|otp|checksum|cookie|credential|signature|api[-_]?key|authorization/i;

const PATTERNS = [
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "[jwt]"],
  [/\bsk-[A-Za-z0-9_-]{16,}\b/g, "[api-key]"],
  [/\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*/gi, "Bearer [token]"],
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]"],
  [/\bTK-[A-F0-9]{10}\b/gi, "TK-[ticket]"],
  [/\b\d{12,19}\b/g, "[number]"],
  [/(?:\+?84|\b0)(?:[\s.-]?\d){9,10}\b/g, "[phone]"],
];

const MAX_STRING = 4000;
const MAX_DEPTH = 8;

export const redactText = (value) => {
  if (typeof value !== "string") return value;
  let text = value;
  for (const [pattern, replacement] of PATTERNS) text = text.replace(pattern, replacement);
  return text.length > MAX_STRING ? `${text.slice(0, MAX_STRING)}…[truncated]` : text;
};

export const redactValue = (value, depth = 0) => {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactText(value);
  if (typeof value !== "object") return value;
  if (value instanceof Date) return value;
  if (depth >= MAX_DEPTH) return "[depth]";
  if (Array.isArray(value)) return value.map((item) => redactValue(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SECRET_KEY.test(key) ? "[redacted]" : redactValue(item, depth + 1),
    ]),
  );
};

// Removes a per-request secret (the prompt canary) before a prompt is logged.
export const stripSecret = (value, secret) => {
  if (!secret) return value;
  const json = JSON.stringify(value);
  return JSON.parse(json.split(secret).join("[canary]"));
};
