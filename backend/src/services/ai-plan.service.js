const Anthropic = require("@anthropic-ai/sdk");
const { z } = require("zod");
const { env } = require("../config/env");
const { query, withTransaction } = require("../db/pool");
const { paceToSeconds } = require("../utils/pace");
const { HttpError } = require("../utils/http-error");
const { getCurrentPromptVersion, replaceTemplateVariables, buildPlanPromptVariables } = require("./prompt.service");

const ExerciseSchema = z.object({
  name: z.string().min(1),
  sets: z.coerce.number().int().positive().optional(),
  reps: z.coerce.number().int().positive().optional(),
  weight_kg: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
}).passthrough();

const PlanDaySchema = z.object({
  day_of_week: z.coerce.number().int().min(0).max(6),
  type: z.enum(["running", "strength", "rest"]),
  title: z.string().min(1).optional(),
  duration_min: z.coerce.number().int().positive().optional(),
  intensity_pct: z.coerce.number().int().min(1).max(100).optional(),
  exercises: z.array(ExerciseSchema).optional(),
  distance_km: z.coerce.number().positive().optional(),
  pace_target: z.string().optional(),
  run_type: z.string().optional(),
  notes: z.string().optional(),
}).passthrough();

const PlanWeekSchema = z.object({
  week: z.coerce.number().int().positive(),
  days: z.array(PlanDaySchema),
}).passthrough();

const GeneratedPlanSchema = z.object({
  plan_name: z.string().min(1),
  reasoning: z.string().min(1),
  focus: z.string().min(1),
  avg_rpe: z.coerce.number().min(1).max(10),
  total_sessions: z.coerce.number().int().positive(),
  weeks: z.array(PlanWeekSchema).min(1),
}).passthrough();

function stripMarkdownFences(rawText) {
  const trimmed = rawText.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  return trimmed;
}

function parsePlanJson(rawText) {
  const jsonText = stripMarkdownFences(rawText);
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new HttpError(502, "AI response is not valid JSON.", { rawText });
  }

  const validated = GeneratedPlanSchema.safeParse(parsed);
  if (!validated.success) {
    throw new HttpError(502, "AI response JSON schema validation failed.", validated.error.issues);
  }

  return validated.data;
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new HttpError(504, "AI request timeout.")), timeoutMs);
    }),
  ]);
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildFallbackPlan(input) {
  const availableDays = Array.isArray(input.available_days) && input.available_days.length > 0
    ? input.available_days
    : [1, 3, 5, 6];
  const sortedDays = [...availableDays].sort((a, b) => a - b);
  const durationWeeks = input.duration_weeks || 4;
  const trainingType = input.training_type || "hybrid";

  const weeks = [];
  for (let week = 1; week <= durationWeeks; week += 1) {
    const dayPlans = [];
    let trainingSequence = 0;

    for (let day = 0; day <= 6; day += 1) {
      if (!sortedDays.includes(day)) {
        dayPlans.push({
          day_of_week: day,
          type: "rest",
          title: "Active Recovery",
          notes: "輕鬆走路與伸展 20 分鐘",
        });
        continue;
      }

      let dayType = trainingType;
      if (trainingType === "hybrid") {
        dayType = trainingSequence % 2 === 0 ? "strength" : "running";
      }
      trainingSequence += 1;

      if (dayType === "strength") {
        dayPlans.push({
          day_of_week: day,
          type: "strength",
          title: `Strength Block W${week}`,
          duration_min: 60,
          intensity_pct: Math.min(85, 65 + (week * 3)),
          exercises: [
            { name: "Back Squat", sets: 4, reps: 6, weight_kg: 50 + (week * 2), notes: "RPE 7-8" },
            { name: "Bench Press", sets: 4, reps: 8, weight_kg: 40 + (week * 1.5), notes: "控制節奏" },
            { name: "Romanian Deadlift", sets: 3, reps: 10, weight_kg: 45 + (week * 2), notes: "離心 2 秒" },
          ],
        });
      } else {
        const distance = 5 + (week * 0.5);
        dayPlans.push({
          day_of_week: day,
          type: "running",
          title: `Aerobic Progression W${week}`,
          distance_km: Number(distance.toFixed(1)),
          pace_target: "5:45",
          run_type: "easy",
          notes: "最後 1 公里保持穩定節奏",
        });
      }
    }

    weeks.push({
      week,
      days: dayPlans,
    });
  }

  const totalSessions = weeks.reduce(
    (sum, week) => sum + week.days.filter((day) => day.type !== "rest").length,
    0,
  );

  return {
    plan_name: "Fallback Progressive Plan",
    reasoning: "由系統模板產生，維持漸進負荷與恢復平衡。",
    focus: trainingType === "running" ? "Aerobic Base" : "Power Endurance",
    avg_rpe: 7,
    total_sessions: totalSessions,
    weeks,
  };
}

async function createPromptUsageLog({
  versionId,
  userId,
  inputVariables,
  rawResponse,
  inputTokens,
  outputTokens,
  latencyMs,
  errorMessage,
}) {
  const result = await query(
    `
      INSERT INTO prompt_usage_logs (
        version_id,
        user_id,
        input_variables,
        raw_response,
        input_tokens,
        output_tokens,
        latency_ms,
        error_message
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, request_id
    `,
    [
      versionId,
      userId,
      inputVariables,
      rawResponse,
      inputTokens ?? null,
      outputTokens ?? null,
      latencyMs ?? null,
      errorMessage ?? null,
    ],
  );

  return result.rows[0];
}

async function callAnthropicPlanGeneration({ promptVersion, userPrompt }) {
  const client = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
  });

  const response = await withTimeout(
    client.messages.create({
      model: promptVersion.model || env.ANTHROPIC_MODEL,
      max_tokens: Number(promptVersion.max_tokens || 2000),
      temperature: Number(promptVersion.temperature || 0.7),
      system: promptVersion.system_prompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    }),
    env.AI_TIMEOUT_MS,
  );

  const rawText = response.content
    .filter((entry) => entry.type === "text")
    .map((entry) => entry.text)
    .join("\n")
    .trim();

  return {
    rawText,
    usage: response.usage,
  };
}

async function persistDraftPlan({ userId, input, parsedPlan, renderedPrompt }) {
  return withTransaction(async (client) => {
    const planInsertResult = await client.query(
      `
        INSERT INTO training_plans (
          user_id,
          name,
          type,
          goal,
          duration_weeks,
          is_ai_generated,
          ai_prompt,
          status
        )
        VALUES ($1, $2, $3, $4, $5, TRUE, $6, 'draft')
        RETURNING id, name, type, duration_weeks, status, created_at
      `,
      [
        userId,
        parsedPlan.plan_name,
        input.training_type || "hybrid",
        input.goal || "general_fitness",
        input.duration_weeks,
        renderedPrompt,
      ],
    );

    const draftPlan = planInsertResult.rows[0];

    for (const week of parsedPlan.weeks) {
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
            draftPlan.id,
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

        if (day.type === "strength") {
          for (const exercise of day.exercises || []) {
            await client.query(
              `
                INSERT INTO plan_exercises (
                  plan_day_id,
                  exercise_name,
                  sets,
                  reps,
                  weight_kg,
                  notes,
                  order_index
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
              `,
              [
                planDayId,
                exercise.name,
                exercise.sets ?? null,
                exercise.reps ?? null,
                exercise.weight_kg ?? null,
                exercise.notes || null,
                orderIndex,
              ],
            );
            orderIndex += 1;
          }
        }

        if (day.type === "running") {
          await client.query(
            `
              INSERT INTO plan_exercises (
                plan_day_id,
                exercise_name,
                distance_km,
                pace_per_km,
                pace_sec_per_km,
                run_type,
                notes,
                order_index
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `,
            [
              planDayId,
              day.title || "Run Session",
              day.distance_km ?? null,
              day.pace_target || null,
              paceToSeconds(day.pace_target),
              day.run_type || null,
              day.notes || null,
              0,
            ],
          );
        }
      }
    }

    return draftPlan;
  });
}

async function generateAiPlanDraft({ user, input, analysis }) {
  const promptVersion = await getCurrentPromptVersion("plan_generation");
  const variables = buildPlanPromptVariables({ user, input, analysis });
  const userPrompt = replaceTemplateVariables(promptVersion.user_prompt, variables);

  let parsedPlan;
  let rawResponse = "";
  let tokenUsage;
  let errorMessage = null;
  let source = "anthropic";
  const startedAtMs = Date.now();

  if (!env.ANTHROPIC_API_KEY) {
    parsedPlan = buildFallbackPlan(input);
    rawResponse = JSON.stringify(parsedPlan);
    source = "fallback_no_api_key";
  } else {
    let attempt = 0;
    while (attempt <= env.AI_MAX_RETRIES) {
      try {
        const generated = await callAnthropicPlanGeneration({
          promptVersion,
          userPrompt,
        });
        rawResponse = generated.rawText;
        tokenUsage = generated.usage;
        parsedPlan = parsePlanJson(rawResponse);
        break;
      } catch (error) {
        attempt += 1;
        errorMessage = error.message;
        if (attempt > env.AI_MAX_RETRIES) {
          parsedPlan = buildFallbackPlan(input);
          rawResponse = JSON.stringify(parsedPlan);
          source = "fallback_after_error";
          break;
        }
        const retryDelayMs = 1000 * (2 ** (attempt - 1));
        await wait(retryDelayMs);
      }
    }
  }

  const logEntry = await createPromptUsageLog({
    versionId: promptVersion.id,
    userId: user.id,
    inputVariables: variables,
    rawResponse,
    inputTokens: tokenUsage?.input_tokens,
    outputTokens: tokenUsage?.output_tokens,
    latencyMs: Date.now() - startedAtMs,
    errorMessage,
  });

  const draftPlan = await persistDraftPlan({
    userId: user.id,
    input,
    parsedPlan,
    renderedPrompt: userPrompt,
  });

  return {
    draftPlanId: draftPlan.id,
    usageLogId: logEntry.id,
    requestId: logEntry.request_id,
    source,
    promptVersion: {
      id: promptVersion.id,
      version: promptVersion.version,
      model: promptVersion.model,
    },
    analysis,
    plan: parsedPlan,
  };
}

module.exports = {
  generateAiPlanDraft,
};
