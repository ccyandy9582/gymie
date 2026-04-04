const jwt = require("jsonwebtoken");
const { env } = require("../config/env");
const { HttpError } = require("../utils/http-error");

function requireAuth(req, _res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(new HttpError(401, "Missing bearer token."));
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (payload.type !== "access") {
      return next(new HttpError(401, "Invalid access token."));
    }
    req.auth = {
      userId: payload.sub,
      email: payload.email,
    };
    return next();
  } catch (error) {
    return next(new HttpError(401, "Invalid or expired token."));
  }
}

module.exports = {
  requireAuth,
};
