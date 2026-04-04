"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../components/auth-context";
import { shouldForceOnboarding } from "../../../lib/onboarding";

const REGISTER_DEFAULT = {
  name: "",
  email: "",
  password: "",
};

export default function LoginPage() {
  const router = useRouter();
  const { login, register, resetOnboardingSessionSkip } = useAuth();
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState(REGISTER_DEFAULT);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      let authResult;
      if (mode === "login") {
        authResult = await login(loginForm.email, loginForm.password);
      } else {
        authResult = await register(registerForm);
      }

      resetOnboardingSessionSkip();
      const nextPath = shouldForceOnboarding(authResult.user) ? "/onboarding" : "/dashboard";
      router.replace(nextPath);
    } catch (submitError) {
      setError(submitError.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card fade-in auth-card">
      <aside
        style={{
          padding: "2rem",
          background: "linear-gradient(145deg, rgba(176,198,255,0.28), rgba(166,215,0,0.08))",
          borderRight: "1px solid var(--outline-variant)",
        }}
      >
        <div className="label">Gymie</div>
        <h1 className="headline" style={{ fontSize: "2.4rem", margin: "0.5rem 0 1rem 0" }}>
          Train With
          <br />
          Intelligence
        </h1>
        <p className="muted" style={{ marginTop: 0, lineHeight: 1.7 }}>
          Plan your hybrid routine, track every lift and run, then let AI adapt the next cycle with your real data.
        </p>
      </aside>

      <div style={{ padding: "1.6rem 1.4rem 1.8rem 1.4rem" }}>
        <div style={{ display: "flex", gap: "0.45rem", marginBottom: "1.2rem" }}>
          <button
            type="button"
            className={`chip ${mode === "login" ? "active" : ""}`}
            onClick={() => setMode("login")}
          >
            Login
          </button>
          <button
            type="button"
            className={`chip ${mode === "register" ? "active" : ""}`}
            onClick={() => setMode("register")}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.8rem" }}>
          {mode === "register" && (
            <label style={{ display: "grid", gap: "0.3rem" }}>
              <span className="label">Name</span>
              <input
                className="field"
                required
                value={registerForm.name}
                onChange={(event) => setRegisterForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </label>
          )}

          <label style={{ display: "grid", gap: "0.3rem" }}>
            <span className="label">Email</span>
            <input
              className="field"
              type="email"
              required
              value={mode === "login" ? loginForm.email : registerForm.email}
              onChange={(event) => {
                const value = event.target.value;
                if (mode === "login") {
                  setLoginForm((prev) => ({ ...prev, email: value }));
                } else {
                  setRegisterForm((prev) => ({ ...prev, email: value }));
                }
              }}
            />
          </label>

          <label style={{ display: "grid", gap: "0.3rem" }}>
            <span className="label">Password</span>
            <input
              className="field"
              type="password"
              required
              minLength={8}
              value={mode === "login" ? loginForm.password : registerForm.password}
              onChange={(event) => {
                const value = event.target.value;
                if (mode === "login") {
                  setLoginForm((prev) => ({ ...prev, password: value }));
                } else {
                  setRegisterForm((prev) => ({ ...prev, password: value }));
                }
              }}
            />
          </label>

          {error && (
            <div style={{ color: "var(--danger)", fontSize: "0.85rem" }}>{error}</div>
          )}

          <button className="btn btn-primary" disabled={loading} type="submit">
            {loading ? "Processing..." : mode === "login" ? "Log In" : "Create Account"}
          </button>
        </form>
      </div>
    </section>
  );
}
