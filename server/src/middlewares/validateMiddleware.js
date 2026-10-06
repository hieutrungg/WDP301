import { AppError } from "../utils/AppError.js";

export const validate = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));

    return next(new AppError(400, "Validation failed", errors));
  }

  req.body = result.data;
  return next();
};
