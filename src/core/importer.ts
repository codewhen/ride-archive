import { assignSessions } from "./indexer";
import type { Clip, ImportResult, ScanResult, SourceFile } from "./types";
export type Progress = { stage: string; done: number; total: number };
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
  signal: AbortSignal,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        signal.throwIfAborted();
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}
export function mediaDuration(
  file: File,
  signal: AbortSignal,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    let finished = false;
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    };
    const finish = (error?: Error) => {
      if (finished) return;
      finished = true;
      const d = video.duration;
      cleanup();
      error ? reject(error) : resolve(d);
    };
    const abort = () =>
      finish(new DOMException("Import cancelled", "AbortError"));
    const timer = setTimeout(
      () =>
        finish(
          new Error("Video metadata could not be read within 12 seconds."),
        ),
      12000,
    );
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => {
      if (
        Number.isFinite(video.duration) &&
        video.duration > 0 &&
        video.videoWidth > 0
      )
        finish();
      else finish(new Error("Video has no readable duration or video track."));
    };
    video.onerror = () =>
      finish(
        new Error(
          "Browser cannot play this video. It may be damaged or use an unsupported container or codec. Convert a copy to H.264/AAC MP4 for wider compatibility.",
        ),
      );
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    video.src = url;
  });
}
export function workerScan(
  files: SourceFile[],
  signal: AbortSignal,
  progress: (p: Progress) => void,
): Promise<ScanResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./index.worker.ts", import.meta.url), {
      type: "module",
    });
    const cleanup = () => {
      worker.terminate();
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject(new DOMException("Import cancelled", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = (e) => {
      if (e.data.type === "progress")
        progress({
          stage: "Matching videos and thumbnails",
          done: e.data.done,
          total: e.data.total,
        });
      else if (e.data.type === "result") {
        cleanup();
        resolve(e.data.result);
      } else {
        cleanup();
        reject(new Error(e.data.message));
      }
    };
    worker.onerror = () => {
      cleanup();
      reject(
        new Error("The folder indexer could not start. Refresh and try again."),
      );
    };
    if (signal.aborted) {
      abort();
      return;
    }
    worker.postMessage(files);
  });
}
export async function inspectFolder(
  name: string,
  source: SourceFile[],
  signal: AbortSignal,
  progress: (p: Progress) => void,
  handle?: FileSystemDirectoryHandle,
): Promise<ImportResult> {
  const files = new Map(source.map((s) => [s.path, s.file]));
  progress({
    stage: "Matching videos and thumbnails",
    done: 0,
    total: source.length,
  });
  const result = await workerScan(source, signal, progress);
  let done = 0;
  const clips = await mapLimit(
    result.candidates,
    4,
    async (candidate) => {
      signal.throwIfAborted();
      let clip: Clip | null = null;
      try {
        const duration = await mediaDuration(
          files.get(candidate.video.path)!,
          signal,
        );
        clip = { ...candidate, duration, sessionId: "" };
      } catch (e) {
        signal.throwIfAborted();
        result.issues.push({
          path: candidate.video.path,
          code: "unplayable",
          severity: "error",
          message: e instanceof Error ? e.message : "Unreadable video.",
        });
      }
      if (clip?.thumbnail) {
        try {
          const bitmap = await createImageBitmap(
            files.get(clip.thumbnail.path)!,
          );
          bitmap.close();
        } catch {
          result.issues.push({
            path: clip.thumbnail.path,
            code: "thumbnail",
            severity: "warning",
            message:
              "Thumbnail cannot be decoded. Playback is available with a placeholder.",
          });
          clip.thumbnail = undefined;
        }
      }
      progress({
        stage: "Reading video durations",
        done: ++done,
        total: result.candidates.length,
      });
      return clip;
    },
    signal,
  );
  signal.throwIfAborted();
  return {
    name,
    files,
    handle,
    clips: assignSessions(clips.filter((c): c is Clip => c !== null)),
    issues: result.issues,
    totalVideos: result.totalVideos,
  };
}
