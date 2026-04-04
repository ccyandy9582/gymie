"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../../components/auth-context";
import { PageHeader } from "../../../components/page-header";
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

export default function DashboardPage() {
  const { authedRequest, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [plans, setPlans] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [runs, setRuns] = useState([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const [planData, workoutData, runData] = await Promise.all([
          authedRequest("/plans"),
          authedRequest("/workouts"),
          authedRequest("/runs"),
        ]);
        if (!active) {
          return;
        }
        setPlans(planData.plans || []);
        setWorkouts(workoutData.workouts || []);
        setRuns(runData.runs || []);
      } catch (fetchError) {
        if (active) {
          setError(fetchError.message || "Failed to load dashboard");
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

  const metrics = useMemo(() => {
    const totalDistance = runs
      .filter((run) => run.status === "completed")
      .reduce((sum, run) => sum + toNumber(run.distance_km), 0);

    const monthlyVolume = workouts
      .filter((session) => session.status === "completed")
      .reduce((sum, session) => sum + toNumber(session.total_volume_kg), 0);

    const activePlan = plans.find((plan) => plan.status === "active");
    const latestRun = runs[0];
    const avgRunPaceSec = latestRun?.avg_pace_sec_per_km ? Number(latestRun.avg_pace_sec_per_km) : null;

    return {
      totalDistance,
      monthlyVolume,
      activePlanName: activePlan?.name || "No active plan",
      latestRunPace: formatPace(avgRunPaceSec),
      sessions: workouts.length + runs.length,
    };
  }, [plans, workouts, runs]);

  if (loading) {
    return <LoadingCard message="Pulling your latest training signal..." />;
  }

  return (
    <section className="fade-in">
      <PageHeader
        eyebrow="Performance Console"
        title="Welcome Back"
        subtitle={`Hi ${user?.name || "Athlete"}, here is your current training pulse.`}
        rightSlot={<Link href="/plans" className="btn btn-primary">Generate Plan</Link>}
      />

      {error ? (
        <div className="card" style={{ padding: "0.9rem 1rem", borderColor: "var(--danger)", marginBottom: "1rem", color: "var(--danger)" }}>
          {error}
        </div>
      ) : null}

      <div className="grid-4" style={{ marginBottom: "1rem" }}>
        <article className="card" style={{ padding: "1rem" }}>
          <div className="label">Total Distance</div>
          <div className="stat-value" style={{ fontSize: "2.1rem" }}>{metrics.totalDistance.toFixed(1)} km</div>
        </article>
        <article className="card" style={{ padding: "1rem" }}>
          <div className="label">Monthly Volume</div>
          <div className="stat-value" style={{ fontSize: "2.1rem" }}>{Math.round(metrics.monthlyVolume)} kg</div>
        </article>
        <article className="card" style={{ padding: "1rem" }}>
          <div className="label">Latest Pace</div>
          <div className="stat-value" style={{ fontSize: "2.1rem" }}>{metrics.latestRunPace}</div>
        </article>
        <article className="card" style={{ padding: "1rem" }}>
          <div className="label">Total Sessions</div>
          <div className="stat-value" style={{ fontSize: "2.1rem" }}>{metrics.sessions}</div>
        </article>
      </div>

      <div className="grid-2">
        <article className="card" style={{ padding: "1.2rem", minHeight: 240 }}>
          <div className="label">Active Plan</div>
          <h2 className="headline" style={{ margin: "0.4rem 0 0.75rem 0", fontSize: "1.35rem", color: "var(--primary)" }}>
            {metrics.activePlanName}
          </h2>
          <p className="muted" style={{ marginTop: 0, lineHeight: 1.7 }}>
            Keep the week rhythm stable. Use the AI plan screen to regenerate if your schedule or recovery changes.
          </p>
          <Link href="/plans" className="btn btn-secondary">Open AI Plan</Link>
        </article>

        <article className="card" style={{ padding: "1.2rem", minHeight: 240 }}>
          <div className="label">Quick Start</div>
          <h2 className="headline" style={{ margin: "0.4rem 0 0.75rem 0", fontSize: "1.35rem", color: "var(--tertiary)" }}>
            Today&apos;s Execution
          </h2>
          <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
            <Link href="/runs" className="btn btn-primary">Start Run</Link>
            <Link href="/workouts" className="btn btn-secondary">Start Lift</Link>
            <Link href="/history" className="btn btn-ghost">History</Link>
          </div>
        </article>
      </div>
    </section>
  );
}
