import { expect, it } from "vitest";
import { FileLibrary } from "../src/core/files";
import type { Trip } from "../src/core/types";

it("ignores a delayed permission result after a newer folder connects", async () => {
  let grant!: (state: PermissionState) => void;
  const oldHandle = {
    queryPermission: () =>
      new Promise<PermissionState>((resolve) => {
        grant = resolve;
      }),
  } as unknown as FileSystemDirectoryHandle;
  const library = new FileLibrary();
  const restore = library.restore({ handle: oldHandle } as Trip);
  const currentHandle = {} as FileSystemDirectoryHandle;
  const files = new Map<string, File>();
  library.connect(files, currentHandle);
  grant("granted");
  expect(await restore).toBe(false);
  expect(library.handle).toBe(currentHandle);
  expect(library.files).toBe(files);
});

it("keeps the newest trip's handle when restores finish out of order", async () => {
  let grant!: (state: PermissionState) => void;
  const first = {
    queryPermission: () =>
      new Promise<PermissionState>((resolve) => {
        grant = resolve;
      }),
  } as unknown as FileSystemDirectoryHandle;
  const second = {
    queryPermission: async () => "granted",
  } as unknown as FileSystemDirectoryHandle;
  const library = new FileLibrary();
  const oldRestore = library.restore({ handle: first } as Trip);
  expect(await library.restore({ handle: second } as Trip)).toBe(true);
  grant("granted");
  expect(await oldRestore).toBe(false);
  expect(library.handle).toBe(second);
});
