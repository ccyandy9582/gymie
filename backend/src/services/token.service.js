const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { env } = require("../config/env");
const { query } = require("../db/pool");
const { HttpError } = require("../utils/http-error");

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function signAccessToken(user) {
  return jwt.sign(
    {
      type: "access",
      email: user.email,
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
      subject: user.id,
    },
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    {
      type: "refresh",
      email: user.email,
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
      subject: user.id,
    },
  );
}

function getExpirationDate(token) {
  const decoded = jwt.decode(token);
  if (!decoded || !decoded.exp) {
    throw new HttpError(401, "Invalid token.");
  }
  return new Date(decoded.exp * 1000);
}

async function persistRefreshToken(userId, refreshToken) {
  const tokenHash = hashToken(refreshToken);
  const expiresAt = getExpirationDate(refreshToken);

  await query(
    `
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
    `,
    [userId, tokenHash, expiresAt],
  );
}

async function revokeRefreshToken(refreshToken) {
  const tokenHash = hashToken(refreshToken);
  await query(
    `
      UPDATE refresh_tokens
      SET revoked_at = NOW()
      WHERE token_hash = $1 AND revoked_at IS NULL
    `,
    [tokenHash],
  );
}

async function validateRefreshToken(refreshToken) {
  let payload;
  try {
    payload = jwt.verify(refreshToken, env.JWT_SECRET);
  } catch (error) {
    throw new HttpError(401, "Invalid or expired refresh token.");
  }

  if (payload.type !== "refresh") {
    throw new HttpError(401, "Invalid refresh token type.");
  }

  const tokenHash = hashToken(refreshToken);
  const tokenResult = await query(
    `
      SELECT id, user_id, expires_at, revoked_at
      FROM refresh_tokens
      WHERE token_hash = $1
    `,
    [tokenHash],
  );

  const tokenRow = tokenResult.rows[0];
  if (!tokenRow) {
    throw new HttpError(401, "Refresh token not found.");
  }
  if (tokenRow.revoked_at) {
    throw new HttpError(401, "Refresh token revoked.");
  }
  if (new Date(tokenRow.expires_at).getTime() <= Date.now()) {
    throw new HttpError(401, "Refresh token expired.");
  }

  return {
    userId: payload.sub,
    email: payload.email,
  };
}

async function issueTokenPair(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  await persistRefreshToken(user.id, refreshToken);

  return {
    accessToken,
    refreshToken,
  };
}

module.exports = {
  issueTokenPair,
  validateRefreshToken,
  revokeRefreshToken,
};
