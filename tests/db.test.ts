import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { ArchiveDB } from "../src/core/db";
it("persists the trip index, resume and annotations without storing video blobs", async () => {
  const name = "test-" + Math.random();
  const db = new ArchiveDB(name);
  await db.trips.put({
    id: "ride",
    name: "Ride",
    created: 1,
    updated: 1,
    clips: [],
    issues: [],
    annotations: [
      { id: "a", clipId: "c", at: 4, note: "View", favourite: true },
    ],
    corrections: [],
    resume: { clipId: "c", at: 4, scope: "trip", speed: 2, volume: 0.5 },
  });
  db.close();
  const reopened = new ArchiveDB(name);
  expect((await reopened.trips.get("ride"))?.resume?.at).toBe(4);
  expect((await reopened.trips.get("ride"))?.annotations[0].note).toBe("View");
  await reopened.delete();
});

it("upgrades saved trips without losing notes and removes ignored TXT data", async () => {
  const { default: Dexie } = await import("dexie");
  const name = "legacy-" + Math.random();
  const old = new Dexie(name);
  old.version(1).stores({ trips: "id,updated,name" });
  await old.table("trips").put({
    id: "legacy",
    name: "Old trip",
    created: 1,
    updated: 1,
    clips: [
      {
        id: "c",
        stem: "20250722_110221_NF",
        video: { path: "c.mp4", size: 10, modified: 1 },
        sensor: { samples: 1 },
        metadata: { path: "c.txt" },
      },
    ],
    annotations: [
      { id: "n", clipId: "c", at: 1, note: "Keep me", favourite: true },
    ],
    corrections: [],
    issues: [
      {
        code: "missing",
        message: "Missing matching TXT file.",
        severity: "error",
      },
      {
        code: "missing",
        message: "Missing matching JPG file.",
        severity: "error",
      },
    ],
  });
  old.close();
  const next = new ArchiveDB(name);
  const t = await next.trips.get("legacy");
  expect(t?.annotations[0].note).toBe("Keep me");
  expect(t?.clips[0].channel).toBe("front");
  expect(t?.clips[0]).not.toHaveProperty("sensor");
  expect(t?.issues).toHaveLength(1);
  expect(t?.issues[0].severity).toBe("warning");
  await next.delete();
});
