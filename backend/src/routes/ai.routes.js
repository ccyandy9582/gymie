const express = require("express");
const { z } = require("zod");
const { query } = require("../db/pool");
const { requireAuth } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { asyncHandler } = require("../utils/async-handler");
const { HttpError } = require("../utils/http-error");
const { analyzeUserHistory } = require("../services/history-analysis.service");
const { generateAiPlanDraft } = require("../services/ai-plan.service");

const router = express.Router();

const generatePlanSchema = z.object({
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

const feedbackSchema = z.object({
  body: z.object({
    usage_log_id: z.string().uuid(),
    was_accepted: z.boolean(),
    feedback_score: z.number().int().min(1).max(5).optional(),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

router.post(
  "/analyze-history",
  requireAuth,
  asyncHandler(async (req, res) => {
    const analysis = await analyzeUserHistory(req.auth.userId);
    res.status(200).json({ analysis });
  }),
);

router.post(
  "/generate-plan",
  requireAuth,
  validate(generatePlanSchema),
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

router.post(
  "/feedback",
  requireAuth,
  validate(feedbackSchema),
  asyncHandler(async (req, res) => {
    const payload = req.validated.body;
    const result = await query(
      `
        UPDATE prompt_usage_logs
        SET
          was_accepted = $1,
          feedback_score = $2
        WHERE id = $3
          AND user_id = $4
        RETURNING id, was_accepted, feedback_score, created_at
      `,
      [
        payload.was_accepted,
        payload.feedback_score ?? null,
        payload.usage_log_id,
        req.auth.userId,
      ],
    );

    if (result.rowCount === 0) {
      throw new HttpError(404, "Prompt usage log not found.");
    }

    res.status(200).json({ feedback: result.rows[0] });
  }),
);

module.exports = router;
