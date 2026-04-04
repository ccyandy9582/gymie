"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "../../../components/page-header";
import { useAuth } from "../../../components/auth-context";

function toNumber(value) {
  return Number.parseFloat(value || 0);
}

export default function WorkoutsPage() {
  const { authedRequest } = useAuth();
  const [error, setError] = useState("");
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [draft, setDraft] = useState({
    exercise_name: "Back Squat",
    set_number: 1,
    reps: 8,
    weight_kg: 60,
  });

  const totalVolume = useMemo(() => {
    const sets = session?.sets || [];
    return sets.reduce((sum, set) => sum + (toNumber(set.weight_kg) * toNumber(set.reps)), 0);
  }, [session]);

  async function startSession() {
    setError("");
    setLoading(true);
    try {
      const data = await authedRequest("/workouts", {
        method: "POST",
        body: {},
      });
      setSession({ ...data.workout, sets: [] });
      setDraft((prev) => ({ ...prev, set_number: 1 }));
    } catch (startError) {
      setError(startError.message || "Failed to start workout");
    } finally {
      setLoading(false);
    }
  }

  async function refreshSession(sessionId) {
    const data = await authedRequest(`/workouts/${sessionId}`);
    setSession(data.workout);
  }

  async function addSet() {
    if (!session?.id) {
      return;
    }
    setError("");
    setLoading(true);
    try {
      await authedRequest(`/workouts/${session.id}/sets`, {
        method: "POST",
        body: {
          ...draft,
          reps: Number(draft.reps),
          set_number: Number(draft.set_number),
          weight_kg: Number(draft.weight_kg),
        },
      });
      await refreshSession(session.id);
      setDraft((prev) => ({ ...prev, set_number: Number(prev.set_number) + 1 }));
    } catch (addError) {
      setError(addError.message || "Failed to add set");
    } finally {
      setLoading(false);
    }
  }

  async function finishWorkout() {
    if (!session?.id) return;
    setError("");
    setFinishing(true);
    try {
      await authedRequest(`/workouts/${session.id}/finish`, {
        method: "PUT",
        body: {},
      });
      await refreshSession(session.id);
    } catch (finishError) {
      setError(finishError.message || "Failed to finish workout");
    } finally {
      setFinishing(false);
    }
  }

  return (
    <section className="fade-in">
      <PageHeader
        eyebrow="Lift Execution"
        title="Strength Session Console"
        subtitle="Start a workout, log each set fast, and finish to compute total volume."
      />

      {error ? <div className="card" style={{ padding: "0.8rem 1rem", borderColor: "var(--danger)", color: "var(--danger)", marginBottom: "1rem" }}>{error}</div> : null}

      {!session ? (
        <div className="card" style={{ padding: "1rem" }}>
          <div className="label">UC-22 · Start Lift</div>
          <p className="muted">Launch an in-progress strength session and begin logging sets.</p>
          <button type="button" className="btn btn-primary" onClick={startSession} disabled={loading}>
            {loading ? "Starting..." : "Start Workout"}
          </button>
        </div>
      ) : (
        <div className="grid-2">
          <section className="card" style={{ padding: "1rem", display: "grid", gap: "0.8rem", alignContent: "start" }}>
            <div className="label">UC-23 · Log Sets</div>
            <div className="muted">Session ID: {session.id}</div>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span className="label">Exercise</span>
              <input className="field" value={draft.exercise_name} onChange={(event) => setDraft((prev) => ({ ...prev, exercise_name: event.target.value }))} />
            </label>
            <div className="grid-3">
              <label style={{ display: "grid", gap: "0.35rem" }}>
                <span className="label">Set #</span>
                <input className="field" type="number" min={1} value={draft.set_number} onChange={(event) => setDraft((prev) => ({ ...prev, set_number: event.target.value }))} />
              </label>
              <label style={{ display: "grid", gap: "0.35rem" }}>
                <span className="label">Reps</span>
                <input className="field" type="number" min={1} value={draft.reps} onChange={(event) => setDraft((prev) => ({ ...prev, reps: event.target.value }))} />
              </label>
              <label style={{ display: "grid", gap: "0.35rem" }}>
                <span className="label">Weight (kg)</span>
                <input className="field" type="number" min={0} step={0.5} value={draft.weight_kg} onChange={(event) => setDraft((prev) => ({ ...prev, weight_kg: event.target.value }))} />
              </label>
            </div>

            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              <button type="button" className="chip" onClick={() => setDraft((prev) => ({ ...prev, weight_kg: Math.max(0, Number(prev.weight_kg) - 2.5) }))}>-2.5kg</button>
              <button type="button" className="chip" onClick={() => setDraft((prev) => ({ ...prev, weight_kg: Number(prev.weight_kg) + 2.5 }))}>+2.5kg</button>
              <button type="button" className="chip" onClick={() => setDraft((prev) => ({ ...prev, reps: Math.max(1, Number(prev.reps) - 1) }))}>-1 rep</button>
              <button type="button" className="chip" onClick={() => setDraft((prev) => ({ ...prev, reps: Number(prev.reps) + 1 }))}>+1 rep</button>
            </div>

            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
              <button type="button" className="btn btn-secondary" onClick={addSet} disabled={loading || !draft.exercise_name}>
                {loading ? "Saving..." : "Done Set"}
              </button>
              <button type="button" className="btn btn-primary" onClick={finishWorkout} disabled={finishing}>
                {finishing ? "Finishing..." : "Finish Workout"}
              </button>
            </div>
          </section>

          <section className="card" style={{ padding: "1rem", display: "grid", gap: "0.65rem" }}>
            <div className="label">UC-25 · Session Summary</div>
            <div className="stat-value" style={{ fontSize: "2rem", color: "var(--tertiary)" }}>{Math.round(totalVolume)} kg</div>
            <div className="muted">Total volume</div>

            <div style={{ display: "grid", gap: "0.45rem", maxHeight: 360, overflowY: "auto" }}>
              {(session.sets || []).map((set) => (
                <div key={set.id} className="card" style={{ padding: "0.6rem 0.7rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                    <strong>{set.exercise_name}</strong>
                    <span className="label">SET {set.set_number}</span>
                  </div>
                  <div className="muted">{set.weight_kg} kg × {set.reps}</div>
                </div>
              ))}
              {(session.sets || []).length === 0 ? <div className="muted">No sets logged yet.</div> : null}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
