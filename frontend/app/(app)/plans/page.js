"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../../components/page-header";
import { useAuth } from "../../../components/auth-context";
import { LoadingCard } from "../../../components/loading-card";

const GOALS = [
  { label: "Build Muscle", value: "build_muscle" },
  { label: "Lose Fat", value: "lose_fat" },
  { label: "5K", value: "five_k" },
  { label: "10K", value: "ten_k" },
  { label: "Half Marathon", value: "half_marathon" },
  { label: "Marathon", value: "marathon" },
  { label: "General Fitness", value: "general_fitness" },
];

const DURATION_OPTIONS = [4, 8, 12];
const TRAINING_TYPE_LABELS = {
  running: "Running",
  strength: "Strength",
  hybrid: "Hybrid",
};
const STATUS_LABELS = {
  active: "Active",
  archived: "Archived",
  draft: "Draft",
};

function dayLabel(day) {
  const map = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return map[day] || "-";
}

function prettyType(type) {
  if (type === "running") return "RUN";
  if (type === "strength") return "LIFT";
  return "REST";
}

function formatGoal(goal) {
  const match = GOALS.find((item) => item.value === goal);
  if (match) {
    return match.label;
  }
  if (!goal) {
    return "-";
  }
  return String(goal).replaceAll("_", " ");
}

function formatDate(value) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function toCycleProgress(plan) {
  const duration = Number(plan?.duration_weeks || 0);
  if (!duration) {
    return { week: "-", totalWeeks: "-", percent: 0, endDate: "-" };
  }

  const createdAt = new Date(plan?.created_at || "");
  if (Number.isNaN(createdAt.getTime())) {
    return { week: 1, totalWeeks: duration, percent: Math.round(100 / duration), endDate: "-" };
  }

  const now = new Date();
  const elapsedDays = Math.max(0, Math.floor((now - createdAt) / (1000 * 60 * 60 * 24)));
  const week = Math.min(duration, Math.floor(elapsedDays / 7) + 1);
  const percent = Math.max(4, Math.round((week / duration) * 100));

  const endDate = new Date(createdAt);
  endDate.setDate(endDate.getDate() + (duration * 7) - 1);

  return {
    week,
    totalWeeks: duration,
    percent,
    endDate: formatDate(endDate.toISOString()),
  };
}

export default function PlansPage() {
  const { user, authedRequest } = useAuth();
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [error, setError] = useState("");
  const [plans, setPlans] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(null);
  const [accepting, setAccepting] = useState(false);

  const [form, setForm] = useState({
    goal: user?.goal || "general_fitness",
    duration_weeks: 8,
    limitations: "",
    available_days: Array.isArray(user?.available_days) && user.available_days.length >= 2 ? user.available_days : [1, 3, 5, 6],
    training_type: user?.training_type || "hybrid",
  });

  useEffect(() => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      goal: user.goal || prev.goal,
      available_days: Array.isArray(user.available_days) && user.available_days.length >= 2 ? user.available_days : prev.available_days,
      training_type: user.training_type || prev.training_type,
    }));
  }, [user]);

  async function loadPlans() {
    try {
      setLoadingPlans(true);
      const data = await authedRequest("/plans");
      setPlans(data.plans || []);
    } catch (loadError) {
      setError(loadError.message || "Failed to load plans");
    } finally {
      setLoadingPlans(false);
    }
  }

  useEffect(() => {
    loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const latestActivePlan = useMemo(() => plans.find((plan) => plan.status === "active"), [plans]);
  const activeProgress = useMemo(() => toCycleProgress(latestActivePlan), [latestActivePlan]);

  function toggleDay(day) {
    setForm((prev) => {
      const exists = prev.available_days.includes(day);
      if (exists) {
        if (prev.available_days.length <= 2) return prev;
        return { ...prev, available_days: prev.available_days.filter((value) => value !== day) };
      }
      return { ...prev, available_days: [...prev.available_days, day].sort((a, b) => a - b) };
    });
  }

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    try {
      const data = await authedRequest("/plans/ai-generate", {
        method: "POST",
        body: form,
      });
      setGenerated(data);
      await loadPlans();
    } catch (generateError) {
      setError(generateError.message || "Failed to generate plan");
    } finally {
      setGenerating(false);
    }
  }

  async function handleAccept() {
    if (!generated?.draftPlanId) {
      return;
    }

    setAccepting(true);
    setError("");
    try {
      await authedRequest(`/plans/${generated.draftPlanId}/accept`, {
        method: "POST",
        body: { usage_log_id: generated.usageLogId },
      });
      setGenerated(null);
      await loadPlans();
    } catch (acceptError) {
      setError(acceptError.message || "Failed to accept plan");
    } finally {
      setAccepting(false);
    }
  }

  if (loadingPlans) {
    return <LoadingCard message="Loading plan workspace..." />;
  }

  return (
    <section className="fade-in">
      <PageHeader
        eyebrow="AI Planning"
        title="Cycle Generator"
        subtitle="Define your target and constraints, then Gymie drafts a progressive hybrid plan with explanation metrics."
      />

      {error ? <div className="card" style={{ padding: "0.8rem 1rem", borderColor: "var(--danger)", color: "var(--danger)", marginBottom: "1rem" }}>{error}</div> : null}

      <div className="grid-2">
        <section className="card" style={{ padding: "1rem", display: "grid", gap: "0.8rem" }}>
          <div className="label">UC-40 · Input Goal and Constraints</div>

          <div>
            <div className="label" style={{ marginBottom: "0.45rem" }}>Goal</div>
            <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
              {GOALS.map((goal) => (
                <button
                  key={goal.value}
                  type="button"
                  className={`chip ${form.goal === goal.value ? "active" : ""}`}
                  onClick={() => setForm((prev) => ({ ...prev, goal: goal.value }))}
                >
                  {goal.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="label" style={{ marginBottom: "0.45rem" }}>Duration</div>
            <div style={{ display: "flex", gap: "0.45rem" }}>
              {DURATION_OPTIONS.map((weeks) => (
                <button
                  key={weeks}
                  type="button"
                  className={`chip ${form.duration_weeks === weeks ? "active" : ""}`}
                  onClick={() => setForm((prev) => ({ ...prev, duration_weeks: weeks }))}
                >
                  {weeks}W
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="label" style={{ marginBottom: "0.45rem" }}>Training Type</div>
            <div style={{ display: "flex", gap: "0.45rem" }}>
              {["running", "strength", "hybrid"].map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`chip ${form.training_type === type ? "active" : ""}`}
                  onClick={() => setForm((prev) => ({ ...prev, training_type: type }))}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="label" style={{ marginBottom: "0.45rem" }}>Available Days</div>
            <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
              {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                <button
                  key={day}
                  type="button"
                  className={`chip ${form.available_days.includes(day) ? "active" : ""}`}
                  onClick={() => toggleDay(day)}
                >
                  {dayLabel(day)}
                </button>
              ))}
            </div>
          </div>

          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span className="label">Limitations</span>
            <textarea
              className="field"
              rows={3}
              placeholder="injury, no equipment, low time..."
              value={form.limitations}
              onChange={(event) => setForm((prev) => ({ ...prev, limitations: event.target.value }))}
            />
          </label>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.55rem" }}>
            <button type="button" className="btn btn-ghost" onClick={() => setGenerated(null)}>
              Clear Preview
            </button>
            <button type="button" className="btn btn-primary" onClick={handleGenerate} disabled={generating || form.available_days.length < 2}>
              {generating ? "Generating..." : "Generate Plan"}
            </button>
          </div>
        </section>

        <section className="card" style={{ padding: "1rem", display: "grid", gap: "0.7rem", alignContent: "start" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.65rem", alignItems: "center", flexWrap: "wrap" }}>
            <div className="label">Current Active Plan</div>
            {latestActivePlan ? (
              <span
                className="label"
                style={{
                  border: "1px solid var(--outline-variant)",
                  borderRadius: "999px",
                  padding: "0.3rem 0.55rem",
                  color: latestActivePlan.status === "active" ? "var(--tertiary)" : "var(--on-surface-variant)",
                  borderColor: latestActivePlan.status === "active" ? "rgba(166,215,0,0.5)" : "var(--outline-variant)",
                }}
              >
                {STATUS_LABELS[latestActivePlan.status] || "Unknown"}
              </span>
            ) : null}
          </div>
          {latestActivePlan ? (
            <>
              <h3 className="headline" style={{ margin: "0.2rem 0 0", fontSize: "1.4rem", color: "var(--primary)" }}>
                {latestActivePlan.name}
              </h3>
              <div className="muted">Duration: {latestActivePlan.duration_weeks} weeks</div>
              <div className="muted">Type: {TRAINING_TYPE_LABELS[latestActivePlan.type] || latestActivePlan.type || "-"}</div>
              <div className="muted">Goal: {formatGoal(latestActivePlan.goal)}</div>
              <div className="muted">Last Updated: {formatDate(latestActivePlan.updated_at)}</div>

              <div style={{ marginTop: "0.35rem", display: "grid", gap: "0.35rem" }}>
                <div className="label">
                  Cycle Progress · Week {activeProgress.week} / {activeProgress.totalWeeks}
                </div>
                <div
                  aria-label="Cycle progress"
                  role="progressbar"
                  aria-valuenow={typeof activeProgress.percent === "number" ? activeProgress.percent : 0}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  style={{
                    height: 8,
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.08)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${activeProgress.percent}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, var(--primary), var(--tertiary))",
                    }}
                  />
                </div>
                <div className="muted">Target End: {activeProgress.endDate}</div>
              </div>

              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
                <button type="button" className="btn btn-ghost" onClick={loadPlans}>
                  Refresh
                </button>
                <Link href="/dashboard" className="btn btn-secondary">
                  Open Dashboard
                </Link>
              </div>
            </>
          ) : (
            <div className="muted">No active plan yet.</div>
          )}
        </section>
      </div>

      {generated ? (
        <section className="card fade-in" style={{ marginTop: "1rem", padding: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.8rem", flexWrap: "wrap" }}>
            <div>
              <div className="label">UC-43 · AI Plan Preview</div>
              <h2 className="headline" style={{ margin: "0.3rem 0", fontSize: "1.6rem" }}>{generated.plan.plan_name}</h2>
              <p className="muted" style={{ margin: 0 }}>{generated.plan.reasoning}</p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <button type="button" className="btn btn-secondary" onClick={handleGenerate} disabled={generating}>
                {generating ? "Regenerating..." : "Regenerate"}
              </button>
              <button type="button" className="btn btn-primary" onClick={handleAccept} disabled={accepting}>
                {accepting ? "Committing..." : "Commit To Plan"}
              </button>
            </div>
          </div>

          <div className="grid-3" style={{ marginTop: "1rem" }}>
            <article className="card" style={{ padding: "0.8rem" }}>
              <div className="label">Avg. RPE</div>
              <div className="stat-value" style={{ fontSize: "1.7rem" }}>{generated.plan.avg_rpe}</div>
            </article>
            <article className="card" style={{ padding: "0.8rem" }}>
              <div className="label">Total Sessions</div>
              <div className="stat-value" style={{ fontSize: "1.7rem" }}>{generated.plan.total_sessions}</div>
            </article>
            <article className="card" style={{ padding: "0.8rem" }}>
              <div className="label">Focus</div>
              <div className="stat-value" style={{ fontSize: "1.25rem", color: "var(--tertiary)" }}>{generated.plan.focus}</div>
            </article>
          </div>

          {generated.plan.weeks.map((week) => (
            <div key={week.week} style={{ marginTop: "1rem" }}>
              <div className="label" style={{ marginBottom: "0.5rem" }}>Week {week.week}</div>
              <div className="calendar-grid">
                {week.days.map((day, index) => (
                  <article
                    key={`${week.week}-${day.day_of_week}-${index}`}
                    className="card"
                    style={{
                      minHeight: 138,
                      padding: "0.7rem",
                      borderTop: day.type === "running"
                        ? "3px solid var(--tertiary)"
                        : day.type === "strength"
                          ? "3px solid var(--primary)"
                          : "3px dashed var(--outline-variant)",
                    }}
                  >
                    <div className="label">{dayLabel(day.day_of_week)}</div>
                    <div style={{ fontWeight: 700, marginTop: "0.3rem", fontSize: "0.83rem" }}>{prettyType(day.type)}</div>
                    <div style={{ fontSize: "0.83rem", marginTop: "0.35rem" }}>{day.title || "Recovery"}</div>
                    {day.type === "running" ? (
                      <div className="muted" style={{ marginTop: "0.35rem", fontSize: "0.78rem" }}>
                        {day.distance_km || day.exercises?.[0]?.distance_km || "-"} km
                      </div>
                    ) : null}
                    {day.type === "strength" ? (
                      <div className="muted" style={{ marginTop: "0.35rem", fontSize: "0.78rem" }}>
                        {(day.exercises || []).length} lifts
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          ))}
        </section>
      ) : null}
    </section>
  );
}
