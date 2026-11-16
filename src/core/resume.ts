import type { Resume, Trip } from "./types";
const key = (id: string) => `ride-archive:resume:${id}`;
// Small synchronous checkpoint: IndexedDB writes can be interrupted by an immediate reload.
export function checkpointResume(id: string, resume: Resume) {
  try {
    localStorage.setItem(key(id), JSON.stringify(resume));
  } catch {
    /* IndexedDB remains the fallback when site storage is restricted. */
  }
}
export function restoreResume(trip: Trip): Resume | undefined {
  try {
    const raw = localStorage.getItem(key(trip.id));
    if (!raw) return trip.resume;
    const r = JSON.parse(raw) as Resume;
    const clip = trip.clips.find((c) => c.id === r.clipId);
    if (
      !clip ||
      !Number.isFinite(r.at) ||
      r.at < 0 ||
      r.at > clip.duration ||
      !Number.isFinite(r.speed) ||
      r.speed < 0.25 ||
      r.speed > 4 ||
      !Number.isFinite(r.volume) ||
      r.volume < 0 ||
      r.volume > 1 ||
      !["day", "trip"].includes(r.scope)
    )
      return trip.resume;
    if (r.channel && r.channel !== (clip.channel || "unspecified"))
      return trip.resume;
    return r;
  } catch {
    return trip.resume;
  }
}
