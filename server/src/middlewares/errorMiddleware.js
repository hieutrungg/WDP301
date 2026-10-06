import { AppError } from "../utils/AppError.js";

export const errorHandler = (error, _req, res, _next) => {
  const statusCode = error.statusCode ?? 500;
  const isOperationalError = error instanceof AppError;

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json({
    success: false,
    message:
      statusCode >= 500 && !isOperationalError
        ? "Internal server error"
        : error.message,
    errors: error.errors ?? [],
  });
};
