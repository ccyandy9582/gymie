"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../../components/page-header";
import { useAuth } from "../../../components/auth-context";

const DAYS = [
  { label: "M", value: 1 },
  { label: "T", value: 2 },
  { label: "W", value: 3 },
  { label: "T", value: 4 },
  { label: "F", value: 5 },
  { label: "S", value: 6 },
  { label: "S", value: 0 },
];

export default function PreferencesPage() {
  const { user, setUser, authedRequest } = useAuth();
  const [availableDays, setAvailableDays] = useState([1, 3, 5, 6]);
  const [trainingType, setTrainingType] = useState("hybrid");
  const [unitSystem, setUnitSystem] = useState("metric");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }
    if (Array.isArray(user.available_days) && user.available_days.length >= 2) {
      setAvailableDays(user.available_days);
    }
    if (user.training_type) {
      setTrainingType(user.training_type);
    }
    if (user.unit_system) {
      setUnitSystem(user.unit_system);
    }
  }, [user]);

  const forecast = useMemo(() => {
    const days = availableDays.length;
    const volume = trainingType === "running" ? `${(days * 7).toFixed(0)} km/mo` : `${(days * 1800).toFixed(0)} kg/mo`;
    const intensity = trainingType === "hybrid" ? "Balanced / 70%" : trainingType === "running" ? "Aerobic / 65%" : "Strength / 75%";
    const vo2 = trainingType === "running" ? "+3.1%" : trainingType === "hybrid" ? "+2.0%" : "+1.0%";
    return { volume, intensity, vo2 };
  }, [availableDays, trainingType]);

  function toggleDay(day) {
    setSaved(false);
    setAvailableDays((prev) => {
      if (prev.includes(day)) {
        if (prev.length <= 2) {
          return prev;
        }
        return prev.filter((value) => value !== day);
      }
      return [...prev, day].sort((a, b) => a - b);
    });
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const response = await authedRequest("/users/me/preferences", {
        method: "PUT",
        body: {
          available_days: availableDays,
          training_type: trainingType,
          unit_system: unitSystem,
        },
      });
      setUser(response.user);
      setSaved(true);
    } catch (saveError) {
      setError(saveError.message || "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="fade-in">
      <PageHeader
        eyebrow="Preferences"
        title="Training Preference Matrix"
        subtitle="Set weekly availability, training focus and units. This directly feeds AI scheduling."
      />

      {error ? <div className="card" style={{ padding: "0.8rem 1rem", borderColor: "var(--danger)", color: "var(--danger)", marginBottom: "1rem" }}>{error}</div> : null}
      {saved ? <div className="card" style={{ padding: "0.8rem 1rem", borderColor: "var(--success)", color: "var(--success)", marginBottom: "1rem" }}>Preferences saved.</div> : null}

      <div className="pref-layout">
        <section className="card" style={{ padding: "1rem" }}>
          <div className="label">Weekly Availability</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: "0.5rem", marginTop: "0.7rem" }}>
            {DAYS.map((day) => (
              <button
                type="button"
                key={`${day.label}-${day.value}`}
                onClick={() => toggleDay(day.value)}
                className={`chip ${availableDays.includes(day.value) ? "active" : ""}`}
                style={{ width: "100%", padding: "0.65rem 0" }}
              >
                {day.label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: "1rem" }}>
            <div className="label">Rest Recovery Protocol</div>
            <div className="card" style={{ height: 10, overflow: "hidden", marginTop: "0.4rem" }}>
              <div style={{ width: "70%", height: "100%", background: "var(--tertiary)" }} />
            </div>
            <div className="muted" style={{ marginTop: "0.4rem", fontSize: "0.85rem" }}>
              70% recovery ratio recommended for hybrid plans.
            </div>
          </div>
        </section>

        <section className="card" style={{ padding: "1rem", display: "grid", gap: "0.85rem", alignContent: "start" }}>
          <div>
            <div className="label">Training Focus</div>
            <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.6rem" }}>
              {["running", "strength", "hybrid"].map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`chip ${trainingType === type ? "active" : ""}`}
                  onClick={() => {
                    setSaved(false);
                    setTrainingType(type);
                  }}
                  style={{ textAlign: "left" }}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="label">Unit System</div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem" }}>
              {["metric", "imperial"].map((unit) => (
                <button
                  key={unit}
                  type="button"
                  className={`chip ${unitSystem === unit ? "active" : ""}`}
                  onClick={() => {
                    setSaved(false);
                    setUnitSystem(unit);
                  }}
                >
                  {unit}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      <section className="card forecast-grid" style={{ marginTop: "1rem", padding: "1rem" }}>
        <article>
          <div className="label">Volume Forecast</div>
          <div className="stat-value" style={{ fontSize: "1.6rem", color: "var(--primary)" }}>{forecast.volume}</div>
        </article>
        <article>
          <div className="label">Intensity Forecast</div>
          <div className="stat-value" style={{ fontSize: "1.6rem" }}>{forecast.intensity}</div>
        </article>
        <article>
          <div className="label">Est. VO₂ Trend</div>
          <div className="stat-value" style={{ fontSize: "1.6rem", color: "var(--tertiary)" }}>{forecast.vo2}</div>
        </article>
      </section>

      <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
        <button type="button" className="btn btn-ghost" onClick={() => {
          if (!user) return;
          setAvailableDays(user.available_days || [1, 3, 5, 6]);
          setTrainingType(user.training_type || "hybrid");
          setUnitSystem(user.unit_system || "metric");
          setSaved(false);
          setError("");
        }}>
          Discard Changes
        </button>
        <button type="button" className="btn btn-primary" disabled={saving || availableDays.length < 2} onClick={handleSave}>
          {saving ? "Saving..." : "Save Preferences"}
        </button>
      </div>
    </section>
  );
}
