export type CameraChannel = "front" | "rear" | "interior" | "unspecified";
export const videoExtensions = new Set([
  "mp4",
  "mov",
  "m4v",
  "webm",
  "avi",
  "mkv",
  "ts",
  "mts",
  "m2ts",
]);
export const imageExtensions = new Set(["jpg", "jpeg", "png", "webp"]);
export const channelLabel = (channel: CameraChannel) =>
  ({
    front: "Front",
    rear: "Rear",
    interior: "Interior",
    unspecified: "Unlabelled camera",
  })[channel];
export function cameraChannel(stem: string, path = ""): CameraChannel {
  if (/^GC1/i.test(stem)) return "front";
  if (/^GC2/i.test(stem)) return "interior";
  const code =
    stem.match(/_[NPMEIOATBRXGDLYFU]([FRI])(?:S|L)?$/i)?.[1] ||
    stem.match(/(?:\d|_)([FRI])(?:H|L)?$/i)?.[1];
  if (code)
    return ({ F: "front", R: "rear", I: "interior" } as const)[
      code.toUpperCase() as "F" | "R" | "I"
    ];
  const parts = path.toLowerCase().split("/").slice(0, -1);
  if (parts.some((p) => /^(front|front_cam|frontcamera|ch1|camera1)$/.test(p)))
    return "front";
  if (
    parts.some((p) => /^(rear|rear_cam|rearcamera|back|ch2|camera2)$/.test(p))
  )
    return "rear";
  if (parts.some((p) => /^(interior|inside|cabin|ir|ch3|camera3)$/.test(p)))
    return "interior";
  return "unspecified";
}
function dateParts(parts: string[]) {
  const [y, mo, d, h, mi, s] = parts.map(Number);
  const date = new Date(0);
  date.setUTCFullYear(y, mo - 1, d);
  date.setUTCHours(h, mi, s, 0);
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== mo - 1 ||
    date.getUTCDate() !== d ||
    date.getUTCHours() !== h ||
    date.getUTCMinutes() !== mi ||
    date.getUTCSeconds() !== s
  )
    return null;
  return date.getTime();
}
export function parseCameraName(stem: string) {
  const patterns = [
    /(?:^|\D)((?:19|20)\d{2})(\d{2})(\d{2})[_T -]?(\d{2})(\d{2})(\d{2})(?!\d)/,
    /(?:^|\D)((?:19|20)\d{2})[_-](\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})(?!\d)/,
    /(?:^|\D)((?:19|20)\d{2})[_-](\d{2})[_-](\d{2})[_T -](\d{2})[_:-](\d{2})[_:-](\d{2})(?!\d)/,
  ];
  let parts: string[] | undefined;
  for (const pattern of patterns) {
    const m = pattern.exec(stem);
    if (m) {
      parts = m.slice(1, 7);
      break;
    }
  }
  if (!parts) {
    const m = /^(\d{2})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})(?!\d)/.exec(
      stem,
    );
    if (m) parts = ["20" + m[1], ...m.slice(2, 7)];
  }
  if (!parts) return null;
  const start = dateParts(parts);
  if (start === null) return null;
  return {
    start,
    sequence: Number(stem.match(/[_-](\d+)[A-Za-z]*$/)?.[1] || 0),
    nominal: Number(stem.match(/_\d{6}_(\d{3})_\d+$/)?.[1] || 0),
  };
}
// Read atom headers only; never load the entire movie into memory.
export async function embeddedCreationTime(file: File): Promise<number | null> {
  if (!/\.(mp4|mov|m4v)$/i.test(file.name)) return null;
  const walk = async (
    start: number,
    end: number,
    inside = false,
  ): Promise<number | null> => {
    for (
      let offset = start, count = 0;
      offset + 8 <= end && count < 2048;
      count++
    ) {
      const bytes = await file
        .slice(offset, Math.min(offset + 16, end))
        .arrayBuffer();
      const view = new DataView(bytes);
      if (bytes.byteLength < 8) return null;
      let size = view.getUint32(0),
        header = 8;
      const type = String.fromCharCode(...new Uint8Array(bytes, 4, 4));
      if (size === 1) {
        if (bytes.byteLength < 16) return null;
        size = Number(view.getBigUint64(8));
        header = 16;
      }
      if (size === 0) size = end - offset;
      if (!Number.isSafeInteger(size) || size < header || offset + size > end)
        return null;
      if (type === "moov" && !inside)
        return walk(offset + header, offset + size, true);
      if (type === "mvhd" && inside) {
        const body = await file
          .slice(offset + header, offset + header + 24)
          .arrayBuffer();
        if (body.byteLength < 12) return null;
        const v = new DataView(body);
        if (v.getUint8(0) > 1) return null;
        const seconds =
          v.getUint8(0) === 1 ? Number(v.getBigUint64(4)) : v.getUint32(4);
        const time =
          seconds * 1000 - Date.UTC(1970, 0, 1) + Date.UTC(1904, 0, 1);
        return Number.isFinite(time) &&
          time >= Date.UTC(1970, 0, 1) &&
          time < Date.UTC(2200, 0, 1)
          ? time
          : null;
      }
      offset += size;
    }
    return null;
  };
  try {
    return await walk(0, file.size);
  } catch {
    return null;
  }
}
