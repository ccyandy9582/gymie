const { query } = require("../db/pool");
const { HttpError } = require("../utils/http-error");

const DAY_LABELS_ZH = {
  0: "週日",
  1: "週一",
  2: "週二",
  3: "週三",
  4: "週四",
  5: "週五",
  6: "週六",
};

function replaceTemplateVariables(template, variables) {
  return template.replace(/{{\s*([\w_]+)\s*}}/g, (_, key) => {
    const value = variables[key];
    if (value === undefined || value === null) {
      return "";
    }
    return String(value);
  });
}

async function getCurrentPromptVersion(category) {
  const result = await query(
    `
      SELECT
        pv.id,
        pv.version,
        pv.system_prompt,
        pv.user_prompt,
        pv.variables,
        pv.model,
        pv.temperature,
        pv.max_tokens
      FROM prompt_versions pv
      JOIN prompt_templates pt ON pt.id = pv.template_id
      WHERE pt.category = $1
        AND pt.is_active = TRUE
        AND pv.is_current = TRUE
      ORDER BY pv.created_at DESC
      LIMIT 1
    `,
    [category],
  );

  const version = result.rows[0];
  if (!version) {
    throw new HttpError(500, `No active prompt version found for category: ${category}`);
  }

  return version;
}

function mapGoalLabel(goal) {
  const map = {
    build_muscle: "增肌",
    lose_fat: "減脂",
    endurance: "耐力提升",
    general_fitness: "健康維持",
    five_k: "5K",
    ten_k: "10K",
    half_marathon: "半馬",
    marathon: "全馬",
  };
  return map[goal] || goal;
}

function buildPlanPromptVariables({ user, input, analysis }) {
  const availableDays = input.available_days || user.available_days || [];
  const availableDayNames = availableDays.map((day) => DAY_LABELS_ZH[day] || String(day)).join("、");

  return {
    age: user.age ?? 30,
    gender: user.gender ?? "other",
    weight_kg: user.weight_kg ?? 70,
    height_cm: user.height_cm ?? 170,
    fitness_level: user.fitness_level ?? "beginner",
    user_goal: mapGoalLabel(input.goal || user.goal || "general_fitness"),
    duration_weeks: input.duration_weeks,
    available_days: availableDays.length,
    available_day_names: availableDayNames || "週一、週三、週五",
    training_type: input.training_type || user.training_type || "hybrid",
    limitations: input.limitations || "無",
    weekly_run_km: analysis.weekly_run_km ?? 0,
    volume_trend: analysis.volume_trend ?? "無數據",
    completion_rate: analysis.completion_rate ?? 100,
  };
}

module.exports = {
  replaceTemplateVariables,
  getCurrentPromptVersion,
  buildPlanPromptVariables,
};
