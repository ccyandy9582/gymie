const { HttpError } = require("../utils/http-error");

function notFoundHandler(_req, _res, next) {
  next(new HttpError(404, "Route not found."));
}

function errorHandler(err, _req, res, _next) {
  const isHttpError = err instanceof HttpError;
  const statusCode = isHttpError ? err.statusCode : 500;

  if (!isHttpError) {
    console.error("[api] unhandled error:", err);
  }

  res.status(statusCode).json({
    error: {
      message: isHttpError ? err.message : "Internal server error.",
      details: isHttpError ? err.details : undefined,
    },
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
