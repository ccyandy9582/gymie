"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./auth-context";
import { shouldForceOnboarding } from "../lib/onboarding";

export function AuthGuard({ children }) {
  const { isAuthenticated, isBootstrapping, user, onboardingSkippedThisSession } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isOnboardingRoute = pathname.startsWith("/onboarding");
  const mustCompleteOnboarding = isAuthenticated && shouldForceOnboarding(user, { sessionSkipped: onboardingSkippedThisSession });

  useEffect(() => {
    if (isBootstrapping) {
      return;
    }

    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (!isOnboardingRoute && mustCompleteOnboarding) {
      router.replace("/onboarding");
    }
  }, [isAuthenticated, isBootstrapping, isOnboardingRoute, mustCompleteOnboarding, router]);

  if (isBootstrapping || !isAuthenticated || (!isOnboardingRoute && mustCompleteOnboarding)) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <div className="card fade-in" style={{ padding: "1.2rem 1.5rem" }}>
          <div className="label">{mustCompleteOnboarding ? "Onboarding" : "Syncing"}</div>
          <div>{mustCompleteOnboarding ? "Opening your setup flow..." : "Preparing your training space..."}</div>
        </div>
      </div>
    );
  }

  return children;
}
