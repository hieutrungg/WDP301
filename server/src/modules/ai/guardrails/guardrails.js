import { RULES_MARKER } from "../prompt/system-prompt.js";

// AI-001 guardrails. Layered with the structural defences elsewhere (role-filtered tools, data
// envelope, write tools that need a human click), so a missed pattern here still cannot execute
// anything on its own.

const ZERO_WIDTH = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;

export const normalizeInput = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .replace(ZERO_WIDTH, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

// Vietnamese text is matched without diacritics, so "bỏ qua" and "bo qua" hit the same rule.
const fold = (text) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

const INJECTION_RULES = [
  ["override_instructions", /\b(ignore|disregard|forget|override|bypass)\b.{0,40}\b(previous|prior|above|earlier|all|your|system|the)\b.{0,30}\b(instructions?|prompts?|rules?|guidelines?|messages?)\b/],
  ["reveal_prompt", /\b(reveal|show|print|repeat|output|leak|display|dump|tell me|what (is|are))\b.{0,40}\b(system|hidden|initial|developer|original)\s+(prompt|instructions?|message)\b/],
  ["role_hijack", /\b(you are now|from now on (you are|your name is)|your new name is|act as|pretend (to be|you are)|roleplay as)\b.{0,40}\b(dan|developer|admin|root|unrestricted|jailbroken|evil|no (rules|limits)|chatgpt|gpt|gemini|claude)\b/],
  ["jailbreak", /\b(jailbreak|do anything now|developer mode|dan mode|god mode)\b/],
  ["fake_role_tag", /<\/?\s*(system|developer|assistant|untrusted_data|tool)\s*>|\[\/?(system|inst)\]|^\s*(system|developer)\s*:/m],
  // A qualifier ("mọi", "trước đó", "của bạn"...) is required, so "quên mật khẩu, hướng dẫn tôi" passes.
  ["vi_override", /\b(bo qua|phot lo|lo di|xoa bo|vo hieu hoa|quen (het|di))\b.{0,15}\b(moi|tat ca|het|cac|nhung)\b.{0,15}\b(huong dan|chi dan|chi thi|lenh|quy tac|nguyen tac)\b/],
  ["vi_override_prior", /\b(bo qua|phot lo|lo di|xoa bo|vo hieu hoa|quen)\b.{0,30}\b(huong dan|chi dan|chi thi|lenh|quy tac|nguyen tac)\b.{0,20}\b(truoc( do)?|o tren|ban dau|he thong|cua ban|da duoc cai)\b/],
  ["vi_reveal_prompt", /\b(tiet lo|hien thi|in ra|cho (toi|minh|tao) xem|lap lai|doc lai|dich)\b.{0,40}\b(system prompt|prompt he thong|huong dan he thong|chi dan (an|goc|he thong)|quy tac (an|goc|he thong)|ma kiem soat)\b/],
  ["vi_role_hijack", /\b(gia vo|dong vai|tu (bay )?gio( tro di)? (ban|may|em|popo)( se)?( ten)? la|hay tro thanh)\b.{0,30}\b(admin|quan tri|developer|nha phat trien|khong (gioi han|kiem duyet)|ai khac|chatgpt|gpt|gemini|claude|dan)\b/],
  // Renaming Popo on command ("từ giờ bạn tên là…", "đổi tên bạn thành…"); "bạn tên là gì?" passes.
  ["vi_rename", /\b(tu (bay )?gio( tro di)? (ban|may|em|popo)( se)? ten la|doi ten (cua )?(ban|may|em|popo)( thanh| la)?|(ban|may|em|popo) hay (doi ten|lay ten))\b/],
  ["encoded_payload", /[A-Za-z0-9+/]{240,}={0,2}/],
];

export const detectInjection = (text) => {
  const folded = fold(text);
  return INJECTION_RULES.filter(([, pattern]) => pattern.test(folded) || pattern.test(text)).map(
    ([name]) => name,
  );
};

/**
 * @returns {Promise<{ allowed: boolean, reasons: string[], moderation: object | null }>}
 */
export const checkInput = async (text, { moderate } = {}) => {
  const reasons = detectInjection(text);
  if (reasons.length) return { allowed: false, reasons, moderation: null };

  if (!moderate) return { allowed: true, reasons: [], moderation: null };
  try {
    const moderation = await moderate(text);
    return moderation.flagged
      ? { allowed: false, reasons: moderation.categories.map((name) => `moderation:${name}`), moderation }
      : { allowed: true, reasons: [], moderation };
  } catch (error) {
    // Moderation outage: the structural defences still apply, so the request continues.
    return { allowed: true, reasons: [], moderation: { error: error.message ?? "failed" } };
  }
};

const INTERNAL_LINK = /^\/(?!\/)[A-Za-z0-9\-._~/%?=&#]*$/;
const ALLOWED_LINK_PREFIXES = [
  "/movies", "/showtimes", "/concessions", "/booking/", "/bookings/", "/my-tickets",
  "/booking-history", "/refunds", "/profile", "/tickets", "/login", "/register",
  "/staff", "/manager", "/admin",
];

export const isAllowedLink = (href) =>
  href === "/" ||
  (INTERNAL_LINK.test(href) &&
    !href.includes("..") &&
    ALLOWED_LINK_PREFIXES.some((prefix) =>
      prefix.endsWith("/")
        ? href.startsWith(prefix)
        : href === prefix || href.startsWith(`${prefix}/`) || href.startsWith(`${prefix}?`),
    ));

// The answer tells the user a confirmation card is waiting ("bấm nút Xác nhận", "đã chuẩn bị thẻ
// xác nhận", "press Confirm"). Matched without diacritics.
const CARD_CLAIM =
  /\b(the|nut) xac nhan\b|\bbam (vao |nut |vao nut )?["“'«]?xac nhan\b|\bda (chuan bi|tao|soan|gui)( san)?( cho ban)?( mot)? the\b|\bconfirmation card\b|\bpress (the )?["“']?confirm\b/;

export const claimsConfirmationCard = (text) => CARD_CLAIM.test(fold(String(text ?? "")));

// Technical words a guest or customer should never read (prompt rule 12). Found words are only
// recorded in the trace (`jargon:<word>`), so the prompt can be tuned from real conversations.
const JARGON_RULES = [
  ["api", /\bapis?\b/i],
  // \b does not see Vietnamese letters, so Vietnamese words are matched as plain substrings.
  ["tool", /\b(tools?|function call)\b|công cụ/i],
  ["endpoint", /\bendpoints?\b/i],
  ["database", /\b(database|db)\b|cơ sở dữ liệu/i],
  ["backend", /\b(backend|server)\b/i],
  ["json", /\bjson\b/i],
  ["http", /\bhttp\s*\d{3}\b|\b(4\d\d|5\d\d) (error|lỗi)\b/i],
  ["error_code", /\b[A-Z]+(?:_[A-Z]+){1,}\b/],
  ["tool_name", /\b[a-z]+(?:_[a-z]+){1,}\b/],
];

export const detectJargon = (text) =>
  JARGON_RULES.filter(([, pattern]) => pattern.test(text)).map(([name]) => `jargon:${name}`);

/**
 * Last line of defence on the answer: blocks a leaked prompt, keeps only internal links and, for
 * guests and customers (`plainLanguage`), flags technical wording in the trace.
 * @returns {{ text: string, blocked: boolean, reasons: string[] }}
 */
export const checkOutput = (text, { canary, plainLanguage = false }) => {
  const reasons = [];
  if (canary && text.includes(canary)) reasons.push("canary_leak");
  if (text.includes(RULES_MARKER) || /\[Hết quy tắc\]/.test(text)) reasons.push("rules_leak");
  if (reasons.length) return { text: "", blocked: true, reasons };

  let removedLinks = 0;
  const cleaned = text.replace(/\[([^\]\n]{1,200})\]\(([^)\s]{1,500})\)/g, (_match, label, href) => {
    if (isAllowedLink(href)) return `[${label}](${href})`;
    removedLinks += 1;
    return label;
  });
  // Link targets are paths, not prose: check only the visible text.
  const visible = cleaned.replace(/\]\([^)]*\)/g, "]");
  return {
    text: cleaned,
    blocked: false,
    reasons: [
      ...(removedLinks ? [`removed_links:${removedLinks}`] : []),
      ...(plainLanguage ? detectJargon(visible) : []),
    ],
  };
};
