"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import { useAuth } from "./auth-context";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", short: "DB" },
  { href: "/onboarding", label: "Onboarding", short: "ON" },
  { href: "/preferences", label: "Preferences", short: "PF" },
  { href: "/plans", label: "AI Plans", short: "AI" },
  { href: "/workouts", label: "Lift Session", short: "LF" },
  { href: "/runs", label: "Run Session", short: "RN" },
  { href: "/history", label: "History", short: "HS" },
  { href: "/records", label: "Records", short: "PR" },
];

function formatInitials(name) {
  if (!name) {
    return "GM";
  }
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0].toUpperCase()).join("");
}

export function AppShell({ children }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const initials = useMemo(() => formatInitials(user?.name), [user?.name]);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <div className="app-shell app-shell-layout">
      <aside
        className="app-sidebar"
        style={{
          borderRight: "1px solid var(--outline-variant)",
          background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0)) var(--surface-container-low)",
          padding: "1.4rem 1rem",
          position: "sticky",
          top: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: "999px",
              background: "linear-gradient(130deg, var(--primary), #8ea8e8)",
              display: "grid",
              placeItems: "center",
              color: "#0b1837",
              fontWeight: 900,
            }}
          >
            {initials}
          </div>
          <div>
            <div className="label">Athlete</div>
            <div style={{ fontWeight: 700 }}>{user?.name || "Gymie User"}</div>
          </div>
        </div>

        <nav style={{ display: "grid", gap: "0.4rem" }}>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.62rem 0.72rem",
                  borderRadius: "0.5rem",
                  borderRight: isActive ? "4px solid var(--tertiary)" : "4px solid transparent",
                  background: isActive ? "rgba(255,255,255,0.07)" : "transparent",
                  color: isActive ? "var(--tertiary)" : "var(--on-surface-variant)",
                }}
              >
                <span className="label" style={{ width: 24, textAlign: "center", color: "inherit" }}>
                  {item.short}
                </span>
                <span style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "0.8rem" }}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div style={{ marginTop: "auto", paddingTop: "1.2rem", display: "grid", gap: "0.6rem" }}>
          <Link href="/workouts" className="btn btn-primary" style={{ textAlign: "center" }}>
            Start Workout
          </Link>
          <button type="button" className="btn btn-ghost" onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </aside>

      <div className="app-content">
        <header
          style={{
            height: 64,
            borderBottom: "1px solid var(--outline-variant)",
            padding: "0 1.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backdropFilter: "blur(3px)",
            position: "sticky",
            top: 0,
            zIndex: 20,
            background: "rgba(18,20,22,0.92)",
          }}
        >
          <div className="headline" style={{ fontSize: "1.1rem", color: "var(--primary)" }}>
            Kinetic Precision
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}>
            <div className="label">Web MVP</div>
            <div style={{ width: 34, height: 34, borderRadius: "999px", background: "var(--surface-container-high)", display: "grid", placeItems: "center" }}>
              {initials}
            </div>
          </div>
        </header>

        <main style={{ padding: "1.5rem", maxWidth: 1360, margin: "0 auto" }}>{children}</main>
      </div>
    </div>
  );
}
