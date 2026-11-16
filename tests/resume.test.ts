import { afterEach, expect, it, vi } from "vitest";
import { checkpointResume, restoreResume } from "../src/core/resume";
import type { Trip, Resume } from "../src/core/types";
const trip: Trip = {
  id: "t",
  name: "Trip",
  created: 0,
  updated: 0,
  clips: [
    {
      id: "c",
      stem: "c",
      sessionId: "c",
      start: 0,
      sequence: 1,
      duration: 60,
      video: { path: "c.mp4", size: 1, modified: 1 },
    },
  ],
  annotations: [],
  corrections: [],
  issues: [],
};
afterEach(() => vi.unstubAllGlobals());
it("checkpoints the last explicit seek synchronously for an immediate reload", () => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    setItem: (key: string, value: string) => data.set(key, value),
    getItem: (key: string) => data.get(key) || null,
  });
  const resume: Resume = {
    clipId: "c",
    at: 12.3,
    scope: "day",
    speed: 2,
    volume: 0.5,
  };
  checkpointResume(trip.id, resume);
  expect(restoreResume(trip)).toEqual(resume);
});
it("ignores invalid, unrelated or inaccessible checkpoints and uses IndexedDB state", () => {
  for (const raw of [
    "broken",
    JSON.stringify({ clipId: "missing" }),
    JSON.stringify({
      clipId: "c",
      at: 10000,
      scope: "day",
      speed: 1,
      volume: 1,
    }),
  ]) {
    vi.stubGlobal("localStorage", { getItem: () => raw });
    expect(restoreResume(trip)).toBe(trip.resume);
  }
  vi.stubGlobal("localStorage", {
    getItem: () => {
      throw Error("Blocked");
    },
    setItem: () => {
      throw Error("Blocked");
    },
  });
  expect(() =>
    checkpointResume("t", {
      clipId: "c",
      at: 0,
      scope: "day",
      speed: 1,
      volume: 1,
    }),
  ).not.toThrow();
  expect(restoreResume(trip)).toBe(trip.resume);
});

it("ignores checkpoints whose camera view does not contain their recording", () => {
  vi.stubGlobal("localStorage", {
    getItem: () =>
      JSON.stringify({
        clipId: "c",
        at: 1,
        scope: "day",
        speed: 1,
        volume: 1,
        channel: "rear",
      }),
  });
  expect(restoreResume(trip)).toBe(trip.resume);
});
