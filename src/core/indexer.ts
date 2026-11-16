import type {
  Candidate,
  Clip,
  Correction,
  Day,
  FileRecord,
  IndexedClip,
  Issue,
  ScanResult,
  SourceFile,
} from "./types";
import {
  cameraChannel,
  embeddedCreationTime,
  imageExtensions,
  parseCameraName,
  videoExtensions,
} from "./camera";
export const parseStem = parseCameraName;
const record = ({ path, file }: SourceFile): FileRecord => ({
  path,
  size: file.size,
  modified: file.lastModified,
});
const imageKey = (path: string) =>
  path
    .replace(/\.(jpg|jpeg|png|webp)$/i, "")
    .replace(/\.(mp4|mov|m4v|webm|avi|mkv|ts|mts|m2ts)$/i, "")
    .replace(/(?:_thumb(?:nail)?|_preview)$/i, "")
    .replace(/(^|\/)(?:thumb_|thumbnail_)/i, "$1")
    .toLowerCase();
export async function scanFiles(
  files: SourceFile[],
  progress?: (done: number, total: number) => void,
): Promise<ScanResult> {
  const issues: Issue[] = [];
  const videos: SourceFile[] = [];
  const images = new Map<string, SourceFile[]>();
  for (const item of files) {
    if (item.path.split("/").some((p) => p.startsWith("."))) continue;
    const ext = item.path.split(".").at(-1)!.toLowerCase();
    if (videoExtensions.has(ext)) videos.push(item);
    else if (imageExtensions.has(ext)) {
      const key = imageKey(item.path);
      images.set(key, [...(images.get(key) || []), item]);
    }
  }
  const videoCounts = new Map<string, number>();
  for (const v of videos) {
    const key = v.path.replace(/\.[^.]+$/, "").toLowerCase();
    videoCounts.set(key, (videoCounts.get(key) || 0) + 1);
  }
  const basenameCounts = new Map<string, number>();
  for (const v of videos) {
    const stem = v.path
      .replace(/\.[^.]+$/, "")
      .split("/")
      .at(-1)!;
    basenameCounts.set(
      stem.toLowerCase(),
      (basenameCounts.get(stem.toLowerCase()) || 0) + 1,
    );
  }
  const imagesByBasename = new Map<string, SourceFile[]>();
  for (const [key, values] of images) {
    const basename = key.split("/").at(-1)!;
    imagesByBasename.set(basename, [
      ...(imagesByBasename.get(basename) || []),
      ...values,
    ]);
  }
  const candidates: Candidate[] = [];
  let done = 0;
  for (const item of videos) {
    const pathStem = item.path.replace(/\.[^.]+$/, "");
    const stem = pathStem.split("/").at(-1)!;
    if ((videoCounts.get(pathStem.toLowerCase()) || 0) > 1) {
      issues.push({
        path: item.path,
        code: "ambiguous",
        severity: "error",
        message:
          "Multiple video files have the same stem in this folder. Rename the copies to distinguish them.",
      });
      progress?.(++done, videos.length);
      continue;
    }
    if (!item.file.size) {
      issues.push({
        path: item.path,
        code: "empty",
        severity: "error",
        message: "Video file is empty.",
      });
      progress?.(++done, videos.length);
      continue;
    }
    const parsed = parseStem(stem);
    let start = parsed?.start;
    let timeSource: Candidate["timeSource"] = "filename";
    if (start === undefined) {
      const embedded = await embeddedCreationTime(item.file);
      if (embedded !== null) {
        start = embedded;
        timeSource = "embedded";
      } else {
        const d = new Date(item.file.lastModified);
        start = Number.isFinite(d.getTime())
          ? Date.UTC(
              d.getFullYear(),
              d.getMonth(),
              d.getDate(),
              d.getHours(),
              d.getMinutes(),
              d.getSeconds(),
            )
          : 0;
        timeSource = "file-modified";
        issues.push({
          path: item.path,
          code: "estimated-time",
          severity: "warning",
          message:
            "No recording timestamp found. Using file modified time in your local timezone; verify or correct the session date.",
        });
      }
    }
    let matches = images.get(pathStem.toLowerCase()) || [];
    if (
      !matches.length &&
      (basenameCounts.get(stem.toLowerCase()) || 0) === 1
    ) {
      matches = imagesByBasename.get(stem.toLowerCase()) || [];
    }
    let thumbnail: FileRecord | undefined;
    if (matches.length === 1 && matches[0].file.size)
      thumbnail = record(matches[0]);
    else
      issues.push({
        path: item.path,
        code: matches.length > 1 ? "ambiguous-thumbnail" : "missing-thumbnail",
        severity: "warning",
        message:
          matches.length > 1
            ? "Multiple thumbnails match this recording; no preview was guessed."
            : "No matching thumbnail found. Playback is still available.",
      });
    candidates.push({
      id: item.path.includes("/") ? pathStem : stem,
      stem,
      start,
      sequence:
        parsed?.sequence ||
        Number(stem.match(/(\d+)(?:[A-Za-z]+)?$/)?.[1] || 0),
      timeSource,
      channel: cameraChannel(stem, item.path),
      video: record(item),
      thumbnail,
    });
    progress?.(++done, videos.length);
  }
  return {
    candidates: candidates.sort(
      (a, b) =>
        a.start - b.start ||
        a.sequence - b.sequence ||
        a.video.path.localeCompare(b.video.path, undefined, { numeric: true }),
    ),
    issues,
    totalVideos: videos.length,
  };
}
export function assignSessions(clips: Clip[]): Clip[] {
  const previousByChannel = new Map<string, Clip>();
  const sessions = new Map<string, string>();
  return [...clips]
    .sort(
      (a, b) =>
        a.start - b.start ||
        a.sequence - b.sequence ||
        a.video.path.localeCompare(b.video.path, undefined, { numeric: true }),
    )
    .map((c) => {
      const channel = c.channel || "unspecified";
      const previous = previousByChannel.get(channel);
      if (
        !previous ||
        dayKey(previous.start) !== dayKey(c.start) ||
        c.start - (previous.start + previous.duration * 1000) > 300000
      )
        sessions.set(channel, c.id);
      previousByChannel.set(channel, c);
      return { ...c, sessionId: sessions.get(channel)! };
    });
}
export const dayKey = (start: number) =>
  new Date(start).toISOString().slice(0, 10);
export function makeDays(clips: Clip[], corrections: Correction[]): Day[] {
  const offsets = new Map(corrections.map((c) => [c.sessionId, c.offset]));
  const sorted: IndexedClip[] = clips
    .map((c) => ({
      ...c,
      effectiveStart: c.start + (offsets.get(c.sessionId) || 0),
    }))
    .sort(
      (a, b) =>
        a.effectiveStart - b.effectiveStart ||
        a.sequence - b.sequence ||
        a.id.localeCompare(b.id, undefined, { numeric: true }),
    );
  const map = new Map<string, Day>();
  for (const c of sorted) {
    const key = dayKey(c.effectiveStart);
    let day = map.get(key);
    if (!day) {
      day = {
        key,
        clips: [],
        sessions: [],
        duration: 0,
        start: c.effectiveStart,
        end: c.effectiveStart,
      };
      map.set(key, day);
    }
    const end = c.effectiveStart + c.duration * 1000;
    const last = day.sessions.at(-1);
    if (!last || last.id !== c.sessionId)
      day.sessions.push({
        id: c.sessionId,
        clips: [c],
        start: c.effectiveStart,
        end,
        gap: last ? Math.max(0, (c.effectiveStart - last.end) / 1000) : 0,
      });
    else {
      last.clips.push(c);
      last.end = Math.max(last.end, end);
    }
    day.clips.push(c);
    day.duration += c.duration;
    day.end = Math.max(day.end, end);
  }
  return [...map.values()];
}
export function queuePosition(clips: { duration: number }[], seconds: number) {
  const total = clips.reduce((s, c) => s + c.duration, 0);
  const target = Math.max(0, Math.min(seconds, Math.max(0, total - 0.001)));
  let offset = 0;
  for (let index = 0; index < clips.length; index++) {
    if (target < offset + clips[index].duration)
      return { index, at: target - offset };
    offset += clips[index].duration;
  }
  return { index: 0, at: 0 };
}
export const elapsedBefore = (clips: { duration: number }[], index: number) =>
  clips.slice(0, index).reduce((s, c) => s + c.duration, 0);
export function formatDuration(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return s >= 3600
    ? `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
    : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
export const cameraTime = (n: number) =>
  new Date(n).toISOString().slice(11, 19);
export const labelDate = (
  n: number | string,
  opts: Intl.DateTimeFormatOptions = {
    month: "long",
    day: "2-digit",
    year: "numeric",
  },
) =>
  new Intl.DateTimeFormat("en-IN", { ...opts, timeZone: "UTC" }).format(
    new Date(n),
  );
