const express = require("express");
const { z } = require("zod");
const { query, withTransaction } = require("../db/pool");
const { requireAuth } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { asyncHandler } = require("../utils/async-handler");
const { HttpError } = require("../utils/http-error");

const router = express.Router();

const sessionIdParamSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({
    id: z.string().uuid(),
  }),
  query: z.object({}).optional(),
});

const createWorkoutSchema = z.object({
  body: z.object({
    plan_day_id: z.string().uuid().optional(),
    started_at: z.string().datetime().optional(),
    notes: z.string().optional(),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const updateWorkoutSchema = z.object({
  body: z.object({
    ended_at: z.string().datetime().optional(),
    total_volume_kg: z.number().min(0).optional(),
    notes: z.string().optional(),
    status: z.enum(["in_progress", "completed", "cancelled"]).optional(),
  }),
  params: z.object({
    id: z.string().uuid(),
  }),
  query: z.object({}).optional(),
});

const addSetSchema = z.object({
  body: z.object({
    exercise_name: z.string().min(1).max(200),
    set_number: z.number().int().positive(),
    reps: z.number().int().positive(),
    weight_kg: z.number().min(0),
    is_pr: z.boolean().optional(),
    completed_at: z.string().datetime().optional(),
  }),
  params: z.object({
    id: z.string().uuid(),
  }),
  query: z.object({}).optional(),
});

const finishWorkoutSchema = z.object({
  body: z.object({
    ended_at: z.string().datetime().optional(),
    notes: z.string().optional(),
  }).optional(),
  params: z.object({
    id: z.string().uuid(),
  }),
  query: z.object({}).optional(),
});

async function ensureWorkoutOwnership(workoutId, userId) {
  const result = await query(
    `
      SELECT id, status, started_at, ended_at
      FROM workout_sessions
      WHERE id = $1 AND user_id = $2
    `,
    [workoutId, userId],
  );

  if (result.rowCount === 0) {
    throw new HttpError(404, "Workout session not found.");
  }

  return result.rows[0];
}

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await query(
      `
        SELECT
          id,
          plan_day_id,
          started_at,
          ended_at,
          total_volume_kg,
          notes,
          status,
          created_at,
          updated_at
        FROM workout_sessions
        WHERE user_id = $1
        ORDER BY started_at DESC
      `,
      [req.auth.userId],
    );

    res.status(200).json({ workouts: result.rows });
  }),
);

router.post(
  "/",
  requireAuth,
  validate(createWorkoutSchema),
  asyncHandler(async (req, res) => {
    const payload = req.validated.body;
    const result = await query(
      `
        INSERT INTO workout_sessions (
          user_id,
          plan_day_id,
          started_at,
          notes,
          status
        )
        VALUES ($1, $2, COALESCE($3, NOW()), $4, 'in_progress')
        RETURNING *
      `,
      [
        req.auth.userId,
        payload.plan_day_id ?? null,
        payload.started_at ?? null,
        payload.notes ?? null,
      ],
    );

    res.status(201).json({ workout: result.rows[0] });
  }),
);

router.get(
  "/:id",
  requireAuth,
  validate(sessionIdParamSchema),
  asyncHandler(async (req, res) => {
    const workoutId = req.validated.params.id;
    const workoutResult = await query(
      `
        SELECT
          id,
          plan_day_id,
          started_at,
          ended_at,
          total_volume_kg,
          notes,
          status,
          created_at,
          updated_at
        FROM workout_sessions
        WHERE id = $1
          AND user_id = $2
      `,
      [workoutId, req.auth.userId],
    );

    const workout = workoutResult.rows[0];
    if (!workout) {
      throw new HttpError(404, "Workout session not found.");
    }

    const setResult = await query(
      `
        SELECT
          id,
          exercise_name,
          set_number,
          reps,
          weight_kg,
          is_pr,
          completed_at
        FROM exercise_sets
        WHERE session_id = $1
        ORDER BY completed_at, set_number
      `,
      [workoutId],
    );

    res.status(200).json({
      workout: {
        ...workout,
        sets: setResult.rows,
      },
    });
  }),
);

router.put(
  "/:id",
  requireAuth,
  validate(updateWorkoutSchema),
  asyncHandler(async (req, res) => {
    const payload = req.validated.body;
    await ensureWorkoutOwnership(req.validated.params.id, req.auth.userId);

    const assignments = [];
    const values = [];
    if (payload.ended_at !== undefined) {
      assignments.push(`ended_at = $${values.length + 1}`);
      values.push(payload.ended_at);
    }
    if (payload.total_volume_kg !== undefined) {
      assignments.push(`total_volume_kg = $${values.length + 1}`);
      values.push(payload.total_volume_kg);
    }
    if (payload.notes !== undefined) {
      assignments.push(`notes = $${values.length + 1}`);
      values.push(payload.notes);
    }
    if (payload.status !== undefined) {
      assignments.push(`status = $${values.length + 1}`);
      values.push(payload.status);
    }

    if (assignments.length === 0) {
      throw new HttpError(400, "No update fields provided.");
    }

    const result = await query(
      `
        UPDATE workout_sessions
        SET ${assignments.join(", ")}
        WHERE id = $${values.length + 1}
          AND user_id = $${values.length + 2}
        RETURNING *
      `,
      [...values, req.validated.params.id, req.auth.userId],
    );

    res.status(200).json({ workout: result.rows[0] });
  }),
);

router.post(
  "/:id/sets",
  requireAuth,
  validate(addSetSchema),
  asyncHandler(async (req, res) => {
    await ensureWorkoutOwnership(req.validated.params.id, req.auth.userId);
    const payload = req.validated.body;

    const result = await query(
      `
        INSERT INTO exercise_sets (
          session_id,
          exercise_name,
          set_number,
          reps,
          weight_kg,
          is_pr,
          completed_at
        )
        VALUES ($1, $2, $3, $4, $5, COALESCE($6, FALSE), COALESCE($7, NOW()))
        ON CONFLICT (session_id, exercise_name, set_number)
        DO UPDATE SET
          reps = EXCLUDED.reps,
          weight_kg = EXCLUDED.weight_kg,
          is_pr = EXCLUDED.is_pr,
          completed_at = EXCLUDED.completed_at
        RETURNING *
      `,
      [
        req.validated.params.id,
        payload.exercise_name,
        payload.set_number,
        payload.reps,
        payload.weight_kg,
        payload.is_pr ?? false,
        payload.completed_at ?? null,
      ],
    );

    res.status(201).json({ set: result.rows[0] });
  }),
);

router.put(
  "/:id/finish",
  requireAuth,
  validate(finishWorkoutSchema),
  asyncHandler(async (req, res) => {
    const workoutId = req.validated.params.id;
    const payload = req.validated.body || {};

    const result = await withTransaction(async (client) => {
      const sessionResult = await client.query(
        `
          SELECT id, status, ended_at
          FROM workout_sessions
          WHERE id = $1
            AND user_id = $2
          FOR UPDATE
        `,
        [workoutId, req.auth.userId],
      );

      const session = sessionResult.rows[0];
      if (!session) {
        throw new HttpError(404, "Workout session not found.");
      }

      if (session.status === "completed") {
        const existingResult = await client.query(
          `
            SELECT *
            FROM workout_sessions
            WHERE id = $1
          `,
          [workoutId],
        );
        return existingResult.rows[0];
      }

      const volumeResult = await client.query(
        `
          SELECT COALESCE(SUM(weight_kg * reps), 0) AS total_volume_kg
          FROM exercise_sets
          WHERE session_id = $1
        `,
        [workoutId],
      );

      const totalVolume = Number(volumeResult.rows[0].total_volume_kg || 0);
      const updateResult = await client.query(
        `
          UPDATE workout_sessions
          SET
            ended_at = COALESCE($1, NOW()),
            total_volume_kg = $2,
            notes = COALESCE($3, notes),
            status = 'completed'
          WHERE id = $4
          RETURNING *
        `,
        [
          payload.ended_at ?? null,
          totalVolume,
          payload.notes ?? null,
          workoutId,
        ],
      );

      return updateResult.rows[0];
    });

    res.status(200).json({ workout: result });
  }),
);

module.exports = router;
