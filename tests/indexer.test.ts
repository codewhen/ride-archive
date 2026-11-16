import { describe, expect, it } from "vitest";
import {
  assignSessions,
  makeDays,
  parseStem,
  queuePosition,
  scanFiles,
} from "../src/core/indexer";
import { readBackup, exportBackup } from "../src/core/backup";
import type { Clip, Trip } from "../src/core/types";
const stem = "20260826_161840_060_000976";
const source = (name: string, text = "data") => ({
  path: name,
  file: new File([text], name, { lastModified: 123 }),
});
const clip = (id: string, start: number, duration = 60): Clip => ({
  id,
  stem: id,
  start,
  duration,
  sequence: 1,
  sessionId: "",
  video: { path: id + ".MP4", size: 4, modified: 123 },
});
describe("camera format and strict validation", () => {
  it("validates real calendar dates and preserves wall-clock time", () => {
    expect(new Date(parseStem(stem)!.start).toISOString()).toBe(
      "2026-08-26T16:18:40.000Z",
    );
    expect(parseStem("20260230_161840_060_000976")).toBeNull();
    expect(parseStem("20260826_241840_060_000976")).toBeNull();
    expect(parseStem("20240229_161840_060_000976")).not.toBeNull();
    expect(parseStem("20250229_161840_060_000976")).toBeNull();
  });
  it.each([
    "20250722_110221_NF",
    "2025_0722_110221_000123F",
    "REC_2025_07_22_11_02_21_F",
    "NO20250722-110221-000123R",
    "250722_110221_001_FH",
    "VID_20250722110221",
  ])("recognizes timestamp in %s", (name) =>
    expect(new Date(parseStem(name)!.start).toISOString()).toBe(
      "2025-07-22T11:02:21.000Z",
    ),
  );
  it("ignores TXT completely, including malformed metadata and other camera sidecars", async () => {
    const log = source(stem + ".txt", "malformed");
    log.file.text = () => {
      throw new Error("TXT must not be read");
    };
    const r = await scanFiles([
      source(stem + ".MP4"),
      source(stem + ".JPEG"),
      log,
      source("config.bin"),
    ]);
    expect(r.issues).toEqual([]);
    expect(r.candidates).toHaveLength(1);
    expect(r.candidates[0]).not.toHaveProperty("sensor");
  });
  it("supports repeated names in different directories and matches local thumbnails", async () => {
    const r = await scanFiles([
      source("front/" + stem + ".MP4"),
      source("front/" + stem + ".jpg"),
      source("rear/" + stem + ".MP4"),
      source("rear/" + stem + ".png"),
    ]);
    expect(r.issues).toEqual([]);
    expect(new Set(r.candidates.map((c) => c.id)).size).toBe(2);
    expect(r.candidates.map((c) => c.channel)).toEqual(["front", "rear"]);
  });
  it("rejects ambiguous videos in the same directory and empty video files", async () => {
    const r = await scanFiles([
      source(stem + ".MP4"),
      source(stem + ".mov"),
      source("empty.mp4", ""),
    ]);
    expect(r.candidates).toHaveLength(0);
    expect(r.issues.map((i) => i.code)).toContain("ambiguous");
    expect(r.issues.map((i) => i.code)).toContain("empty");
  });
  it("warns for missing thumbnails and falls back transparently on unknown names", async () => {
    const r = await scanFiles([source("GARMIN/000001.mp4")]);
    expect(r.candidates).toHaveLength(1);
    expect(r.candidates[0].timeSource).toBe("file-modified");
    expect(r.issues.every((i) => i.severity === "warning")).toBe(true);
  });
  it("matches separate thumbnail folders and conventional thumbnail suffixes", async () => {
    const r = await scanFiles([
      source("videos/" + stem + ".MOV"),
      source("thumbs/" + stem + "_thumb.webp"),
    ]);
    expect(r.candidates[0].thumbnail?.path).toBe(
      "thumbs/" + stem + "_thumb.webp",
    );
    expect(r.issues).toEqual([]);
  });
});

describe("trip chronology", () => {
  const start = Date.UTC(2026, 7, 26, 23, 58);
  it("starts a new session only beyond a five-minute recording gap, or at day boundary", () => {
    const c = assignSessions([
      clip("a", start),
      clip("b", start + 360000),
      clip("c", start + 721000),
    ]);
    expect(c.map((c) => c.sessionId)).toEqual(["a", "b", "c"]);
    const sameDay = assignSessions([
      clip("a", 0),
      clip("b", 360000),
      clip("c", 721000),
    ]);
    expect(sameDay.map((c) => c.sessionId)).toEqual(["a", "a", "c"]);
  });
  it("uses actual short clip duration for gaps and cumulative totals", () => {
    const c = assignSessions([clip("a", 0, 8), clip("b", 60000, 18)]);
    expect(makeDays(c, [])[0].duration).toBe(26);
  });
  it("corrects whole sessions across dates without modifying original camera timestamps", () => {
    const c = assignSessions([clip("a", start), clip("b", start + 60000)]);
    const corrected = makeDays(c, [{ sessionId: "a", offset: 86400000 }]);
    expect(corrected[0].key).toBe("2026-08-27");
    expect(corrected[0].clips[0].start).toBe(start);
    expect(corrected[0].clips[0].effectiveStart).toBe(start + 86400000);
  });
  it("seeks across clips and clamps queue ends without inserting time gaps", () => {
    const q = [{ duration: 8 }, { duration: 60 }, { duration: 18 }];
    expect(queuePosition(q, 8)).toEqual({ index: 1, at: 0 });
    expect(queuePosition(q, 75)).toEqual({ index: 2, at: 7 });
    expect(queuePosition(q, -10)).toEqual({ index: 0, at: 0 });
    expect(queuePosition(q, 1000).index).toBe(2);
    expect(queuePosition(q, 1000).at).toBeCloseTo(17.999);
  });
});
describe("portable annotations", () => {
  const trip: Trip = {
    id: "trip",
    name: "ride",
    created: 0,
    updated: 0,
    clips: assignSessions([clip("a", 0)]),
    issues: [],
    annotations: [
      { id: "note", clipId: "a", at: 12, note: "A bend", favourite: true },
    ],
    corrections: [{ sessionId: "a", offset: 86400000 }],
  };
  it("roundtrips notes and corrections and avoids duplicate IDs", () =>
    expect(readBackup(exportBackup(trip), trip)).toEqual({
      annotations: trip.annotations,
      corrections: trip.corrections,
    }));
  it("rejects unrelated and malformed backups", () => {
    expect(() =>
      readBackup(
        { ...exportBackup(trip), files: [{ id: "x", size: 4 }] },
        trip,
      ),
    ).toThrow("does not match");
    expect(() =>
      readBackup(
        {
          ...exportBackup(trip),
          annotations: [{ ...trip.annotations[0], at: -1 }],
        },
        trip,
      ),
    ).toThrow("invalid bookmark");
  });
});

it("does not reuse a separate thumbnail for case-variant video basenames", async () => {
  const result = await scanFiles([
    source("front/REC_20250722_110221.mp4"),
    source("rear/rec_20250722_110221.mp4"),
    source("thumbs/REC_20250722_110221.jpg"),
  ]);
  expect(result.candidates).toHaveLength(2);
  expect(result.candidates.every((c) => !c.thumbnail)).toBe(true);
});

it("pairs thumbnails with appended extensions for all supported containers", async () => {
  for (const extension of ["avi", "mkv", "ts", "mts", "m2ts"]) {
    const result = await scanFiles([
      source(`${stem}.${extension}`),
      source(`${stem}.${extension}.jpg`),
    ]);
    expect(result.candidates[0].thumbnail?.path).toBe(
      `${stem}.${extension}.jpg`,
    );
  }
});
