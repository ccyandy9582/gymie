"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../../components/page-header";
import { useAuth } from "../../../components/auth-context";
import { LoadingCard } from "../../../components/loading-card";

function toNumber(value) {
  return Number.parseFloat(value || 0);
}

function formatPace(seconds) {
  if (!seconds || seconds <= 0) {
    return "--:--";
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function formatDate(value) {
  return new Date(value).toLocaleString();
}

export default function HistoryPage() {
  const { authedRequest } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [runs, setRuns] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const [runData, workoutData] = await Promise.all([
          authedRequest("/runs"),
          authedRequest("/workouts"),
        ]);
        if (!active) return;
        setRuns(runData.runs || []);
        setWorkouts(workoutData.workouts || []);
      } catch (fetchError) {
        if (active) {
          setError(fetchError.message || "Failed to load history");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [authedRequest]);

  const combined = useMemo(() => {
    const runEntries = runs.map((run) => ({
      id: run.id,
      type: "run",
      started_at: run.started_at,
      title: "Run Session",
      subtitle: formatDate(run.started_at),
      metrics: [
        `${toNumber(run.distance_km).toFixed(2)} km`,
        `${formatPace(Number(run.avg_pace_sec_per_km))} /km`,
        `${Math.round((Number(run.duration_sec || 0) / 60))} min`,
      ],
      searchText: `${run.started_at} run ${toNumber(run.distance_km).toFixed(2)}`,
    }));

    const liftEntries = workouts.map((workout) => ({
      id: workout.id,
      type: "lift",
      started_at: workout.started_at,
      title: "Lift Session",
      subtitle: formatDate(workout.started_at),
      metrics: [
        `${Math.round(toNumber(workout.total_volume_kg))} kg`,
        workout.status,
        `${workout.notes ? "notes" : "no notes"}`,
      ],
      searchText: `${workout.started_at} lift ${Math.round(toNumber(workout.total_volume_kg))}`,
    }));

    return [...runEntries, ...liftEntries].sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
  }, [runs, workouts]);

  const filtered = useMemo(() => {
    return combined.filter((entry) => {
      if (filter !== "all" && entry.type !== filter) {
        return false;
      }
      if (!query.trim()) {
        return true;
      }
      return entry.searchText.toLowerCase().includes(query.toLowerCase());
    });
  }, [combined, filter, query]);

  const summary = useMemo(() => {
    const totalDistance = runs.reduce((sum, run) => sum + toNumber(run.distance_km), 0);
    const totalVolume = workouts.reduce((sum, workout) => sum + toNumber(workout.total_volume_kg), 0);
    return { totalDistance, totalVolume };
  }, [runs, workouts]);

  if (loading) {
    return <LoadingCard message="Building workout timeline..." />;
  }

  return (
    <section className="fade-in">
      <PageHeader
        eyebrow="Workout History"
        title="Workout History"
        subtitle="Asymmetric timeline of your run and lift logs."
      />

      {error ? <div className="card" style={{ padding: "0.8rem 1rem", borderColor: "var(--danger)", color: "var(--danger)", marginBottom: "1rem" }}>{error}</div> : null}

      <div className="grid-2" style={{ marginBottom: "1rem" }}>
        <article className="card" style={{ padding: "1rem" }}>
          <div className="label">Total Distance</div>
          <div className="stat-value" style={{ fontSize: "2rem", color: "var(--tertiary)" }}>{summary.totalDistance.toFixed(1)} km</div>
        </article>
        <article className="card" style={{ padding: "1rem" }}>
          <div className="label">Monthly Volume</div>
          <div className="stat-value" style={{ fontSize: "2rem", color: "var(--primary)" }}>{Math.round(summary.totalVolume)} kg</div>
        </article>
      </div>

      <div className="card" style={{ padding: "0.8rem", display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center", marginBottom: "1rem" }}>
        <input
          className="field"
          style={{ maxWidth: 340 }}
          placeholder="Search by date or metric"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {["all", "run", "lift"].map((type) => (
          <button
            type="button"
            key={type}
            className={`chip ${filter === type ? "active" : ""}`}
            onClick={() => setFilter(type)}
          >
            {type}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gap: "0.75rem" }}>
        {filtered.map((entry) => (
          <article key={`${entry.type}-${entry.id}`} className="card" style={{ padding: "0.9rem 1rem", borderLeft: entry.type === "run" ? "4px solid var(--tertiary)" : "4px solid var(--primary)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.7rem", flexWrap: "wrap" }}>
              <div>
                <div className="headline" style={{ margin: 0, fontSize: "1rem" }}>{entry.title}</div>
                <div className="muted">{entry.subtitle}</div>
              </div>
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                {entry.metrics.map((metric) => (
                  <span key={metric} className="chip active" style={{ fontSize: "0.72rem" }}>{metric}</span>
                ))}
              </div>
            </div>
          </article>
        ))}
        {filtered.length === 0 ? <div className="muted">No entries match current filters.</div> : null}
      </div>
    </section>
  );
}
