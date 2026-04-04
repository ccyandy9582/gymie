const express = require("express");
const { z } = require("zod");
const { query } = require("../db/pool");
const { requireAuth } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { asyncHandler } = require("../utils/async-handler");
const { HttpError } = require("../utils/http-error");

const router = express.Router();

const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(50).optional(),
    age: z.number().int().min(10).max(100).optional(),
    gender: z.enum(["male", "female", "other"]).optional(),
    height_cm: z.number().min(50).max(300).optional(),
    weight_kg: z.number().min(20).max(500).optional(),
    goal: z.enum(["build_muscle", "lose_fat", "endurance", "general_fitness"]).optional(),
    fitness_level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const updatePreferencesSchema = z.object({
  body: z.object({
    unit_system: z.enum(["metric", "imperial"]).optional(),
    training_type: z.enum(["running", "strength", "hybrid"]).optional(),
    available_days: z.array(z.number().int().min(0).max(6)).min(2).max(7).optional(),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

function buildPartialUpdate(body, allowedFields) {
  const keys = allowedFields.filter((field) => body[field] !== undefined);
  if (keys.length === 0) {
    return null;
  }

  const assignments = keys.map((field, index) => `${field} = $${index + 1}`);
  const values = keys.map((field) => body[field]);
  return {
    sql: assignments.join(", "),
    values,
  };
}

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await query(
      `
        SELECT
          id,
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
          available_days,
          created_at,
          updated_at
        FROM users
        WHERE id = $1
      `,
      [req.auth.userId],
    );

    const user = result.rows[0];
    if (!user) {
      throw new HttpError(404, "User not found.");
    }

    res.status(200).json({ user });
  }),
);

router.put(
  "/me",
  requireAuth,
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const update = buildPartialUpdate(
      req.validated.body,
      ["name", "age", "gender", "height_cm", "weight_kg", "goal", "fitness_level"],
    );

    if (!update) {
      throw new HttpError(400, "No profile fields provided.");
    }

    const result = await query(
      `
        UPDATE users
        SET ${update.sql}
        WHERE id = $${update.values.length + 1}
        RETURNING
          id,
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
          available_days,
          created_at,
          updated_at
      `,
      [...update.values, req.auth.userId],
    );

    res.status(200).json({ user: result.rows[0] });
  }),
);

router.put(
  "/me/preferences",
  requireAuth,
  validate(updatePreferencesSchema),
  asyncHandler(async (req, res) => {
    const update = buildPartialUpdate(
      req.validated.body,
      ["unit_system", "training_type", "available_days"],
    );

    if (!update) {
      throw new HttpError(400, "No preference fields provided.");
    }

    const result = await query(
      `
        UPDATE users
        SET ${update.sql}
        WHERE id = $${update.values.length + 1}
        RETURNING
          id,
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
          available_days,
          created_at,
          updated_at
      `,
      [...update.values, req.auth.userId],
    );

    res.status(200).json({ user: result.rows[0] });
  }),
);

module.exports = router;
