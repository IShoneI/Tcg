import type { PublishedHerd } from "@/types/herd";

const STORAGE_KEY = "dinowarz:published-herds:v1";

export function loadPublishedHerds(): PublishedHerd[] {
  if (typeof window === "undefined") return [];
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value ? (JSON.parse(value) as PublishedHerd[]) : [];
  } catch {
    return [];
  }
}

export function savePublishedHerd(herd: PublishedHerd): void {
  const existing = loadPublishedHerds();
  const next = [...existing.filter((candidate) => candidate.id !== herd.id), herd];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function removePublishedHerd(id: string): void {
  const next = loadPublishedHerds().filter((herd) => herd.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
