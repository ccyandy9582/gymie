"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "../../../components/page-header";
import { useAuth } from "../../../components/auth-context";

const GOALS = [
  { value: "build_muscle", title: "Build Muscle", description: "Increase lean mass and strength output." },
  { value: "lose_fat", title: "Lose Fat", description: "Drive fat loss while preserving performance." },
  { value: "endurance", title: "Endurance", description: "Improve aerobic capacity and running economy." },
  { value: "general_fitness", title: "General Fitness", description: "Balanced strength, cardio, and recovery." },
];

const LEVELS = [
  { value: "beginner", title: "Beginner" },
  { value: "intermediate", title: "Intermediate" },
  { value: "advanced", title: "Advanced" },
];

const DAYS = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, setUser, authedRequest } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: user?.name || "",
    age: user?.age || 30,
    gender: user?.gender || "other",
    height_cm: user?.height_cm || 170,
    weight_kg: user?.weight_kg || 70,
    goal: user?.goal || "general_fitness",
    fitness_level: user?.fitness_level || "intermediate",
    available_days: Array.isArray(user?.available_days) && user.available_days.length >= 2 ? user.available_days : [1, 3, 5, 6],
    training_type: user?.training_type || "hybrid",
    unit_system: user?.unit_system || "metric",
  });

  const progress = useMemo(() => `${(step / 4) * 100}%`, [step]);

  function toggleDay(value) {
    setForm((prev) => {
      const exists = prev.available_days.includes(value);
      if (exists) {
        if (prev.available_days.length <= 2) {
          return prev;
        }
        return { ...prev, available_days: prev.available_days.filter((day) => day !== value) };
      }
      return { ...prev, available_days: [...prev.available_days, value].sort((a, b) => a - b) };
    });
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const profilePayload = {
        name: form.name,
        age: Number(form.age),
        gender: form.gender,
        height_cm: Number(form.height_cm),
        weight_kg: Number(form.weight_kg),
        goal: form.goal,
        fitness_level: form.fitness_level,
      };
      const preferencePayload = {
        unit_system: form.unit_system,
        training_type: form.training_type,
        available_days: form.available_days,
      };

      const updatedProfile = await authedRequest("/users/me", {
        method: "PUT",
        body: profilePayload,
      });
      const updatedPreferences = await authedRequest("/users/me/preferences", {
        method: "PUT",
        body: preferencePayload,
      });

      setUser(updatedPreferences.user || updatedProfile.user);
      router.push("/plans");
    } catch (saveError) {
      setError(saveError.message || "Failed to save onboarding data");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="fade-in">
      <PageHeader
        eyebrow="Onboarding"
        title="Athlete Baseline Setup"
        subtitle="Complete your profile in four short steps. This becomes the default input for AI plan generation."
      />

      <div className="card" style={{ marginBottom: "1rem", height: 8, overflow: "hidden" }}>
        <div style={{ width: progress, height: "100%", background: "linear-gradient(90deg, var(--primary), var(--tertiary))", transition: "width 200ms ease" }} />
      </div>

      {error ? <div className="card" style={{ padding: "0.8rem 1rem", borderColor: "var(--danger)", color: "var(--danger)", marginBottom: "1rem" }}>{error}</div> : null}

      {step === 1 && (
        <div className="card" style={{ padding: "1rem", display: "grid", gap: "0.8rem" }}>
          <div className="label">Step 1 · Basic</div>
          <div className="grid-3">
            <label style={{ display: "grid", gap: "0.3rem" }}>
              <span className="label">Name</span>
              <input className="field" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            </label>
            <label style={{ display: "grid", gap: "0.3rem" }}>
              <span className="label">Age</span>
              <input className="field" type="number" min={10} max={100} value={form.age} onChange={(event) => setForm((prev) => ({ ...prev, age: event.target.value }))} />
            </label>
            <label style={{ display: "grid", gap: "0.3rem" }}>
              <span className="label">Gender</span>
              <select className="field" value={form.gender} onChange={(event) => setForm((prev) => ({ ...prev, gender: event.target.value }))}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card" style={{ padding: "1rem", display: "grid", gap: "0.8rem" }}>
          <div className="label">Step 2 · Body Metrics</div>
          <div className="grid-2">
            <label style={{ display: "grid", gap: "0.3rem" }}>
              <span className="label">Height (cm)</span>
              <input className="field" type="number" min={50} max={300} value={form.height_cm} onChange={(event) => setForm((prev) => ({ ...prev, height_cm: event.target.value }))} />
            </label>
            <label style={{ display: "grid", gap: "0.3rem" }}>
              <span className="label">Weight (kg)</span>
              <input className="field" type="number" min={20} max={500} value={form.weight_kg} onChange={(event) => setForm((prev) => ({ ...prev, weight_kg: event.target.value }))} />
            </label>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card" style={{ padding: "1rem", display: "grid", gap: "0.8rem" }}>
          <div className="label">Step 3 · Goal & Level</div>
          <div className="grid-2">
            {GOALS.map((goal) => {
              const active = form.goal === goal.value;
              return (
                <button
                  type="button"
                  key={goal.value}
                  onClick={() => setForm((prev) => ({ ...prev, goal: goal.value }))}
                  style={{
                    textAlign: "left",
                    border: active ? "1px solid var(--primary)" : "1px solid var(--outline-variant)",
                    borderRadius: "0.7rem",
                    background: active ? "rgba(176,198,255,0.12)" : "var(--surface-container)",
                    color: "var(--on-surface)",
                    padding: "0.8rem 0.9rem",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{goal.title}</div>
                  <div className="muted" style={{ fontSize: "0.85rem" }}>{goal.description}</div>
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            {LEVELS.map((level) => (
              <button
                type="button"
                key={level.value}
                className={`chip ${form.fitness_level === level.value ? "active" : ""}`}
                onClick={() => setForm((prev) => ({ ...prev, fitness_level: level.value }))}
              >
                {level.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="card" style={{ padding: "1rem", display: "grid", gap: "0.8rem" }}>
          <div className="label">Step 4 · Weekly Preferences</div>
          <div>
            <div className="label" style={{ marginBottom: "0.45rem" }}>Available Days</div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {DAYS.map((day) => (
                <button
                  type="button"
                  key={day.value}
                  className={`chip ${form.available_days.includes(day.value) ? "active" : ""}`}
                  onClick={() => toggleDay(day.value)}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {["running", "strength", "hybrid"].map((type) => (
              <button
                type="button"
                key={type}
                className={`chip ${form.training_type === type ? "active" : ""}`}
                onClick={() => setForm((prev) => ({ ...prev, training_type: type }))}
              >
                {type}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {["metric", "imperial"].map((unit) => (
              <button
                type="button"
                key={unit}
                className={`chip ${form.unit_system === unit ? "active" : ""}`}
                onClick={() => setForm((prev) => ({ ...prev, unit_system: unit }))}
              >
                {unit}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: "1rem", display: "flex", justifyContent: "space-between", gap: "0.7rem" }}>
        <button type="button" className="btn btn-ghost" disabled={step === 1 || saving} onClick={() => setStep((prev) => Math.max(1, prev - 1))}>
          Back
        </button>
        {step < 4 ? (
          <button type="button" className="btn btn-secondary" onClick={() => setStep((prev) => Math.min(4, prev + 1))}>
            Next
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || form.available_days.length < 2}>
            {saving ? "Saving..." : "Commit Setup"}
          </button>
        )}
      </div>
    </section>
  );
}
