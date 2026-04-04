"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "../../../components/page-header";
import { useAuth } from "../../../components/auth-context";

function formatDuration(totalSec) {
  if (!totalSec || totalSec <= 0) return "00:00";
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function generateLaps(distanceKm, durationSec, avgHeartRate) {
  const lapCount = Math.floor(distanceKm);
  if (lapCount <= 0) {
    return [];
  }
  const secPerKm = Math.round(durationSec / distanceKm);
  return new Array(lapCount).fill(null).map((_, index) => ({
    lap_number: index + 1,
    distance_km: 1,
    duration_sec: secPerKm,
    heart_rate: avgHeartRate || null,
  }));
}

export default function RunsPage() {
  const { authedRequest } = useAuth();
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    distance_km: 5,
    duration_sec: 1800,
    avg_heart_rate: 150,
    calories: 320,
  });

  const pace = useMemo(() => {
    if (!form.distance_km || !form.duration_sec) {
      return "--:--";
    }
    const secPerKm = Math.round(Number(form.duration_sec) / Number(form.distance_km));
    return formatDuration(secPerKm);
  }, [form.distance_km, form.duration_sec]);

  async function startRun() {
    setLoading(true);
    setError("");
    try {
      const data = await authedRequest("/runs", {
        method: "POST",
        body: {},
      });
      setRun(data.run);
    } catch (startError) {
      setError(startError.message || "Failed to start run");
    } finally {
      setLoading(false);
    }
  }

  async function finishRun() {
    if (!run?.id) return;
    setFinishing(true);
    setError("");
    try {
      const distance = Number(form.distance_km);
      const duration = Number(form.duration_sec);
      const heartRate = Number(form.avg_heart_rate) || null;
      const calories = Number(form.calories) || null;
      const laps = generateLaps(distance, duration, heartRate);

      const data = await authedRequest(`/runs/${run.id}/finish`, {
        method: "PUT",
        body: {
          distance_km: distance,
          duration_sec: duration,
          avg_heart_rate: heartRate,
          calories,
          laps,
        },
      });
      setRun(data.run);
    } catch (finishError) {
      setError(finishError.message || "Failed to finish run");
    } finally {
      setFinishing(false);
    }
  }

  return (
    <section className="fade-in">
      <PageHeader
        eyebrow="Run Execution"
        title="Run Session Console"
        subtitle="Start a run, log key metrics at finish, and persist lap breakdown."
      />

      {error ? <div className="card" style={{ padding: "0.8rem 1rem", borderColor: "var(--danger)", color: "var(--danger)", marginBottom: "1rem" }}>{error}</div> : null}

      {!run ? (
        <article className="card" style={{ padding: "1rem" }}>
          <div className="label">UC-20 · Start Run</div>
          <p className="muted">This starts an in-progress run session. Use mobile app GPS capture in production; web uses summary entry.</p>
          <button type="button" className="btn btn-primary" onClick={startRun} disabled={loading}>
            {loading ? "Starting..." : "Start Run"}
          </button>
        </article>
      ) : (
        <div className="grid-2">
          <article className="card" style={{ padding: "1rem", display: "grid", gap: "0.8rem" }}>
            <div className="label">UC-21 · Finish and Save</div>
            <div className="grid-2">
              <label style={{ display: "grid", gap: "0.35rem" }}>
                <span className="label">Distance (km)</span>
                <input className="field" type="number" step={0.1} min={0.1} value={form.distance_km} onChange={(event) => setForm((prev) => ({ ...prev, distance_km: event.target.value }))} />
              </label>
              <label style={{ display: "grid", gap: "0.35rem" }}>
                <span className="label">Duration (sec)</span>
                <input className="field" type="number" min={1} value={form.duration_sec} onChange={(event) => setForm((prev) => ({ ...prev, duration_sec: event.target.value }))} />
              </label>
            </div>
            <div className="grid-2">
              <label style={{ display: "grid", gap: "0.35rem" }}>
                <span className="label">Avg Heart Rate</span>
                <input className="field" type="number" min={0} value={form.avg_heart_rate} onChange={(event) => setForm((prev) => ({ ...prev, avg_heart_rate: event.target.value }))} />
              </label>
              <label style={{ display: "grid", gap: "0.35rem" }}>
                <span className="label">Calories</span>
                <input className="field" type="number" min={0} value={form.calories} onChange={(event) => setForm((prev) => ({ ...prev, calories: event.target.value }))} />
              </label>
            </div>

            <button type="button" className="btn btn-primary" onClick={finishRun} disabled={finishing}>
              {finishing ? "Saving..." : "Save Run"}
            </button>
          </article>

          <article className="card" style={{ padding: "1rem", display: "grid", gap: "0.75rem", alignContent: "start" }}>
            <div className="label">Live Summary</div>
            <div className="stat-value" style={{ fontSize: "2.4rem", color: "var(--tertiary)" }}>{Number(form.distance_km).toFixed(2)} km</div>
            <div className="muted">Estimated pace {pace} /km</div>
            <div className="muted">Duration {formatDuration(Number(form.duration_sec))}</div>
            <div className="muted">Session status: {run.status}</div>

            {run?.laps?.length ? (
              <div style={{ display: "grid", gap: "0.35rem", marginTop: "0.35rem", maxHeight: 220, overflowY: "auto" }}>
                {run.laps.map((lap) => (
                  <div key={lap.id || lap.lap_number} className="card" style={{ padding: "0.55rem 0.6rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="label">Lap {lap.lap_number}</span>
                      <span>{lap.distance_km} km</span>
                    </div>
                    <div className="muted">{formatDuration(lap.duration_sec)}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        </div>
      )}
    </section>
  );
}
