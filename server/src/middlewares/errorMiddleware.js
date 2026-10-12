import { AppError } from "../utils/AppError.js";

export const errorHandler = (error, _req, res, _next) => {
  const statusCode = error.statusCode ?? 500;
  const isOperationalError = error instanceof AppError;

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json({
    success: false,
    // Only AppError codes are public; driver errors carry numeric codes such as 11000.
    ...(isOperationalError && error.code ? { code: error.code } : {}),
    message:
      statusCode >= 500 && !isOperationalError
        ? "Internal server error"
        : error.message,
    errors: error.errors ?? [],
  });
};
