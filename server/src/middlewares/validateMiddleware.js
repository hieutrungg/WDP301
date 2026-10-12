import { AppError } from "../utils/AppError.js";

// `source` picks body, query or params. Express 5 exposes `req.query` as a getter, so parsed
// query/params are published on `req.validated[source]`; the body keeps replacing `req.body`.
export const validate =
  (schema, { source = "body", code } = {}) =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source] ?? {});

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      return next(new AppError(400, "Validation failed", errors, code));
    }

    req.validated = { ...req.validated, [source]: result.data };
    if (source === "body") req.body = result.data;
    return next();
  };
