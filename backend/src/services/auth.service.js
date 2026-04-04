const bcrypt = require("bcrypt");
const { withTransaction, query } = require("../db/pool");
const { HttpError } = require("../utils/http-error");
const { issueTokenPair, validateRefreshToken, revokeRefreshToken } = require("./token.service");

const BCRYPT_COST = 12;

function toUserDTO(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    age: row.age,
    gender: row.gender,
    height_cm: row.height_cm,
    weight_kg: row.weight_kg,
    goal: row.goal,
    fitness_level: row.fitness_level,
    unit_system: row.unit_system,
    training_type: row.training_type,
    available_days: row.available_days,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function registerUser(payload) {
  const passwordHash = await bcrypt.hash(payload.password, BCRYPT_COST);

  try {
    const user = await withTransaction(async (client) => {
      const userResult = await client.query(
        `
          INSERT INTO users (
            name,
            email,
            age,
            gender,
            height_cm,
            weight_kg,
            goal,
            fitness_level,
            unit_system,
            training_type,
            available_days
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, 'metric'), COALESCE($10, 'hybrid'), COALESCE($11, ARRAY[1,3,5,6]))
          RETURNING *
        `,
        [
          payload.name,
          payload.email,
          payload.age ?? null,
          payload.gender ?? null,
          payload.height_cm ?? null,
          payload.weight_kg ?? null,
          payload.goal ?? null,
          payload.fitness_level ?? null,
          payload.unit_system ?? null,
          payload.training_type ?? null,
          payload.available_days ?? null,
        ],
      );

      const userRow = userResult.rows[0];
      await client.query(
        `
          INSERT INTO user_credentials (user_id, password_hash)
          VALUES ($1, $2)
        `,
        [userRow.id, passwordHash],
      );

      return userRow;
    });

    const tokens = await issueTokenPair(user);
    return {
      user: toUserDTO(user),
      tokens,
    };
  } catch (error) {
    if (error.code === "23505") {
      throw new HttpError(409, "Email already registered.");
    }
    throw error;
  }
}

async function loginUser(email, password) {
  const result = await query(
    `
      SELECT
        u.*,
        c.password_hash
      FROM users u
      JOIN user_credentials c ON c.user_id = u.id
      WHERE LOWER(u.email) = LOWER($1)
    `,
    [email],
  );

  const row = result.rows[0];
  if (!row) {
    throw new HttpError(401, "Invalid email or password.");
  }

  const validPassword = await bcrypt.compare(password, row.password_hash);
  if (!validPassword) {
    throw new HttpError(401, "Invalid email or password.");
  }

  const tokens = await issueTokenPair(row);
  return {
    user: toUserDTO(row),
    tokens,
  };
}

async function refreshSession(refreshToken) {
  const payload = await validateRefreshToken(refreshToken);
  await revokeRefreshToken(refreshToken);

  const userResult = await query(
    `
      SELECT *
      FROM users
      WHERE id = $1
    `,
    [payload.userId],
  );

  const user = userResult.rows[0];
  if (!user) {
    throw new HttpError(404, "User not found.");
  }

  const tokens = await issueTokenPair(user);
  return {
    user: toUserDTO(user),
    tokens,
  };
}

async function logoutSession(refreshToken) {
  await revokeRefreshToken(refreshToken);
}

module.exports = {
  registerUser,
  loginUser,
  refreshSession,
  logoutSession,
};
