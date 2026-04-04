const { query } = require("../db/pool");

function roundTo(value, decimalPlaces = 2) {
  if (!Number.isFinite(Number(value))) {
    return 0;
  }
  const factor = 10 ** decimalPlaces;
  return Math.round(Number(value) * factor) / factor;
}

function detectTrend(recentValue, priorValue) {
  if (recentValue <= 0 && priorValue <= 0) {
    return "無數據";
  }
  if (priorValue <= 0) {
    return "上升";
  }

  const ratio = recentValue / priorValue;
  if (ratio >= 1.05) {
    return "上升";
  }
  if (ratio <= 0.95) {
    return "下降";
  }
  return "持平";
}

async function analyzeUserHistory(userId) {
  const workoutCountResult = await query(
    `
      SELECT
        (
          SELECT COUNT(*)
          FROM workout_sessions
          WHERE user_id = $1 AND status = 'completed'
        )::INT AS workout_count,
        (
          SELECT COUNT(*)
          FROM run_sessions
          WHERE user_id = $1 AND status = 'completed'
        )::INT AS run_count
    `,
    [userId],
  );

  const counts = workoutCountResult.rows[0];
  const totalCompletedSessions = (counts.workout_count || 0) + (counts.run_count || 0);

  const weeklyRunResult = await query(
    `
      SELECT COALESCE(SUM(distance_km), 0) / 4.0 AS avg_weekly_run_km
      FROM run_sessions
      WHERE user_id = $1
        AND status = 'completed'
        AND started_at >= NOW() - INTERVAL '28 days'
    `,
    [userId],
  );

  const volumeTrendResult = await query(
    `
      SELECT
        COALESCE(SUM(CASE WHEN started_at >= NOW() - INTERVAL '14 days' THEN total_volume_kg ELSE 0 END), 0) AS recent_volume,
        COALESCE(SUM(CASE
          WHEN started_at < NOW() - INTERVAL '14 days'
           AND started_at >= NOW() - INTERVAL '28 days'
          THEN total_volume_kg
          ELSE 0
        END), 0) AS prior_volume
      FROM workout_sessions
      WHERE user_id = $1
        AND status = 'completed'
    `,
    [userId],
  );

  const completionRateResult = await query(
    `
      WITH sessions AS (
        SELECT status
        FROM workout_sessions
        WHERE user_id = $1
          AND started_at >= NOW() - INTERVAL '28 days'
        UNION ALL
        SELECT status
        FROM run_sessions
        WHERE user_id = $1
          AND started_at >= NOW() - INTERVAL '28 days'
      )
      SELECT
        COALESCE(ROUND(
          100.0 * COUNT(*) FILTER (WHERE status = 'completed') / NULLIF(COUNT(*), 0)
        ), 100) AS completion_rate
      FROM sessions
    `,
    [userId],
  );

  const mainLiftResult = await query(
    `
      SELECT
        exercise_name,
        MAX(weight_kg) AS max_weight_kg
      FROM exercise_sets
      WHERE session_id IN (
        SELECT id
        FROM workout_sessions
        WHERE user_id = $1
      )
      GROUP BY exercise_name
      ORDER BY max_weight_kg DESC
      LIMIT 5
    `,
    [userId],
  );

  const recentVolume = Number(volumeTrendResult.rows[0].recent_volume || 0);
  const priorVolume = Number(volumeTrendResult.rows[0].prior_volume || 0);

  const analysis = {
    has_history: totalCompletedSessions > 4,
    total_completed_sessions: totalCompletedSessions,
    weekly_run_km: roundTo(weeklyRunResult.rows[0].avg_weekly_run_km || 0),
    volume_trend: detectTrend(recentVolume, priorVolume),
    completion_rate: Number(completionRateResult.rows[0].completion_rate || 100),
    main_lifts: mainLiftResult.rows.map((row) => ({
      exercise_name: row.exercise_name,
      max_weight_kg: Number(row.max_weight_kg),
    })),
  };

  if (!analysis.has_history) {
    analysis.weekly_run_km = analysis.weekly_run_km || 0;
    analysis.volume_trend = "無數據";
    analysis.completion_rate = 100;
  }

  return analysis;
}

module.exports = {
  analyzeUserHistory,
};
