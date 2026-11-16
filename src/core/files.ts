import type { FileRecord, SourceFile, Trip } from "./types";
export interface DirectoryHandle extends FileSystemDirectoryHandle {
  values(): AsyncIterable<FileSystemHandle>;
  queryPermission(options: { mode: "read" }): Promise<PermissionState>;
  requestPermission(options: { mode: "read" }): Promise<PermissionState>;
}
export async function collectDirectory(
  handle: FileSystemDirectoryHandle,
  signal?: AbortSignal,
  prefix = "",
): Promise<SourceFile[]> {
  const files: SourceFile[] = [];
  for await (const entry of (handle as DirectoryHandle).values()) {
    signal?.throwIfAborted();
    if (entry.name.startsWith(".")) continue;
    const path = prefix + entry.name;
    if (entry.kind === "directory")
      files.push(
        ...(await collectDirectory(
          entry as FileSystemDirectoryHandle,
          signal,
          path + "/",
        )),
      );
    else
      files.push({
        path,
        file: await (entry as FileSystemFileHandle).getFile(),
      });
  }
  return files;
}
export function fromFileList(files: FileList): SourceFile[] {
  return Array.from(files).map((file) => ({
    path: (file.webkitRelativePath || file.name)
      .split("/")
      .slice(file.webkitRelativePath ? 1 : 0)
      .join("/"),
    file,
  }));
}
export function downloadJSON(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export class FileLibrary {
  private generation = 0;
  files = new Map<string, File>();
  handle?: FileSystemDirectoryHandle;
  connect(files: Map<string, File>, handle?: FileSystemDirectoryHandle) {
    this.generation++;
    this.files = files;
    this.handle = handle;
  }
  async read(record: FileRecord): Promise<File> {
    let file = this.files.get(record.path);
    if (!file && this.handle) {
      const parts = record.path.split("/");
      let dir = this.handle;
      for (const part of parts.slice(0, -1))
        dir = await dir.getDirectoryHandle(part);
      file = await (await dir.getFileHandle(parts.at(-1)!)).getFile();
    }
    if (!file)
      throw new Error("Reconnect the original folder to play this recording.");
    if (file.size !== record.size || file.lastModified !== record.modified)
      throw new Error(
        "This recording changed on disk. Re-import the folder to update its index.",
      );
    return file;
  }
  async restore(trip: Trip) {
    const generation = ++this.generation;
    this.files = new Map();
    this.handle = undefined;
    if (!trip.handle) return false;
    if (
      (await (trip.handle as DirectoryHandle).queryPermission({
        mode: "read",
      })) === "granted"
    ) {
      if (generation !== this.generation) return false;
      this.handle = trip.handle;
      return true;
    }
    return false;
  }
}
export const library = new FileLibrary();
