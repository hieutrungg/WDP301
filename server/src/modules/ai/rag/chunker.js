import { createHash } from "node:crypto";

// Markdown knowledge files: a small frontmatter block, then sections split on headings.
//
//   ---
//   title: Giữ ghế và đặt vé
//   audience: public        # public | internal
//   status: approved        # draft | approved (only approved files are ingested by default)
//   sources: [server/src/modules/booking/seat-hold.constants.js]
//   ---

const MAX_CHUNK_CHARS = 1800;
const OVERLAP_PARAGRAPHS = 1;

export const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const parseScalar = (raw) => {
  const value = raw.trim();
  if (value.startsWith("[") && value.endsWith("]")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((item) => item.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
  return value.replace(/^["']|["']$/g, "");
};

export const parseFrontmatter = (markdown) => {
  const text = markdown.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!match) return { meta: {}, body: text };
  const meta = {};
  for (const line of match[1].split("\n")) {
    const pair = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(line.replace(/\s+#.*$/, ""));
    if (pair) meta[pair[1]] = parseScalar(pair[2]);
  }
  return { meta, body: text.slice(match[0].length) };
};

const splitLong = (text) => {
  if (text.length <= MAX_CHUNK_CHARS) return [text];
  const paragraphs = text.split(/\n{2,}/);
  const parts = [];
  let current = [];
  for (const paragraph of paragraphs) {
    const candidate = [...current, paragraph].join("\n\n");
    if (candidate.length > MAX_CHUNK_CHARS && current.length) {
      parts.push(current.join("\n\n"));
      current = [...current.slice(-OVERLAP_PARAGRAPHS), paragraph];
    } else {
      current.push(paragraph);
    }
  }
  if (current.length) parts.push(current.join("\n\n"));
  return parts;
};

/**
 * Splits a markdown body into heading-scoped chunks. Each chunk carries its heading path
 * ("Hoàn tiền > Điều kiện") so a retrieved piece still says what it is about.
 * @returns {{ heading: string, text: string }[]}
 */
export const chunkMarkdown = (body, title) => {
  const sections = [];
  const path = [];
  let lines = [];
  const flush = () => {
    const text = lines.join("\n").trim();
    if (text) sections.push({ heading: [title, ...path].filter(Boolean).join(" > "), text });
    lines = [];
  };

  for (const line of body.split("\n")) {
    const heading = /^(#{1,4})\s+(.+?)\s*#*$/.exec(line);
    if (heading) {
      flush();
      const level = heading[1].length;
      // A level-1 heading repeats the document title; deeper ones build the path.
      if (level === 1) path.length = 0;
      else {
        path.length = Math.max(0, level - 2);
        path.push(heading[2]);
      }
      continue;
    }
    lines.push(line);
  }
  flush();

  return sections.flatMap(({ heading, text }) =>
    splitLong(text).map((part) => ({ heading, text: part })),
  );
};
