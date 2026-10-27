import { z } from "zod";

// SRS 5.3 field messages for new admin forms (CR-04). Older auth forms keep their wording.
export const requiredMessage = (label) => `The ${label} field is required.`; // MSG01
export const maxLengthMessage = (max) => `Exceed max length of ${max}.`; // MSG02
export const invalidFormatMessage = (label) => `The ${label} format is invalid.`; // MSG03

const objectIdPattern = /^[a-f\d]{24}$/i;

// Trimmed text that is required: missing, non-text or blank all report MSG01.
export const requiredText = (label, { max, min = 1 } = {}) =>
  z
    .string({ error: requiredMessage(label) })
    .trim()
    .min(1, { error: requiredMessage(label), abort: true })
    .min(min, { error: `The ${label} must be at least ${min} characters.`, abort: true })
    .max(max, maxLengthMessage(max));

// Optional text: "" or null clears the stored value.
export const optionalText = (label, { max }) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string({ error: invalidFormatMessage(label) }).trim().max(max, maxLengthMessage(max)).nullable(),
  );

export const objectIdField = (label) =>
  z.string({ error: invalidFormatMessage(label) }).regex(objectIdPattern, invalidFormatMessage(label));

// A list of ObjectId strings, de-duplicated so order and repeats never matter.
export const objectIdList = (label, { max = 200 } = {}) =>
  z
    .array(objectIdField(label), { error: invalidFormatMessage(label) })
    .max(max, maxLengthMessage(max))
    .transform((ids) => [...new Set(ids.map((id) => id.toLowerCase()))]);
