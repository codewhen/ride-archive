import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db } from "./core/db";
import { checkpointResume, restoreResume } from "./core/resume";
import { channelLabel } from "./core/camera";
import type { CameraChannel } from "./core/camera";
import type { Annotation, ImportResult, IndexedClip, Trip } from "./core/types";
import {
  cameraTime,
  formatDuration,
  labelDate,
  makeDays,
} from "./core/indexer";
import {
  collectDirectory,
  downloadJSON,
  fromFileList,
  library,
} from "./core/files";
import type { DirectoryHandle } from "./core/files";
import { ImportDialog } from "./components/ImportDialog";
import { Details } from "./components/Details";
import { Dialog } from "./components/Dialog";
import { ResponsivePanel } from "./components/ResponsivePanel";
import { Player } from "./components/Player";
import type { PlaybackRequest } from "./components/Player";
import { Filmstrip } from "./components/Filmstrip";
import { Choice } from "./components/Choice";
import { VirtualList } from "./components/VirtualList";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Film,
  FolderOpen,
  Info,
  Keyboard,
  Link2,
  Menu,
  Search,
  Star,
  Upload,
  X,
} from "./components/Icons";
export default function App() {
  const [trips, setTrips] = useState<Trip[]>([]),
    [tripId, setTripId] = useState(""),
    [loaded, setLoaded] = useState(false),
    [message, setMessage] = useState("");
  const [importing, setImporting] = useState(false),
    [health, setHealth] = useState(false),
    [shortcuts, setShortcuts] = useState(false),
    [details, setDetails] = useState(false),
    [tab, setTab] = useState<"recording" | "bookmarks">("recording"),
    [rail, setRail] = useState(false);
  const [dayKey, setDayKey] = useState(""),
    [scope, setScope] = useState<"day" | "trip">("day"),
    [query, setQuery] = useState(""),
    [onlyFavourites, setOnlyFavourites] = useState(false),
    [connected, setConnected] = useState(false),
    [connection, setConnection] = useState(0);
  const [request, setRequest] = useState<PlaybackRequest>({
      id: "",
      at: 0,
      autoplay: false,
      nonce: 0,
    }),
    [currentId, setCurrentId] = useState("");
  const reconnectInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !(e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable],dialog",
        )
      ) {
        e.preventDefault();
        document
          .querySelector<HTMLInputElement>(
            'input[aria-label="Search recordings"]',
          )
          ?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const activeRef = useRef("");
  activeRef.current = tripId;
  const trip = trips.find((t) => t.id === tripId);
  const [channel, setChannel] = useState<CameraChannel>("unspecified");
  const channels = useMemo(
    () => [
      ...new Set(trip?.clips.map((c) => c.channel || "unspecified") || []),
    ],
    [trip?.clips],
  );
  const days = useMemo(
    () =>
      trip
        ? makeDays(
            trip.clips.filter((c) => (c.channel || "unspecified") === channel),
            trip.corrections,
          )
        : [],
    [trip?.clips, trip?.corrections, channel],
  );
  const allClips = useMemo(
    () =>
      days
        .flatMap((d) => d.clips)
        .sort(
          (a, b) =>
            a.effectiveStart - b.effectiveStart || a.sequence - b.sequence,
        ),
    [days],
  );
  const selectedDay =
    days.find((d) => d.key === dayKey) ||
    days.find((d) => d.clips.some((c) => c.id === currentId)) ||
    days[0];
  const current =
    allClips.find((c) => c.id === currentId) || selectedDay?.clips[0];
  const queue = useMemo(
    () => (scope === "trip" ? allClips : selectedDay?.clips || []),
    [scope, allClips, selectedDay],
  );
  const notify = useCallback((s: string) => setMessage(s), []);
  useEffect(() => {
    if (
      !/^(Imported|Updated|Original folder|Moment saved|Session date|Matching notes)/.test(
        message,
      )
    )
      return;
    const timer = setTimeout(() => setMessage(""), 7000);
    return () => clearTimeout(timer);
  }, [message]);
  const patch = useCallback((id: string, values: Partial<Trip>) => {
    if (values.resume) checkpointResume(id, values.resume);
    const patch = { ...values, updated: Date.now() };
    setTrips((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    void db.trips
      .update(id, patch)
      .catch(() =>
        setMessage(
          "Your latest changes could not be saved. Export your notes before closing this page.",
        ),
      );
  }, []);
  const selectTrip = useCallback(async (t: Trip) => {
    const resume = restoreResume(t);
    if (resume !== t.resume)
      setTrips((prev) =>
        prev.map((item) => (item.id === t.id ? { ...item, resume } : item)),
      );
    activeRef.current = t.id;
    setTripId(t.id);
    setConnected(false);
    setQuery("");
    setOnlyFavourites(false);
    setScope(resume?.scope || "day");
    const available = [
      ...new Set(t.clips.map((c) => c.channel || "unspecified")),
    ];
    const resumedClip = t.clips.find((c) => c.id === resume?.clipId);
    const nextChannel =
      (resumedClip && (resumedClip.channel || "unspecified")) ||
      (available.includes("front") ? "front" : available[0]) ||
      "unspecified";
    setChannel(nextChannel);
    const days = makeDays(
      t.clips.filter((c) => (c.channel || "unspecified") === nextChannel),
      t.corrections,
    );
    const c =
      days.flatMap((d) => d.clips).find((c) => c.id === resume?.clipId) ||
      days[0]?.clips[0];
    if (c) {
      setDayKey(new Date(c.effectiveStart).toISOString().slice(0, 10));
      setCurrentId(c.id);
      setRequest((r) => ({
        id: c.id,
        at: resume?.clipId === c.id ? resume.at : 0,
        autoplay: false,
        nonce: r.nonce + 1,
      }));
    }
    try {
      const restored = await library.restore(t);
      if (activeRef.current === t.id) {
        setConnected(restored);
        setConnection((n) => n + 1);
      }
    } catch {
      if (activeRef.current === t.id) setConnected(false);
    }
  }, []);
  useEffect(() => {
    db.trips
      .orderBy("updated")
      .reverse()
      .toArray()
      .then(async (list) => {
        setTrips(list);
        setLoaded(true);
        if (list[0]) await selectTrip(list[0]);
      })
      .catch(() => {
        setLoaded(true);
        notify(
          "Browser storage is unavailable. Enable site storage to save your local library.",
        );
      });
  }, [notify, selectTrip]);
  async function commit(result: ImportResult) {
    const previous = trips.find(
      (t) =>
        t.name === result.name &&
        t.clips.some((c) =>
          result.clips.some(
            (n) => n.id === c.id && n.video.size === c.video.size,
          ),
        ),
    );
    const matches = new Set(
      result.clips
        .filter((c) =>
          previous?.clips.some(
            (o) => o.id === c.id && o.video.size === c.video.size,
          ),
        )
        .map((c) => c.id),
    );
    const t: Trip = {
      id: previous?.id || crypto.randomUUID(),
      name: result.name,
      created: previous?.created || Date.now(),
      updated: Date.now(),
      clips: result.clips,
      issues: result.issues,
      annotations:
        previous?.annotations.filter((a) => matches.has(a.clipId)) || [],
      corrections:
        previous?.corrections.filter((c) =>
          result.clips.some((v) => v.sessionId === c.sessionId),
        ) || [],
      resume:
        previous?.resume && matches.has(previous.resume.clipId)
          ? previous.resume
          : undefined,
      handle: result.handle,
    };
    await db.trips.put(t);
    setTrips((prev) => [t, ...prev.filter((x) => x.id !== t.id)]);
    await selectTrip(t);
    library.connect(result.files, result.handle);
    setConnected(true);
    setConnection((n) => n + 1);
    setImporting(false);
    notify(
      `${previous ? "Updated" : "Imported"} ${t.clips.length.toLocaleString()} recordings. Originals are untouched.`,
    );
  }
  const jump = useCallback((c: IndexedClip, at = 0, autoplay = true) => {
    setDayKey(new Date(c.effectiveStart).toISOString().slice(0, 10));
    setCurrentId(c.id);
    setRequest((r) => ({ id: c.id, at, autoplay, nonce: r.nonce + 1 }));
    setRail(false);
    setQuery("");
  }, []);
  const bookmark = (at: number) => {
    if (!trip || !current) return;
    const a: Annotation = {
      id: crypto.randomUUID(),
      clipId: current.id,
      at,
      note: "",
      favourite: false,
    };
    patch(trip.id, { annotations: [...trip.annotations, a] });
    setDetails(true);
    setTab("bookmarks");
    notify(`Moment saved at ${formatDuration(at)} in this recording.`);
  };
  async function reconnect() {
    if (!trip) return;
    try {
      if (
        trip.handle &&
        (await (trip.handle as DirectoryHandle).requestPermission({
          mode: "read",
        })) === "granted"
      ) {
        library.connect(new Map(), trip.handle);
        setConnected(true);
        setConnection((n) => n + 1);
        return;
      }
      if ("showDirectoryPicker" in window) {
        const handle = await (
          window as unknown as {
            showDirectoryPicker: (o: {
              mode: string;
            }) => Promise<FileSystemDirectoryHandle>;
          }
        ).showDirectoryPicker({ mode: "read" });
        const sources = await collectDirectory(handle);
        connectSources(sources, handle);
      } else reconnectInput.current?.click();
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      notify(
        "Folder access was denied or the folder moved. Select the original folder again, or re-import it.",
      );
    }
  }
  function connectSources(
    sources: ReturnType<typeof fromFileList>,
    handle?: FileSystemDirectoryHandle,
  ) {
    if (!trip) return;
    const files = new Map(sources.map((s) => [s.path, s.file]));
    const matched = trip.clips.filter((c) => {
      const f = files.get(c.video.path);
      return (
        f && f.size === c.video.size && f.lastModified === c.video.modified
      );
    });
    if (!matched.length) {
      notify(
        "This folder does not match the saved recordings. Choose the original folder or import a new trip.",
      );
      return;
    }
    library.connect(files, handle);
    if (handle) patch(trip.id, { handle });
    setConnected(true);
    setConnection((n) => n + 1);
    notify(
      matched.length === trip.clips.length
        ? "Original folder reconnected."
        : `${matched.length} of ${trip.clips.length} recordings reconnected. Re-import to update missing or changed files.`,
    );
  }
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const favourites = new Set(
      trip?.annotations.filter((a) => a.favourite).map((a) => a.clipId),
    );
    return allClips.filter(
      (c) =>
        (!onlyFavourites || favourites.has(c.id)) &&
        (!q ||
          [
            c.stem,
            labelDate(c.effectiveStart),
            new Date(c.effectiveStart).toISOString().slice(0, 10),
            ...(trip?.annotations
              .filter((a) => a.clipId === c.id)
              .map((a) => a.note) || []),
          ].some((s) => s.toLowerCase().includes(q))),
    );
  }, [query, onlyFavourites, allClips, trip?.annotations]);
  const total = allClips.reduce((s, c) => s + c.duration, 0);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to player
      </a>
      <header className="app-header">
        {trip && (
          <button
            className="icon-button mobile-menu"
            aria-label="Toggle trip timeline"
            aria-expanded={rail}
            onClick={() => setRail(!rail)}
          >
            <Menu />
          </button>
        )}
        <a className="brand" href="#main" aria-label="Ride Archive home">
          <span className="brand-mark" />
          <span>
            Ride Archive<span className="brand-period">.</span>
          </span>
        </a>
        {trip && (
          <div className="trip-select">
            {trips.length > 1 ? (
              <Choice
                label="Trip library"
                value={tripId}
                options={trips.map((t) => ({ value: t.id, label: t.name }))}
                onChange={(id) => {
                  const t = trips.find((t) => t.id === id);
                  if (t) void selectTrip(t);
                }}
              />
            ) : (
              <span className="trip-name" title={trip.name}>
                {trip.name}
              </span>
            )}
          </div>
        )}
        {trip && (
          <label className="search-input">
            <Search />
            <input
              aria-label="Search recordings"
              placeholder="Search recordings, dates, notes…"
              value={query}
              disabled={!trip}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                className="icon-button small"
                aria-label="Clear search"
                onClick={() => setQuery("")}
              >
                <X />
              </button>
            )}
            <kbd>/</kbd>
          </label>
        )}
        {trip && (
          <button
            className="primary import-button"
            onClick={() => setImporting(true)}
          >
            <FolderOpen />
            <span>Import folder</span>
          </button>
        )}
      </header>
      <div
        className={`app-shell ${!trip ? "is-empty" : ""} ${details && trip ? "with-details" : ""}`}
      >
        {trip && (
          <ResponsivePanel
            className="day-rail"
            label="Trip timeline"
            query="(max-width: 720px)"
            open={rail}
            onClose={() => setRail(false)}
          >
            <div className="rail-heading">
              <Film />
              <h2>Trip timeline</h2>
              <button
                className="icon-button small rail-close"
                aria-label="Close trip timeline"
                onClick={() => setRail(false)}
              >
                <X />
              </button>
            </div>
            {trip && (
              <>
                <div className="rail-summary">
                  <span>
                    {days.length}{" "}
                    {days.length === 1 ? "recording day" : "recording days"}
                  </span>
                  <span>{formatDuration(total)} recorded</span>
                </div>
                <nav aria-label="Recording days">
                  {days.map((day, i) => (
                    <div className="day-group" key={day.key}>
                      <button
                        className={`day-button ${selectedDay?.key === day.key ? "active" : ""}`}
                        onClick={() => jump(day.clips[0], 0, false)}
                        aria-expanded={selectedDay?.key === day.key}
                        aria-current={
                          selectedDay?.key === day.key ? "date" : undefined
                        }
                      >
                        <span className="day-order">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="day-label">
                          {labelDate(day.start, {
                            month: "short",
                            day: "2-digit",
                          })}
                          <span>{new Date(day.start).getUTCFullYear()}</span>
                        </span>
                        <span className="day-clips">
                          {day.clips.length}
                          <span>clips</span>
                        </span>
                        {selectedDay?.key === day.key ? (
                          <ChevronDown />
                        ) : (
                          <ChevronRight />
                        )}
                      </button>
                      {selectedDay?.key === day.key && (
                        <div className="sessions">
                          {day.sessions.map((s, j) => (
                            <div key={`${s.id}-${j}`}>
                              {s.gap > 0 && (
                                <p className="session-gap">
                                  {formatDuration(s.gap)} recording gap
                                </p>
                              )}
                              <button
                                className={`session-button ${current?.sessionId === s.id ? "current" : ""}`}
                                onClick={() => jump(s.clips[0], 0, false)}
                              >
                                <span className="session-dot" />
                                <span>
                                  Session {String(j + 1).padStart(2, "0")}
                                  <small>
                                    {cameraTime(s.start)} – {cameraTime(s.end)}
                                  </small>
                                </span>
                                <span className="session-count">
                                  {s.clips.length}
                                </span>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </nav>
                <button
                  className={`rail-favourites ${onlyFavourites ? "active" : ""}`}
                  onClick={() => setOnlyFavourites(!onlyFavourites)}
                >
                  <Star />
                  Favourites
                  <span>
                    {trip.annotations.filter((a) => a.favourite).length}
                  </span>
                </button>
              </>
            )}
            <div className="rail-footer">
              {trip && (
                <button
                  className={
                    trip.issues.length
                      ? "health-link has-issues"
                      : "health-link"
                  }
                  onClick={() => setHealth(true)}
                >
                  {trip.issues.length ? <AlertTriangle /> : <Check />}Import
                  health <span>{trip.issues.length || "OK"}</span>
                </button>
              )}
              <button
                className="text-button keyboard-link"
                onClick={() => setShortcuts(true)}
              >
                <Keyboard />
                Keyboard shortcuts
              </button>
            </div>
          </ResponsivePanel>
        )}
        <main id="main" tabIndex={-1}>
          {!loaded ? (
            <div className="welcome-loading" role="status">
              <span className="spinner" />
              Opening your archive…
            </div>
          ) : !trip ? (
            <section className="welcome">
              <div className="welcome-symbol">
                <FolderOpen />
              </div>
              <h1>
                Watch your ride,
                <br />
                <span>start to finish.</span>
              </h1>
              <p>
                Choose a recording folder to build your trip timeline. Your
                videos stay on this device.
              </p>
              <button
                className="primary large"
                onClick={() => setImporting(true)}
              >
                <FolderOpen />
                Import folder
              </button>
              <p className="welcome-formats">
                Video clips of any length. Thumbnails are optional.
              </p>
            </section>
          ) : (
            <>
              <div className="main-heading">
                <div>
                  <h1>
                    {selectedDay ? labelDate(selectedDay.start) : trip.name}
                  </h1>
                  <p className="day-caption">
                    <span>
                      {selectedDay?.clips.length} recordings ·{" "}
                      {formatDuration(selectedDay?.duration || 0)} recorded
                    </span>
                  </p>
                </div>
                <div className="heading-actions">
                  {channels.length > 1 && (
                    <div className="camera-select">
                      <Choice
                        label="Camera view"
                        value={channel}
                        options={channels.map((c) => ({
                          value: c,
                          label: channelLabel(c),
                        }))}
                        onChange={(value) => {
                          const next = value as CameraChannel;
                          setChannel(next);
                          const candidates = makeDays(
                            trip.clips.filter(
                              (c) => (c.channel || "unspecified") === next,
                            ),
                            trip.corrections,
                          ).flatMap((d) => d.clips);
                          const target = candidates.reduce<
                            IndexedClip | undefined
                          >(
                            (best, c) =>
                              !best ||
                              Math.abs(
                                c.effectiveStart -
                                  (current?.effectiveStart || 0),
                              ) <
                                Math.abs(
                                  best.effectiveStart -
                                    (current?.effectiveStart || 0),
                                )
                                ? c
                                : best,
                            undefined,
                          );
                          if (target) jump(target, 0, false);
                        }}
                      />
                    </div>
                  )}
                  <div className="scope-tabs" aria-label="Playback scope">
                    <button
                      className={scope === "day" ? "active" : ""}
                      aria-pressed={scope === "day"}
                      onClick={() => setScope("day")}
                    >
                      Day
                    </button>
                    <button
                      className={scope === "trip" ? "active" : ""}
                      aria-pressed={scope === "trip"}
                      onClick={() => setScope("trip")}
                    >
                      Entire trip
                    </button>
                  </div>
                  <button
                    className={`details-toggle ${details ? "active" : ""}`}
                    aria-label="Toggle recording details"
                    aria-expanded={details}
                    onClick={() => {
                      setDetails(!details);
                      setTab("recording");
                    }}
                  >
                    <Info />
                    Details
                  </button>
                </div>
              </div>
              {!connected && (
                <div className="reconnect-banner">
                  <Link2 />
                  <p>
                    <strong>Reconnect your footage.</strong> Your index and
                    notes are saved; folder access needs to be restored.
                  </p>
                  <button onClick={() => void reconnect()}>
                    Reconnect folder
                  </button>
                </div>
              )}
              {(query || onlyFavourites) && (
                <section className="search-results">
                  <div className="section-line">
                    <h2>
                      {onlyFavourites ? "Favourites" : "Search results"}{" "}
                      <span>{results.length}</span>
                    </h2>
                    <button
                      className="text-button"
                      onClick={() => {
                        setQuery("");
                        setOnlyFavourites(false);
                      }}
                    >
                      Clear filter
                      <X size={14} />
                    </button>
                  </div>
                  {results.length ? (
                    <VirtualList
                      items={results}
                      height={300}
                      rowHeight={60}
                      label="Matching recordings"
                      render={(c) => (
                        <button
                          className="search-result"
                          onClick={() => jump(c)}
                        >
                          <span className="mono">
                            {cameraTime(c.effectiveStart)}
                          </span>
                          <span>
                            {c.stem}
                            <small>
                              {trip.annotations
                                .filter((a) => a.clipId === c.id)
                                .map((a) => a.note)
                                .filter(Boolean)
                                .join(" · ") || labelDate(c.effectiveStart)}
                            </small>
                          </span>
                          <span>
                            {Math.round(c.duration)}s<ChevronRight />
                          </span>
                        </button>
                      )}
                    />
                  ) : (
                    <p className="help-text">
                      No matching recordings. Try a date, filename, or saved
                      note.
                    </p>
                  )}
                </section>
              )}
              {current && queue.length > 0 && (
                <>
                  <Player
                    key={trip.id}
                    queue={queue}
                    request={request}
                    connection={connection}
                    resume={trip.resume}
                    onChange={(c) => {
                      setCurrentId(c.id);
                      setDayKey(
                        new Date(c.effectiveStart).toISOString().slice(0, 10),
                      );
                    }}
                    onResume={(r) =>
                      patch(trip.id, { resume: { ...r, scope, channel } })
                    }
                    onBookmark={bookmark}
                    onMessage={notify}
                  />
                  <Filmstrip
                    clips={queue}
                    currentId={current.id}
                    connection={connection}
                    onSelect={(c) => jump(c)}
                  />
                </>
              )}
            </>
          )}
        </main>
        {trip && current && details && (
          <Details
            key={trip.id}
            trip={trip}
            clip={current}
            tab={tab}
            onTab={setTab}
            onClose={() => setDetails(false)}
            onPatch={(p) => patch(trip.id, p)}
            onJump={(id, at) => {
              const source = trip.clips.find((c) => c.id === id);
              if (!source) return;
              const nextChannel = source.channel || "unspecified";
              const c = makeDays(
                trip.clips.filter(
                  (c) => (c.channel || "unspecified") === nextChannel,
                ),
                trip.corrections,
              )
                .flatMap((d) => d.clips)
                .find((c) => c.id === id);
              if (c) {
                setChannel(nextChannel);
                jump(c, at);
                setDetails(false);
              }
            }}
            onMessage={notify}
          />
        )}
      </div>
      {message && (
        <div className="toast" role="status">
          <Info />
          <span>{message}</span>
          <button
            className="icon-button small"
            aria-label="Dismiss notification"
            onClick={() => setMessage("")}
          >
            <X />
          </button>
        </div>
      )}
      {importing && (
        <ImportDialog onClose={() => setImporting(false)} onCommit={commit} />
      )}
      <input
        hidden
        ref={reconnectInput}
        type="file"
        multiple
        {...{ webkitdirectory: "" }}
        aria-label="Reconnect recording folder"
        onChange={(e) => {
          if (e.target.files?.length)
            connectSources(fromFileList(e.target.files));
          e.target.value = "";
        }}
      />
      {health && trip && (
        <Dialog title="Import health" onClose={() => setHealth(false)} wide>
          <div
            className={`validation-summary ${trip.issues.length ? "invalid" : "valid"}`}
          >
            {trip.issues.length ? <AlertTriangle /> : <Check />}
            <div>
              <h3>
                {trip.issues.length
                  ? `${trip.issues.length} issues in the source folder`
                  : "All recordings passed validation"}
              </h3>
              <p>
                {trip.clips.length.toLocaleString()} playable recordings
                indexed. Original files are unchanged.
              </p>
            </div>
          </div>
          {!!trip.issues.length && (
            <VirtualList
              items={trip.issues}
              height={360}
              rowHeight={78}
              label="Saved import issues"
              render={(issue) => (
                <div className="issue-row">
                  <span className="issue-dot" />
                  <div>
                    <code title={issue.path}>{issue.path}</code>
                    <p>{issue.message}</p>
                  </div>
                </div>
              )}
            />
          )}
          <div className="dialog-actions">
            <button
              onClick={() =>
                downloadJSON(`${trip.name}-import-report.json`, {
                  name: trip.name,
                  readable: trip.clips.length,
                  issues: trip.issues,
                })
              }
            >
              <Download />
              Download report
            </button>
            <button
              onClick={() => {
                setHealth(false);
                setImporting(true);
              }}
            >
              <Upload />
              Re-import folder
            </button>
          </div>
        </Dialog>
      )}
      {shortcuts && (
        <Dialog title="Keyboard shortcuts" onClose={() => setShortcuts(false)}>
          <dl className="shortcut-list">
            <div>
              <dt>
                <kbd>Space</kbd>
              </dt>
              <dd>Play / pause</dd>
            </div>
            <div>
              <dt>
                <kbd>←</kbd> <kbd>→</kbd>
              </dt>
              <dd>Seek 10 seconds across recordings</dd>
            </div>
            <div>
              <dt>
                <kbd>F</kbd>
              </dt>
              <dd>Toggle fullscreen</dd>
            </div>
            <div>
              <dt>
                <kbd>Esc</kbd>
              </dt>
              <dd>Close dialog / exit fullscreen</dd>
            </div>
          </dl>
          <p className="help-text">
            Player shortcuts work when you are not typing or focusing a control.
          </p>
        </Dialog>
      )}
    </>
  );
}
