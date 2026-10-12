export class AppError extends Error {
  // `code` is the optional stable identifier from the additive API error standard (A-07).
  constructor(statusCode, message, errors = [], code = undefined) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.errors = errors;
    this.code = code;
  }
}
