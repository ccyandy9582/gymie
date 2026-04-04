const express = require("express");
const { z } = require("zod");
const { query } = require("../db/pool");
const { requireAuth } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { asyncHandler } = require("../utils/async-handler");

const router = express.Router();

const strengthExerciseParamSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({
    exercise: z.string().min(1).max(200),
  }),
  query: z.object({}).optional(),
});

const runningDistances = [
  { key: "1k", distance: 1.0 },
  { key: "5k", distance: 5.0 },
  { key: "10k", distance: 10.0 },
  { key: "half_marathon", distance: 21.1 },
  { key: "marathon", distance: 42.2 },
];

router.get(
  "/running",
  requireAuth,
  asyncHandler(async (req, res) => {
    const records = [];
    for (const target of runningDistances) {
      const result = await query(
        `
          SELECT
            id AS run_session_id,
            distance_km,
            duration_sec,
            started_at
          FROM run_sessions
          WHERE user_id = $1
            AND status = 'completed'
            AND distance_km BETWEEN ($2 * 0.98) AND ($2 * 1.05)
          ORDER BY duration_sec ASC
          LIMIT 1
        `,
        [req.auth.userId, target.distance],
      );

      if (result.rowCount === 0) {
        records.push({
          key: target.key,
          distance_km: target.distance,
          best_duration_sec: null,
          run_session_id: null,
          achieved_at: null,
        });
      } else {
        const row = result.rows[0];
        records.push({
          key: target.key,
          distance_km: target.distance,
          best_duration_sec: Number(row.duration_sec),
          run_session_id: row.run_session_id,
          achieved_at: row.started_at,
        });
      }
    }

    res.status(200).json({ running_records: records });
  }),
);

router.get(
  "/strength",
  requireAuth,
  asyncHandler(async (req, res) => {
    const trackedExercises = [
      "bench press",
      "back squat",
      "deadlift",
      "overhead press",
    ];

    const result = await query(
      `
        SELECT
          LOWER(exercise_name) AS exercise_key,
          MAX(weight_kg) AS pr_weight_kg
        FROM exercise_sets
        WHERE session_id IN (
          SELECT id
          FROM workout_sessions
          WHERE user_id = $1
        )
        GROUP BY LOWER(exercise_name)
      `,
      [req.auth.userId],
    );

    const map = new Map();
    result.rows.forEach((row) => {
      map.set(row.exercise_key, Number(row.pr_weight_kg));
    });

    const records = trackedExercises.map((exercise) => ({
      exercise,
      pr_weight_kg: map.get(exercise) ?? null,
    }));

    res.status(200).json({ strength_records: records });
  }),
);

router.get(
  "/strength/:exercise",
  requireAuth,
  validate(strengthExerciseParamSchema),
  asyncHandler(async (req, res) => {
    const normalized = req.validated.params.exercise.toLowerCase();
    const result = await query(
      `
        SELECT
          ws.started_at,
          es.set_number,
          es.reps,
          es.weight_kg,
          es.is_pr
        FROM exercise_sets es
        JOIN workout_sessions ws ON ws.id = es.session_id
        WHERE ws.user_id = $1
          AND LOWER(es.exercise_name) = $2
        ORDER BY ws.started_at DESC, es.set_number ASC
      `,
      [req.auth.userId, normalized],
    );

    res.status(200).json({
      exercise: normalized,
      history: result.rows,
    });
  }),
);

module.exports = router;
