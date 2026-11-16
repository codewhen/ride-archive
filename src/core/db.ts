import Dexie, { type Table } from "dexie";
import type { Trip } from "./types";
import { cameraChannel } from "./camera";
export class ArchiveDB extends Dexie {
  trips!: Table<Trip, string>;
  constructor(name = "ride-archive") {
    super(name);
    this.version(1).stores({ trips: "id,updated,name" });
    this.version(2)
      .stores({ trips: "id,updated,name" })
      .upgrade(async (tx) => {
        await tx
          .table("trips")
          .toCollection()
          .modify((t) => {
            t.clips = t.clips.map((c: Record<string, unknown>) => {
              delete c.sensor;
              delete c.metadata;
              return {
                ...c,
                timeSource: c.timeSource || "filename",
                channel:
                  c.channel ||
                  cameraChannel(
                    c.stem as string,
                    (c.video as { path: string }).path,
                  ),
              };
            });
            t.issues = t.issues
              .filter(
                (i: { code: string; message: string }) =>
                  i.code !== "metadata" && !/\bTXT\b/.test(i.message),
              )
              .map(
                (i: { code: string; message: string; severity: string }) => ({
                  ...i,
                  severity: i.code === "missing" ? "warning" : i.severity,
                }),
              );
          });
      });
  }
}
export const db = new ArchiveDB();
export const newId = () => crypto.randomUUID();
