import { useRef, useState } from "react";
import { ResponsivePanel } from "./ResponsivePanel";
import { channelLabel } from "../core/camera";
import type { Annotation, IndexedClip, Trip } from "../core/types";
import { cameraTime, formatDuration, labelDate } from "../core/indexer";
import { downloadJSON } from "../core/files";
import { exportBackup, readBackup } from "../core/backup";
import { Bookmark, Clock3, Download, Star, Trash2, Upload, X } from "./Icons";
export function Details({
  trip,
  clip,
  tab,
  onTab,
  onClose,
  onPatch,
  onJump,
  onMessage,
}: {
  trip: Trip;
  clip: IndexedClip;
  tab: "recording" | "bookmarks";
  onTab: (t: "recording" | "bookmarks") => void;
  onClose: () => void;
  onPatch: (patch: Partial<Trip>) => void;
  onJump: (id: string, at: number) => void;
  onMessage: (s: string) => void;
}) {
  const backup = useRef<HTMLInputElement>(null);
  const original = trip.clips.find((c) => c.id === clip.sessionId)!;
  const correction = trip.corrections.find(
    (c) => c.sessionId === clip.sessionId,
  );
  const [date, setDate] = useState("");
  const [dateError, setDateError] = useState("");
  const annotations = trip.annotations;
  const favourite = annotations.find(
    (a) => a.clipId === clip.id && a.favourite,
  );
  function fav() {
    if (favourite)
      onPatch({
        annotations: annotations.map((a) =>
          a.id === favourite.id ? { ...a, favourite: false } : a,
        ),
      });
    else
      onPatch({
        annotations: [
          ...annotations,
          {
            id: crypto.randomUUID(),
            clipId: clip.id,
            at: 0,
            note: "",
            favourite: true,
          },
        ],
      });
  }
  function patchNote(a: Annotation, note: string) {
    onPatch({
      annotations: trip.annotations.map((item) =>
        item.id === a.id ? { ...item, note } : item,
      ),
    });
  }
  return (
    <ResponsivePanel
      className="details-panel"
      label="Recording details"
      query="(max-width: 980px)"
      onClose={onClose}
    >
      <div className="drawer-heading">
        <h2>Details</h2>
        <button
          className="icon-button"
          aria-label="Close details"
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      <div className="tabs">
        <button
          className={tab === "recording" ? "active" : ""}
          onClick={() => onTab("recording")}
        >
          Recording
        </button>
        <button
          className={tab === "bookmarks" ? "active" : ""}
          onClick={() => onTab("bookmarks")}
        >
          Bookmarks <span>{annotations.length}</span>
        </button>
      </div>
      {tab === "recording" ? (
        <div className="details-body">
          <h3 className="wrap-filename">{clip.stem}</h3>
          <dl className="metadata">
            <div>
              <dt>Camera time</dt>
              <dd>
                {labelDate(clip.start)}
                <br />
                {cameraTime(clip.start)}
              </dd>
            </div>
            <div>
              <dt>Recorded duration</dt>
              <dd>{formatDuration(clip.duration)}</dd>
            </div>
            <div>
              <dt>File size</dt>
              <dd>{(clip.video.size / 1e6).toFixed(1)} MB</dd>
            </div>
            <div>
              <dt>Thumbnail</dt>
              <dd>{clip.thumbnail ? "Available" : "Missing · placeholder"}</dd>
            </div>
            <div>
              <dt>Timeline source</dt>
              <dd>
                {clip.timeSource === "file-modified"
                  ? "File date · estimated"
                  : clip.timeSource === "embedded"
                    ? "Embedded recording time"
                    : "Filename timestamp"}
              </dd>
            </div>
            <div>
              <dt>Camera view</dt>
              <dd>{channelLabel(clip.channel || "unspecified")}</dd>
            </div>
          </dl>
          <button
            className={`full ${favourite ? "favourite" : ""}`}
            onClick={fav}
          >
            <Star fill={favourite ? "currentColor" : "none"} />
            {favourite ? "Remove favourite" : "Favourite recording"}
          </button>
          <section className="detail-section">
            <h3>
              <Clock3 />
              Correct session time
            </h3>
            <p>
              Shift every recording in this session. Original camera times and
              filenames are preserved.
            </p>
            {correction && (
              <p className="corrected-label">
                Correction applied:{" "}
                {Math.round(correction.offset / 60000).toLocaleString()} minutes
              </p>
            )}
            <form
              key={clip.sessionId + (correction?.offset || 0)}
              onSubmit={(e) => {
                e.preventDefault();
                const value = new FormData(e.currentTarget).get(
                  "date",
                ) as string;
                const target = Date.parse(value + "Z");
                if (!Number.isFinite(target) || !original) {
                  setDateError("Enter a valid session date and time.");
                  return;
                }
                const offset = target - original.start;
                if (Math.abs(offset) > 100 * 366 * 86400000) {
                  setDateError("Date correction must be within 100 years.");
                  return;
                }
                setDateError("");
                onPatch({
                  corrections: [
                    ...trip.corrections.filter(
                      (c) => c.sessionId !== clip.sessionId,
                    ),
                    { sessionId: clip.sessionId, offset },
                  ],
                });
                onMessage(
                  "Session date updated. Original files are unchanged.",
                );
              }}
            >
              <label>
                Session start
                <input
                  name="date"
                  type="datetime-local"
                  step="1"
                  required
                  defaultValue={new Date(
                    (original?.start || clip.start) + (correction?.offset || 0),
                  )
                    .toISOString()
                    .slice(0, 19)}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <div className="button-row">
                <button type="submit">Apply correction</button>
                {correction && (
                  <button
                    type="button"
                    onClick={() => {
                      onPatch({
                        corrections: trip.corrections.filter(
                          (c) => c.sessionId !== clip.sessionId,
                        ),
                      });
                      setDate("");
                    }}
                  >
                    Reset
                  </button>
                )}
              </div>
              <span className="sr-only">{date}</span>
              {dateError && (
                <p className="error-text" role="alert">
                  {dateError}
                </p>
              )}
            </form>
          </section>
        </div>
      ) : (
        <div className="details-body">
          <p className="help-text">
            Save moments while watching. Notes are stored only in this browser.
          </p>
          {!annotations.length && (
            <div className="quiet-empty">
              <Bookmark />
              <h3>No saved moments yet</h3>
              <p>Use the bookmark button in the player.</p>
            </div>
          )}
          {annotations.map((a) => {
            const c = trip.clips.find((c) => c.id === a.clipId);
            return c ? (
              <article className="bookmark-item" key={a.id}>
                <div className="section-line">
                  <button
                    className="text-button"
                    onClick={() => onJump(a.clipId, a.at)}
                  >
                    {a.favourite && <Star size={14} fill="currentColor" />}
                    {cameraTime(c.start)} + {formatDuration(a.at)}
                  </button>
                  <button
                    className="icon-button small"
                    aria-label="Delete bookmark"
                    onClick={() =>
                      onPatch({
                        annotations: trip.annotations.filter(
                          (x) => x.id !== a.id,
                        ),
                      })
                    }
                  >
                    <Trash2 />
                  </button>
                </div>
                <textarea
                  aria-label={`Note for ${c.stem} at ${formatDuration(a.at)}`}
                  placeholder="Add a note about this moment…"
                  value={a.note}
                  onChange={(e) => patchNote(a, e.target.value)}
                  rows={2}
                />
              </article>
            ) : null;
          })}
        </div>
      )}
      <div className="backup-actions">
        <button
          onClick={() =>
            downloadJSON(`${trip.name}-annotations.json`, exportBackup(trip))
          }
        >
          <Download />
          Export notes
        </button>
        <button onClick={() => backup.current?.click()}>
          <Upload />
          Import notes
        </button>
        <input
          ref={backup}
          hidden
          type="file"
          accept="application/json,.json"
          aria-label="Annotations backup"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            try {
              if (f.size > 5e6)
                throw new Error("Backup is too large. Maximum size is 5 MB.");
              onPatch(readBackup(JSON.parse(await f.text()), trip));
              onMessage("Matching notes and corrections restored.");
            } catch (err) {
              onMessage(
                err instanceof Error
                  ? err.message
                  : "Could not read this backup.",
              );
            }
          }}
        />
      </div>
    </ResponsivePanel>
  );
}
