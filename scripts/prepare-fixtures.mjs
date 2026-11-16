import { mkdir, writeFile, copyFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";
import os from "node:os";
import path from "node:path";
const root = path.join(os.tmpdir(), "ride-archive-fixtures");
await mkdir(root, { recursive: true });
// A quiet, clearly labelled demo clip instead of rainbow calibration bars.
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 640, height: 360 },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    "<!doctype html><html><head><style>*{box-sizing:border-box}body{margin:0;width:640px;height:360px;background:#171a18;color:#f2efe5;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;text-align:center}h1{font-size:32px;font-weight:500;letter-spacing:-1px;margin:0 0 14px}p{font-size:14px;color:#aaafa4;margin:0;line-height:1.6}</style></head><body><main><h1>Sample recording</h1><p>Generated demo footage<br>No personal recordings</p></main></body></html>",
  );
  await page.screenshot({ path: path.join(root, "demo-frame.png") });
} finally {
  await browser.close();
}
execFileSync("ffmpeg", [
  "-v",
  "error",
  "-loop",
  "1",
  "-framerate",
  "24",
  "-i",
  path.join(root, "demo-frame.png"),
  "-f",
  "lavfi",
  "-i",
  "anullsrc=channel_layout=stereo:sample_rate=44100",
  "-t",
  "2",
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
  "-c:a",
  "aac",
  "-movflags",
  "+faststart",
  "-y",
  path.join(root, "source.mp4"),
]);
execFileSync("ffmpeg", [
  "-v",
  "error",
  "-i",
  path.join(root, "source.mp4"),
  "-frames:v",
  "1",
  "-y",
  path.join(root, "source.jpg"),
]);
const stems = [
  "20260826_235900_060_000001",
  "20260826_235902_060_000002",
  "20260827_000000_060_000003",
];
for (const kind of ["valid", "invalid"]) {
  const dir = path.join(root, kind);
  await mkdir(dir, { recursive: true });
  for (const [i, stem] of stems.entries()) {
    await copyFile(
      path.join(root, "source.mp4"),
      path.join(dir, stem + ".MP4"),
    );
    if (kind === "valid" || i !== 1)
      await copyFile(
        path.join(root, "source.jpg"),
        path.join(dir, stem + ".JPG"),
      );
    await writeFile(
      path.join(dir, stem + ".txt"),
      kind === "invalid" && i === 2
        ? "not metadata"
        : "t0 = 0\nts=0.001\n1,0,998,36,-17\n1,20,985,41,-7\n",
    );
  }
  if (kind === "invalid") {
    await writeFile(
      path.join(dir, "20260827_000100_060_000004.MP4"),
      "broken video",
    );
    await writeFile(path.join(dir, "notes.md"), "Unexpected file");
  }
}
console.log(root);
// Mixed camera conventions, containers, durations and nested thumbnail directories; no TXT required.
const generic = path.join(root, "generic");
for (const sub of ["Normal/front", "Normal/rear", "Thumbnails"])
  await mkdir(path.join(generic, sub), { recursive: true });
const frontA = "2025_0722_110221_000123F",
  frontB = "2025_0722_110223_000124F",
  rear = "NO20250722-110221-000001R";
await copyFile(
  path.join(root, "source.mp4"),
  path.join(generic, "Normal/front", frontA + ".MP4"),
);
await copyFile(
  path.join(root, "source.mp4"),
  path.join(generic, "Normal/rear", rear + ".mp4"),
);
execFileSync("ffmpeg", [
  "-v",
  "error",
  "-stream_loop",
  "1",
  "-i",
  path.join(root, "source.mp4"),
  "-t",
  "3.5",
  "-c",
  "copy",
  "-f",
  "mov",
  "-y",
  path.join(generic, "Normal/front", frontB + ".MOV"),
]);
for (const stem of [frontA, frontB, rear])
  await copyFile(
    path.join(root, "source.jpg"),
    path.join(generic, "Thumbnails", stem + "_thumb.JPG"),
  );
await writeFile(
  path.join(generic, "camera-config.txt"),
  "This is deliberately not sensor data.",
);
const fallback = path.join(root, "unknown-camera");
await mkdir(fallback, { recursive: true });
await copyFile(
  path.join(root, "source.mp4"),
  path.join(fallback, "000001.MP4"),
);
