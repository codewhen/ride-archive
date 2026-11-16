import type { Trip, Annotation, Correction } from "./types";
export function exportBackup(trip: Trip) {
  return {
    version: 1,
    tripName: trip.name,
    files: trip.clips.map((c) => ({ id: c.id, size: c.video.size })),
    annotations: trip.annotations,
    corrections: trip.corrections,
  };
}
export function readBackup(
  input: unknown,
  trip: Trip,
): { annotations: Annotation[]; corrections: Correction[] } {
  if (!input || typeof input !== "object")
    throw new Error("This is not a Ride Archive backup.");
  const b = input as Record<string, unknown>;
  if (
    b.version !== 1 ||
    !Array.isArray(b.files) ||
    !Array.isArray(b.annotations) ||
    !Array.isArray(b.corrections)
  )
    throw new Error("Unsupported backup format.");
  const sizes = new Map(trip.clips.map((c) => [c.id, c.video.size]));
  const matched = new Set<string>();
  for (const f of b.files)
    if (f && typeof f.id === "string" && sizes.get(f.id) === f.size)
      matched.add(f.id);
  if (!matched.size)
    throw new Error("This backup does not match any recordings in this trip.");
  const durations = new Map(trip.clips.map((c) => [c.id, c.duration]));
  const annotations: Annotation[] = [];
  for (const a of b.annotations) {
    if (!a || !matched.has(a.clipId)) continue;
    if (
      typeof a.id !== "string" ||
      typeof a.note !== "string" ||
      typeof a.favourite !== "boolean" ||
      !Number.isFinite(a.at) ||
      a.at < 0 ||
      a.at > (durations.get(a.clipId) || 0)
    )
      throw new Error("Backup contains an invalid bookmark.");
    annotations.push({
      id: a.id,
      clipId: a.clipId,
      at: a.at,
      note: a.note,
      favourite: a.favourite,
    });
  }
  const sessions = new Set(
    trip.clips.filter((c) => matched.has(c.id)).map((c) => c.sessionId),
  );
  const corrections: Correction[] = [];
  for (const c of b.corrections) {
    if (!c || !sessions.has(c.sessionId)) continue;
    if (!Number.isFinite(c.offset) || Math.abs(c.offset) > 100 * 366 * 86400000)
      throw new Error("Backup contains an invalid date correction.");
    corrections.push({ sessionId: c.sessionId, offset: c.offset });
  }
  return {
    annotations: [
      ...new Map(
        [...trip.annotations, ...annotations].map((a) => [a.id, a]),
      ).values(),
    ],
    corrections: [
      ...new Map(
        [...trip.corrections, ...corrections].map((c) => [c.sessionId, c]),
      ).values(),
    ],
  };
}
