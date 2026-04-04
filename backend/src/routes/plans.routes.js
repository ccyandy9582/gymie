const express = require("express");
const { z } = require("zod");
const { query, withTransaction } = require("../db/pool");
const { requireAuth } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { asyncHandler } = require("../utils/async-handler");
const { HttpError } = require("../utils/http-error");
const { analyzeUserHistory } = require("../services/history-analysis.service");
const { generateAiPlanDraft } = require("../services/ai-plan.service");
const { paceToSeconds } = require("../utils/pace");

const router = express.Router();

const planExerciseSchema = z.object({
  name: z.string().min(1),
  sets: z.number().int().positive().optional(),
  reps: z.number().int().positive().optional(),
  weight_kg: z.number().min(0).optional(),
  distance_km: z.number().min(0).optional(),
  pace_per_km: z.string().optional(),
  run_type: z.string().optional(),
  notes: z.string().optional(),
});

const planDaySchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  type: z.enum(["running", "strength", "rest"]),
  title: z.string().optional(),
  duration_min: z.number().int().positive().optional(),
  intensity_pct: z.number().int().min(1).max(100).optional(),
  notes: z.string().optional(),
  exercises: z.array(planExerciseSchema).optional(),
});

const createPlanSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200),
    type: z.enum(["running", "strength", "hybrid"]),
    goal: z.string().optional(),
    duration_weeks: z.number().int().refine((value) => [4, 8, 12].includes(value), "duration_weeks must be 4, 8, or 12."),
    is_ai_generated: z.boolean().optional(),
    status: z.enum(["active", "archived", "draft"]).optional(),
    weeks: z.array(z.object({
      week: z.number().int().positive(),
      days: z.array(planDaySchema),
    })).optional(),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const updatePlanSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    type: z.enum(["running", "strength", "hybrid"]).optional(),
    goal: z.string().optional(),
    status: z.enum(["active", "archived", "draft"]).optional(),
  }),
  params: z.object({
    id: z.string().uuid(),
  }),
  query: z.object({}).optional(),
});

const planIdSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({
    id: z.string().uuid(),
  }),
  query: z.object({}).optional(),
});

const aiGenerateSchema = z.object({
  body: z.object({
    goal: z.string().min(1),
    duration_weeks: z.number().int().refine((value) => [4, 8, 12].includes(value), "duration_weeks must be 4, 8, or 12."),
    limitations: z.string().optional(),
    available_days: z.array(z.number().int().min(0).max(6)).min(2).max(7).optional(),
    training_type: z.enum(["running", "strength", "hybrid"]).optional(),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const acceptPlanSchema = z.object({
  body: z.object({
    usage_log_id: z.string().uuid().optional(),
  }).optional(),
  params: z.object({
    id: z.string().uuid(),
  }),
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

async function insertPlanStructure(client, planId, weeks) {
  for (const week of weeks || []) {
    for (const day of week.days) {
      const dayResult = await client.query(
        `
          INSERT INTO plan_days (
            plan_id,
            week_number,
            day_of_week,
            type,
            title,
            duration_min,
            intensity_pct,
            notes
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id
        `,
        [
          planId,
          week.week,
          day.day_of_week,
          day.type,
          day.title || null,
          day.duration_min ?? null,
          day.intensity_pct ?? null,
          day.notes || null,
        ],
      );

      const planDayId = dayResult.rows[0].id;
      let orderIndex = 0;
      for (const exercise of day.exercises || []) {
        await client.query(
          `
            INSERT INTO plan_exercises (
              plan_day_id,
              exercise_name,
              sets,
              reps,
              weight_kg,
              distance_km,
              pace_per_km,
              pace_sec_per_km,
              run_type,
              notes,
              order_index
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `,
          [
            planDayId,
            exercise.name,
            exercise.sets ?? null,
            exercise.reps ?? null,
            exercise.weight_kg ?? null,
            exercise.distance_km ?? null,
            exercise.pace_per_km ?? null,
            paceToSeconds(exercise.pace_per_km),
            exercise.run_type ?? null,
            exercise.notes ?? null,
            orderIndex,
          ],
        );
        orderIndex += 1;
      }
    }
  }
}

async function getPlanDetails(planId, userId) {
  const planResult = await query(
    `
      SELECT
        id,
        name,
        type,
        goal,
        duration_weeks,
        is_ai_generated,
        status,
        created_at,
        updated_at
      FROM training_plans
      WHERE id = $1
        AND user_id = $2
    `,
    [planId, userId],
  );

  const plan = planResult.rows[0];
  if (!plan) {
    throw new HttpError(404, "Plan not found.");
  }

  const daysResult = await query(
    `
      SELECT
        pd.id AS plan_day_id,
        pd.week_number,
        pd.day_of_week,
        pd.type,
        pd.title,
        pd.duration_min,
        pd.intensity_pct,
        pd.notes,
        pe.id AS exercise_id,
        pe.exercise_name,
        pe.sets,
        pe.reps,
        pe.weight_kg,
        pe.distance_km,
        pe.pace_per_km,
        pe.run_type,
        pe.notes AS exercise_notes,
        pe.order_index
      FROM plan_days pd
      LEFT JOIN plan_exercises pe ON pe.plan_day_id = pd.id
      WHERE pd.plan_id = $1
      ORDER BY pd.week_number, pd.day_of_week, pe.order_index
    `,
    [planId],
  );

  const weekMap = new Map();
  for (const row of daysResult.rows) {
    if (!weekMap.has(row.week_number)) {
      weekMap.set(row.week_number, {
        week: row.week_number,
        days: [],
      });
    }

    const weekEntry = weekMap.get(row.week_number);
    let dayEntry = weekEntry.days.find((day) => day.plan_day_id === row.plan_day_id);
    if (!dayEntry) {
      dayEntry = {
        plan_day_id: row.plan_day_id,
        day_of_week: row.day_of_week,
        type: row.type,
        title: row.title,
        duration_min: row.duration_min,
        intensity_pct: row.intensity_pct,
        notes: row.notes,
        exercises: [],
      };
      weekEntry.days.push(dayEntry);
    }

    if (row.exercise_id) {
      dayEntry.exercises.push({
        id: row.exercise_id,
        name: row.exercise_name,
        sets: row.sets,
        reps: row.reps,
        weight_kg: row.weight_kg,
        distance_km: row.distance_km,
        pace_per_km: row.pace_per_km,
        run_type: row.run_type,
        notes: row.exercise_notes,
        order_index: row.order_index,
      });
    }
  }

  return {
    ...plan,
    weeks: [...weekMap.values()],
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
          name,
          type,
          goal,
          duration_weeks,
          is_ai_generated,
          status,
          created_at,
          updated_at
        FROM training_plans
        WHERE user_id = $1
        ORDER BY created_at DESC
      `,
      [req.auth.userId],
    );

    res.status(200).json({ plans: result.rows });
  }),
);

router.post(
  "/",
  requireAuth,
  validate(createPlanSchema),
  asyncHandler(async (req, res) => {
    const payload = req.validated.body;
    const planId = await withTransaction(async (client) => {
      const planResult = await client.query(
        `
          INSERT INTO training_plans (
            user_id,
            name,
            type,
            goal,
            duration_weeks,
            is_ai_generated,
            status
          )
          VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'active'))
          RETURNING id
        `,
        [
          req.auth.userId,
          payload.name,
          payload.type,
          payload.goal ?? null,
          payload.duration_weeks,
          payload.is_ai_generated ?? false,
          payload.status ?? null,
        ],
      );

      const createdPlanId = planResult.rows[0].id;
      await insertPlanStructure(client, createdPlanId, payload.weeks);
      return createdPlanId;
    });

    const createdPlan = await getPlanDetails(planId, req.auth.userId);
    res.status(201).json({ plan: createdPlan });
  }),
);

router.post(
  "/ai-generate",
  requireAuth,
  validate(aiGenerateSchema),
  asyncHandler(async (req, res) => {
    const userResult = await query(
      `
        SELECT *
        FROM users
        WHERE id = $1
      `,
      [req.auth.userId],
    );
    const user = userResult.rows[0];
    if (!user) {
      throw new HttpError(404, "User not found.");
    }

    const analysis = await analyzeUserHistory(req.auth.userId);
    const result = await generateAiPlanDraft({
      user,
      input: req.validated.body,
      analysis,
    });

    res.status(200).json(result);
  }),
);

router.get(
  "/:id",
  requireAuth,
  validate(planIdSchema),
  asyncHandler(async (req, res) => {
    const plan = await getPlanDetails(req.validated.params.id, req.auth.userId);
    res.status(200).json({ plan });
  }),
);

router.put(
  "/:id",
  requireAuth,
  validate(updatePlanSchema),
  asyncHandler(async (req, res) => {
    const update = buildPartialUpdate(req.validated.body, ["name", "type", "goal", "status"]);
    if (!update) {
      throw new HttpError(400, "No plan fields provided.");
    }

    const result = await query(
      `
        UPDATE training_plans
        SET ${update.sql}
        WHERE id = $${update.values.length + 1}
          AND user_id = $${update.values.length + 2}
        RETURNING id
      `,
      [...update.values, req.validated.params.id, req.auth.userId],
    );

    if (result.rowCount === 0) {
      throw new HttpError(404, "Plan not found.");
    }

    const plan = await getPlanDetails(req.validated.params.id, req.auth.userId);
    res.status(200).json({ plan });
  }),
);

router.delete(
  "/:id",
  requireAuth,
  validate(planIdSchema),
  asyncHandler(async (req, res) => {
    const result = await query(
      `
        DELETE FROM training_plans
        WHERE id = $1
          AND user_id = $2
      `,
      [req.validated.params.id, req.auth.userId],
    );

    if (result.rowCount === 0) {
      throw new HttpError(404, "Plan not found.");
    }

    res.status(204).send();
  }),
);

router.post(
  "/:id/accept",
  requireAuth,
  validate(acceptPlanSchema),
  asyncHandler(async (req, res) => {
    const planId = req.validated.params.id;
    const payload = req.validated.body || {};

    const result = await withTransaction(async (client) => {
      const planResult = await client.query(
        `
          UPDATE training_plans
          SET status = 'active'
          WHERE id = $1
            AND user_id = $2
          RETURNING id, status
        `,
        [planId, req.auth.userId],
      );

      if (planResult.rowCount === 0) {
        throw new HttpError(404, "Plan not found.");
      }

      if (payload.usage_log_id) {
        await client.query(
          `
            UPDATE prompt_usage_logs
            SET was_accepted = TRUE
            WHERE id = $1
              AND user_id = $2
          `,
          [payload.usage_log_id, req.auth.userId],
        );
      }

      return planResult.rows[0];
    });

    res.status(200).json({
      message: "Plan accepted.",
      plan_id: result.id,
      status: result.status,
    });
  }),
);

module.exports = router;
