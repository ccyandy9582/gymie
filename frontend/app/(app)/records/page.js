"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../../components/page-header";
import { useAuth } from "../../../components/auth-context";
import { LoadingCard } from "../../../components/loading-card";

function formatRunTime(seconds) {
  if (!seconds || seconds <= 0) {
    return "--:--";
  }
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function toNumber(value) {
  return Number.parseFloat(value || 0);
}

export default function RecordsPage() {
  const { authedRequest } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [runningRecords, setRunningRecords] = useState([]);
  const [strengthRecords, setStrengthRecords] = useState([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const [runData, strengthData] = await Promise.all([
          authedRequest("/records/running"),
          authedRequest("/records/strength"),
        ]);
        if (!active) return;
        setRunningRecords(runData.running_records || []);
        setStrengthRecords(strengthData.strength_records || []);
      } catch (fetchError) {
        if (active) {
          setError(fetchError.message || "Failed to load records");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [authedRequest]);

  const progress = useMemo(() => {
    const strengthTotal = strengthRecords.reduce((sum, row) => sum + toNumber(row.pr_weight_kg), 0);
    const runCount = runningRecords.filter((row) => row.best_duration_sec).length;
    const score = Math.min(100, Math.round((strengthTotal / 10) + (runCount * 8)));
    return {
      strengthTotal,
      score,
    };
  }, [runningRecords, strengthRecords]);

  if (loading) {
    return <LoadingCard message="Loading personal records board..." />;
  }

  return (
    <section className="fade-in">
      <PageHeader
        eyebrow="Personal Records"
        title={(
          <>
            Personal <span style={{ color: "var(--tertiary)" }}>Records</span>
          </>
        )}
        subtitle="Momentum tracking dashboard for run and lift PRs."
      />

      {error ? <div className="card" style={{ padding: "0.8rem 1rem", borderColor: "var(--danger)", color: "var(--danger)", marginBottom: "1rem" }}>{error}</div> : null}

      <div className="label" style={{ marginBottom: "0.55rem" }}>Running PR</div>
      <div className="grid-4" style={{ marginBottom: "1rem" }}>
        {runningRecords.map((record) => (
          <article key={record.key} className="card" style={{ padding: "0.8rem", minHeight: 150 }}>
            <div className="label">{record.key}</div>
            <div className="stat-value" style={{ fontSize: "1.9rem", marginTop: "0.35rem" }}>
              {formatRunTime(record.best_duration_sec)}
            </div>
            <div className="muted" style={{ fontSize: "0.8rem", marginTop: "0.3rem" }}>
              {record.distance_km} km
            </div>
            <div style={{ marginTop: "0.65rem", display: "flex", gap: "0.3rem" }}>
              {[1, 2, 3, 4, 5].map((bar) => (
                <div
                  key={bar}
                  style={{
                    width: 8,
                    height: 18 + (bar * 4),
                    borderRadius: 5,
                    background: record.best_duration_sec ? "var(--primary)" : "var(--outline-variant)",
                    opacity: 0.25 + (bar * 0.15),
                  }}
                />
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="label" style={{ marginBottom: "0.55rem" }}>Strength PR</div>
      <div className="grid-4" style={{ marginBottom: "1rem" }}>
        {strengthRecords.map((record) => (
          <article key={record.exercise} className="card" style={{ padding: "0.8rem", minHeight: 150 }}>
            <div className="label">{record.exercise}</div>
            <div className="stat-value" style={{ fontSize: "1.9rem", marginTop: "0.35rem", color: "var(--tertiary)" }}>
              {record.pr_weight_kg ? `${Math.round(record.pr_weight_kg)} kg` : "--"}
            </div>
            <div className="muted" style={{ fontSize: "0.8rem", marginTop: "0.3rem" }}>
              target +5kg
            </div>
            <div style={{ marginTop: "0.65rem", height: 8, borderRadius: 999, background: "var(--surface-container-highest)", overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, Math.round((toNumber(record.pr_weight_kg) / 180) * 100))}%`, height: "100%", background: "var(--tertiary)" }} />
            </div>
          </article>
        ))}
      </div>

      <section className="grid-2">
        <article className="card" style={{ padding: "1rem" }}>
          <div className="label">Strength Sum</div>
          <div className="stat-value" style={{ fontSize: "2.2rem", color: "var(--primary)" }}>
            {Math.round(progress.strengthTotal)} kg
          </div>
          <div className="muted">Approximation for 1000lb club tracking.</div>
        </article>
        <article className="card" style={{ padding: "1rem", display: "flex", alignItems: "center", gap: "1rem", justifyContent: "space-between" }}>
          <div>
            <div className="label">Goal Completion</div>
            <div className="muted" style={{ marginTop: "0.3rem" }}>Current macro progress index.</div>
          </div>
          <div
            style={{
              width: 94,
              height: 94,
              borderRadius: "999px",
              display: "grid",
              placeItems: "center",
              background: `conic-gradient(var(--tertiary) ${progress.score}%, var(--surface-container-highest) ${progress.score}% 100%)`,
            }}
          >
            <div style={{ width: 70, height: 70, borderRadius: "999px", background: "var(--surface-container)", display: "grid", placeItems: "center", fontWeight: 800 }}>
              {progress.score}%
            </div>
          </div>
        </article>
      </section>
    </section>
  );
}
