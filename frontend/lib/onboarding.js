const ONBOARDING_HIDE_PROMPT_KEY = "gymie-onboarding-hide-v1";

function readHiddenPromptMap() {
  if (typeof window === "undefined") {
    return {};
  }

  const raw = localStorage.getItem(ONBOARDING_HIDE_PROMPT_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Ignore invalid payload and reset to default.
  }

  return {};
}

function writeHiddenPromptMap(nextMap) {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(ONBOARDING_HIDE_PROMPT_KEY, JSON.stringify(nextMap));
}

export function isOnboardingComplete(user) {
  if (!user) {
    return false;
  }

  const requiredFields = [
    "age",
    "gender",
    "height_cm",
    "weight_kg",
    "goal",
    "fitness_level",
    "unit_system",
    "training_type",
  ];

  const hasRequiredFields = requiredFields.every((field) => {
    const value = user[field];
    return value !== null && value !== undefined && `${value}`.trim().length > 0;
  });

  const hasAvailableDays = Array.isArray(user.available_days) && user.available_days.length >= 2;

  return hasRequiredFields && hasAvailableDays;
}

export function isOnboardingPromptHidden(userId) {
  if (!userId) {
    return false;
  }

  const hiddenMap = readHiddenPromptMap();
  return Boolean(hiddenMap[userId]);
}

export function hideOnboardingPrompt(userId) {
  if (!userId) {
    return;
  }

  const hiddenMap = readHiddenPromptMap();
  hiddenMap[userId] = true;
  writeHiddenPromptMap(hiddenMap);
}

export function showOnboardingPrompt(userId) {
  if (!userId) {
    return;
  }

  const hiddenMap = readHiddenPromptMap();
  if (!hiddenMap[userId]) {
    return;
  }
  delete hiddenMap[userId];
  writeHiddenPromptMap(hiddenMap);
}

export function shouldForceOnboarding(user, { sessionSkipped = false } = {}) {
  if (!user || sessionSkipped) {
    return false;
  }
  if (isOnboardingComplete(user)) {
    return false;
  }
  return !isOnboardingPromptHidden(user.id);
}
