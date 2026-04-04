const express = require("express");
const { z } = require("zod");
const { query, withTransaction } = require("../db/pool");
const { requireAuth } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { asyncHandler } = require("../utils/async-handler");
const { HttpError } = require("../utils/http-error");
const { secondsToPace, paceToSeconds } = require("../utils/pace");

const router = express.Router();

const runIdParamSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({
    id: z.string().uuid(),
  }),
  query: z.object({}).optional(),
});

const createRunSchema = z.object({
  body: z.object({
    plan_day_id: z.string().uuid().optional(),
    started_at: z.string().datetime().optional(),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const finishRunSchema = z.object({
  body: z.object({
    ended_at: z.string().datetime().optional(),
    distance_km: z.number().min(0.01),
    duration_sec: z.number().int().positive(),
    avg_heart_rate: z.number().int().min(0).optional(),
    calories: z.number().int().min(0).optional(),
    route_geojson: z.any().optional(),
    laps: z.array(z.object({
      lap_number: z.number().int().positive(),
      distance_km: z.number().min(0.01),
      duration_sec: z.number().int().positive(),
      pace: z.string().optional(),
      heart_rate: z.number().int().min(0).optional(),
    })).optional(),
  }),
  params: z.object({
    id: z.string().uuid(),
  }),
  query: z.object({}).optional(),
});

async function ensureRunOwnership(runId, userId) {
  const result = await query(
    `
      SELECT id, status
      FROM run_sessions
      WHERE id = $1
        AND user_id = $2
    `,
    [runId, userId],
  );

  const run = result.rows[0];
  if (!run) {
    throw new HttpError(404, "Run session not found.");
  }

  return run;
}

async function getRunWithLaps(runId, userId) {
  const runResult = await query(
    `
      SELECT
        id,
        plan_day_id,
        started_at,
        ended_at,
        distance_km,
        duration_sec,
        avg_pace,
        avg_pace_sec_per_km,
        avg_heart_rate,
        calories,
        route_geojson,
        status,
        created_at,
        updated_at
      FROM run_sessions
      WHERE id = $1
        AND user_id = $2
    `,
    [runId, userId],
  );

  const run = runResult.rows[0];
  if (!run) {
    throw new HttpError(404, "Run session not found.");
  }

  const lapResult = await query(
    `
      SELECT
        id,
        lap_number,
        distance_km,
        duration_sec,
        pace,
        pace_sec_per_km,
        heart_rate
      FROM run_laps
      WHERE run_session_id = $1
      ORDER BY lap_number ASC
    `,
    [runId],
  );

  return {
    ...run,
    laps: lapResult.rows,
  };
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
          distance_km,
          duration_sec,
          avg_pace,
          avg_pace_sec_per_km,
          avg_heart_rate,
          calories,
          status,
          created_at,
          updated_at
        FROM run_sessions
        WHERE user_id = $1
        ORDER BY started_at DESC
      `,
      [req.auth.userId],
    );

    res.status(200).json({ runs: result.rows });
  }),
);

router.post(
  "/",
  requireAuth,
  validate(createRunSchema),
  asyncHandler(async (req, res) => {
    const payload = req.validated.body;
    const result = await query(
      `
        INSERT INTO run_sessions (
          user_id,
          plan_day_id,
          started_at,
          status
        )
        VALUES ($1, $2, COALESCE($3, NOW()), 'in_progress')
        RETURNING *
      `,
      [
        req.auth.userId,
        payload.plan_day_id ?? null,
        payload.started_at ?? null,
      ],
    );

    res.status(201).json({ run: result.rows[0] });
  }),
);

router.get(
  "/:id",
  requireAuth,
  validate(runIdParamSchema),
  asyncHandler(async (req, res) => {
    const run = await getRunWithLaps(req.validated.params.id, req.auth.userId);
    res.status(200).json({ run });
  }),
);

router.put(
  "/:id/finish",
  requireAuth,
  validate(finishRunSchema),
  asyncHandler(async (req, res) => {
    const runId = req.validated.params.id;
    const payload = req.validated.body;
    await ensureRunOwnership(runId, req.auth.userId);

    const avgPaceSec = Math.round(payload.duration_sec / payload.distance_km);
    const avgPace = secondsToPace(avgPaceSec);

    const run = await withTransaction(async (client) => {
      const lockResult = await client.query(
        `
          SELECT status
          FROM run_sessions
          WHERE id = $1
            AND user_id = $2
          FOR UPDATE
        `,
        [runId, req.auth.userId],
      );

      const lockedRun = lockResult.rows[0];
      if (!lockedRun) {
        throw new HttpError(404, "Run session not found.");
      }

      if (lockedRun.status === "completed") {
        const current = await getRunWithLaps(runId, req.auth.userId);
        return current;
      }

      const runUpdateResult = await client.query(
        `
          UPDATE run_sessions
          SET
            ended_at = COALESCE($1, NOW()),
            distance_km = $2,
            duration_sec = $3,
            avg_pace = $4,
            avg_pace_sec_per_km = $5,
            avg_heart_rate = $6,
            calories = $7,
            route_geojson = $8,
            status = 'completed'
          WHERE id = $9
          RETURNING *
        `,
        [
          payload.ended_at ?? null,
          payload.distance_km,
          payload.duration_sec,
          avgPace,
          avgPaceSec,
          payload.avg_heart_rate ?? null,
          payload.calories ?? null,
          payload.route_geojson ?? null,
          runId,
        ],
      );

      await client.query(
        `
          DELETE FROM run_laps
          WHERE run_session_id = $1
        `,
        [runId],
      );

      for (const lap of payload.laps || []) {
        await client.query(
          `
            INSERT INTO run_laps (
              run_session_id,
              lap_number,
              distance_km,
              duration_sec,
              pace,
              pace_sec_per_km,
              heart_rate
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            runId,
            lap.lap_number,
            lap.distance_km,
            lap.duration_sec,
            lap.pace || secondsToPace(Math.round(lap.duration_sec / lap.distance_km)),
            lap.pace ? paceToSeconds(lap.pace) : Math.round(lap.duration_sec / lap.distance_km),
            lap.heart_rate ?? null,
          ],
        );
      }

      return runUpdateResult.rows[0];
    });

    const latestRun = run.id ? await getRunWithLaps(run.id, req.auth.userId) : run;
    res.status(200).json({ run: latestRun });
  }),
);

module.exports = router;
