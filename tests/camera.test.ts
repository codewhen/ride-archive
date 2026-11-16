import { expect, it } from "vitest";
import { cameraChannel, embeddedCreationTime } from "../src/core/camera";
it.each([
  ["20250722_110221_NF", "front"],
  ["20250722_110221_NR", "rear"],
  ["20250722_110221_NI", "interior"],
  ["2025_0722_110221_000123F", "front"],
  ["NO20250722-110221-000123R", "rear"],
  ["GC2000123", "interior"],
  ["250722_110221_001_RL", "rear"],
])("detects %s channel", (name, channel) =>
  expect(cameraChannel(name)).toBe(channel),
);
it("reads mvhd creation time with bounded atom reads", async () => {
  const b = new ArrayBuffer(40),
    v = new DataView(b);
  const text = (at: number, s: string) =>
    s.split("").forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  v.setUint32(0, 40);
  text(4, "moov");
  v.setUint32(8, 32);
  text(12, "mvhd");
  const time = Date.UTC(2025, 6, 22, 11, 2, 21);
  v.setUint32(20, (time - Date.UTC(1904, 0, 1)) / 1000);
  expect(await embeddedCreationTime(new File([b], "000001.mp4"))).toBe(time);
});
it("ignores malformed movie atoms and non-movie files", async () => {
  expect(
    await embeddedCreationTime(new File(["broken"], "video.mp4")),
  ).toBeNull();
  expect(
    await embeddedCreationTime(new File(["data"], "video.webm")),
  ).toBeNull();
});
