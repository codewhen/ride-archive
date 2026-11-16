// Read-only diagnostic. No media is copied, decoded into the project, or changed.
import { readdir, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
const exec = promisify(execFile),
  folder = path.resolve(process.argv[2] || "video_full_ride");
const files = (await readdir(folder)).filter((f) => !f.startsWith("."));
const groups = new Map();
const issues = [];
for (const name of files) {
  const stem = name.slice(0, name.lastIndexOf("."));
  groups.set(stem, [...(groups.get(stem) || []), name]);
}
let bytes = 0;
for (const name of files) bytes += (await stat(path.join(folder, name))).size;
for (const [stem, names] of groups) {
  if (!names.some((f) => f.toLowerCase().endsWith(".mp4"))) continue;
  for (const ext of [".mp4", ".jpg"]) {
    const n = names.filter((f) => f.toLowerCase().endsWith(ext)).length;
    if (n !== 1)
      issues.push({ file: stem, issue: `Expected one ${ext}, found ${n}` });
  }
}
const videos = files.filter((f) => f.toLowerCase().endsWith(".mp4"));
let next = 0;
const media = [];
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (next < videos.length) {
      const file = videos[next++];
      try {
        const { stdout } = await exec("ffprobe", [
          "-v",
          "error",
          "-show_entries",
          "format=duration",
          "-of",
          "json",
          path.join(folder, file),
        ]);
        const duration = Number(JSON.parse(stdout).format.duration);
        if (!Number.isFinite(duration)) throw Error("No duration");
        media.push({ file, duration });
      } catch (e) {
        media.push({
          file,
          error: String(e.stderr || e.message).split("\n")[0],
        });
      }
    }
  }),
);
console.log(
  JSON.stringify(
    {
      folder,
      files: files.length,
      videos: videos.length,
      gigabytes: bytes / 1e9,
      readable: media.filter((m) => !m.error).length,
      recordedHours: media.reduce((n, m) => n + (m.duration || 0), 0) / 3600,
      incompleteGroups: new Set(issues.map((i) => i.file)).size,
      issues,
      unreadable: media.filter((m) => m.error),
    },
    null,
    2,
  ),
);
