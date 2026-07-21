import { EMPTY_PROGRESS, type CollectorProgress } from "@/engine/progression";

const STORAGE_KEY = "dinowarz:collector-progress:v1";

export function loadProgress(): CollectorProgress {
  if (typeof window === "undefined") return EMPTY_PROGRESS;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) return EMPTY_PROGRESS;
    return { ...EMPTY_PROGRESS, ...(JSON.parse(value) as Partial<CollectorProgress>) };
  } catch {
    return EMPTY_PROGRESS;
  }
}

export function saveProgress(progress: CollectorProgress): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function updateProgress(update: (progress: CollectorProgress) => CollectorProgress): CollectorProgress {
  const next = update(loadProgress());
  saveProgress(next);
  return next;
}
