import { useCallback, useEffect, useRef, useState } from "react";
import type { IndexedClip, Resume } from "../core/types";
import { library } from "../core/files";
import { SeekBar } from "./SeekBar";
import { Choice } from "./Choice";
import { SeekStepIcon } from "./SeekStepIcon";
import { elapsedBefore, formatDuration, queuePosition } from "../core/indexer";
import {
  AlertTriangle,
  Bookmark,
  Maximize,
  Minimize,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  RefreshCw,
} from "./Icons";
export interface PlaybackRequest {
  id: string;
  at: number;
  autoplay: boolean;
  nonce: number;
}
export function Player({
  queue,
  request,
  connection,
  resume,
  onChange,
  onResume,
  onBookmark,
  onMessage,
}: {
  queue: IndexedClip[];
  request: PlaybackRequest;
  connection: number;
  resume?: Resume;
  onChange: (clip: IndexedClip) => void;
  onResume: (r: Omit<Resume, "scope">) => void;
  onBookmark: (at: number) => void;
  onMessage: (message: string) => void;
}) {
  const ref = useRef<HTMLVideoElement>(null),
    frame = useRef<HTMLDivElement>(null),
    preload = useRef<HTMLVideoElement>(null);
  const [id, setId] = useState(request.id),
    [at, setAt] = useState(request.at),
    [playing, setPlaying] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const [speed, setSpeed] = useState(resume?.speed || 1),
    [volume, setVolume] = useState(resume?.volume ?? 1);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const update = () =>
      setFullscreen(document.fullscreenElement === frame.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement === frame.current)
        await document.exitFullscreen();
      else await frame.current?.requestFullscreen();
    } catch {
      onMessage("Fullscreen is unavailable in this browser.");
    }
  }, [onMessage]);
  const pendingSeek = useRef<{ clipId: string; at: number } | null>(null);
  const loadedId = useRef("");
  const desired = useRef({ at: request.at, play: request.autoplay });
  const lastSave = useRef(0);
  const callbacks = useRef({ onChange, onResume });
  callbacks.current = { onChange, onResume };
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const idRef = useRef(id);
  idRef.current = id;
  const index = queue.findIndex((c) => c.id === id),
    clip = queue[index];
  const total = queue.reduce((s, c) => s + c.duration, 0);
  const cumulative = elapsedBefore(queue, Math.max(0, index)) + at;
  const speedRef = useRef(speed),
    volumeRef = useRef(volume);
  speedRef.current = speed;
  volumeRef.current = volume;
  const save = useCallback(() => {
    const v = ref.current;
    if (
      pendingSeek.current ||
      (v && idRef.current && loadedId.current === idRef.current)
    )
      callbacks.current.onResume({
        clipId: pendingSeek.current?.clipId || idRef.current,
        at: pendingSeek.current?.at ?? v?.currentTime ?? 0,
        speed: speedRef.current,
        volume: volumeRef.current,
      });
  }, []);
  const jump = useCallback(
    (next: IndexedClip, offset: number, play: boolean) => {
      if (next.id !== idRef.current) save();
      offset = Math.max(
        0,
        Math.min(offset, Math.max(0, next.duration - 0.001)),
      );
      desired.current = { at: offset, play };
      pendingSeek.current = { clipId: next.id, at: offset };
      if (
        next.id === idRef.current &&
        ref.current &&
        loadedId.current === next.id
      ) {
        ref.current.currentTime = offset;
        setAt(offset);
        if (play) void ref.current.play().catch(() => setPlaying(false));
        else ref.current.pause();
      } else {
        setId(next.id);
        setAt(offset);
      }
      callbacks.current.onChange(next);
      callbacks.current.onResume({
        clipId: next.id,
        at: offset,
        speed: speedRef.current,
        volume: volumeRef.current,
      });
    },
    [save],
  );
  useEffect(() => {
    const c = queueRef.current.find((c) => c.id === request.id);
    if (c) jump(c, request.at, request.autoplay);
  }, [request.nonce, jump]);
  useEffect(() => {
    if (!queue.some((c) => c.id === id) && queue[0]) {
      const requested = queue.find((c) => c.id === request.id);
      jump(
        requested || queue[0],
        requested ? request.at : 0,
        requested ? request.autoplay : false,
      );
    }
  }, [queue, id, jump, request]);
  useEffect(() => {
    if (!clip) return;
    let live = true;
    let url = "";
    loadedId.current = "";
    setLoading(true);
    setError("");
    const v = ref.current!;
    library
      .read(clip.video)
      .then((file) => {
        if (!live) return;
        url = URL.createObjectURL(file);
        v.src = url;
        v.load();
      })
      .catch((e) => {
        if (live) {
          setError(e instanceof Error ? e.message : "Cannot read recording.");
          setLoading(false);
        }
      });
    return () => {
      live = false;
      v.pause();
      v.removeAttribute("src");
      v.load();
      if (url) URL.revokeObjectURL(url);
    };
  }, [clip?.id, connection, retry]);
  useEffect(() => {
    const next = queue[index + 1];
    const v = preload.current;
    if (!next || !v) return;
    let live = true;
    let url = "";
    library
      .read(next.video)
      .then((f) => {
        if (live) {
          url = URL.createObjectURL(f);
          v.src = url;
          v.load();
        }
      })
      .catch(() => {});
    return () => {
      live = false;
      v.removeAttribute("src");
      v.load();
      if (url) URL.revokeObjectURL(url);
    };
  }, [queue[index + 1]?.id, connection]);
  useEffect(() => {
    if (ref.current) ref.current.playbackRate = speed;
    save();
  }, [speed, save]);
  useEffect(() => {
    if (ref.current) ref.current.volume = volume;
    save();
  }, [volume, save]);
  const seek = useCallback(
    (seconds: number) => {
      const q = queueRef.current;
      const p = queuePosition(q, seconds);
      if (q[p.index])
        jump(q[p.index], p.at, desired.current.play || !ref.current?.paused);
    },
    [jump],
  );
  const toggle = useCallback(() => {
    const v = ref.current;
    if (!v || !v.src) return;
    if (v.paused) {
      desired.current.play = true;
      void v
        .play()
        .catch(() =>
          setError("Playback was blocked. Press play again to continue."),
        );
    } else {
      desired.current.play = false;
      v.pause();
    }
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest(
          "input,textarea,select,button,[contenteditable],dialog",
        )
      )
        return;
      const q = queueRef.current;
      const i = q.findIndex((c) => c.id === idRef.current);
      const current =
        elapsedBefore(q, Math.max(0, i)) + (ref.current?.currentTime || 0);
      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        seek(current + 10);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        seek(current - 10);
      } else if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        void toggleFullscreen();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [toggle, seek, toggleFullscreen]);
  useEffect(() => {
    const flush = () => save();
    window.addEventListener("pagehide", flush);
    return () => {
      save();
      window.removeEventListener("pagehide", flush);
    };
  }, [save]);
  const step = (delta: number) => {
    if (queue[index + delta]) jump(queue[index + delta], 0, playing);
  };
  return (
    <div className="player" ref={frame}>
      <div className="video-stage">
        <video
          ref={ref}
          playsInline
          preload="metadata"
          aria-label="Trip recording"
          onLoadedMetadata={() => {
            loadedId.current = id;
            const v = ref.current!;
            v.playbackRate = speedRef.current;
            v.volume = volumeRef.current;
            v.currentTime = Math.min(
              desired.current.at,
              Math.max(0, v.duration - 0.01),
            );
            setLoading(false);
            if (desired.current.play)
              void v.play().catch(() => setPlaying(false));
          }}
          onTimeUpdate={() => {
            const v = ref.current;
            if (loadedId.current === id && v && !v.seeking)
              pendingSeek.current = null;
            setAt(v?.currentTime || 0);
            if (Date.now() - lastSave.current > 2500) {
              lastSave.current = Date.now();
              save();
            }
          }}
          onSeeked={() => {
            if (
              pendingSeek.current?.clipId === id &&
              Math.abs(
                (ref.current?.currentTime || 0) - pendingSeek.current.at,
              ) < 0.2
            )
              pendingSeek.current = null;
            save();
          }}
          onPlay={() => {
            setPlaying(true);
            desired.current.play = true;
          }}
          onPause={() => {
            setPlaying(false);
            save();
          }}
          onEnded={() => {
            const next = queue[index + 1];
            if (next) jump(next, 0, true);
            else {
              desired.current.play = false;
              setPlaying(false);
              save();
            }
          }}
          onError={() => {
            setLoading(false);
            setError(
              "This recording cannot be played. Reconnect its folder, retry, or skip to the next recording.",
            );
          }}
          onClick={toggle}
        />
        <video
          ref={preload}
          preload="auto"
          muted
          className="preload-video"
          aria-hidden="true"
        />
        {loading && !error && (
          <div className="video-message" role="status">
            <span className="spinner" />
            Loading recording…
          </div>
        )}
        {error && (
          <div className="video-message error" role="alert">
            <AlertTriangle />
            <h3>Recording unavailable</h3>
            <p>{error}</p>
            <div className="button-row">
              <button
                onClick={() => {
                  desired.current.at =
                    pendingSeek.current?.at ??
                    (loadedId.current === id
                      ? (ref.current?.currentTime ?? at)
                      : at);
                  setRetry((r) => r + 1);
                }}
              >
                <RefreshCw />
                Retry
              </button>
              <button
                disabled={index >= queue.length - 1}
                onClick={() => step(1)}
              >
                Skip recording
                <SkipForward />
              </button>
            </div>
          </div>
        )}
        {!playing && !loading && !error && (
          <button
            className="center-play"
            aria-label="Play recording"
            onClick={toggle}
          >
            <Play className="play-glyph" fill="currentColor" />
          </button>
        )}
      </div>
      <SeekBar
        queue={queue}
        value={cumulative}
        total={total}
        onSeek={seek}
        connection={connection}
      />
      <div className="player-controls">
        <div className="transport">
          <button
            className="icon-button"
            aria-label="Previous recording"
            disabled={index <= 0}
            onClick={() => step(-1)}
          >
            <SkipBack />
          </button>
          <button
            className="icon-button seek-button"
            aria-label="Back 10 seconds"
            title="Back 10 seconds"
            onClick={() => seek(cumulative - 10)}
          >
            <SeekStepIcon />
          </button>
          <button
            className="play-button"
            aria-label={playing ? "Pause" : "Play"}
            onClick={toggle}
          >
            {playing ? (
              <Pause fill="currentColor" />
            ) : (
              <Play className="play-glyph" fill="currentColor" />
            )}
          </button>
          <button
            className="icon-button seek-button"
            aria-label="Forward 10 seconds"
            title="Forward 10 seconds"
            onClick={() => seek(cumulative + 10)}
          >
            <SeekStepIcon forward />
          </button>
          <button
            className="icon-button"
            aria-label="Next recording"
            disabled={index >= queue.length - 1}
            onClick={() => step(1)}
          >
            <SkipForward />
          </button>
        </div>
        <span className="control-divider" />
        <div className="speed-control">
          <Choice
            label="Playback speed"
            value={String(speed)}
            options={[0.5, 1, 1.25, 1.5, 2, 3, 4].map((v) => ({
              value: String(v),
              label: `${v}×`,
            }))}
            onChange={(value) => {
              setSpeed(Number(value));
              if (ref.current) ref.current.playbackRate = Number(value);
            }}
          />
        </div>
        <span className="recording-count">
          {index + 1} / {queue.length}
        </span>
        <div className="volume-control">
          <button
            className="icon-button"
            aria-label={volume ? "Mute" : "Unmute"}
            onClick={() => setVolume(volume ? 0 : 1)}
          >
            {volume ? <Volume2 /> : <VolumeX />}
          </button>
          <input
            aria-label="Volume"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => setVolume(+e.target.value)}
          />
        </div>
        <button
          className="icon-button bookmark-player"
          aria-label="Bookmark current moment"
          onClick={() => onBookmark(at)}
        >
          <Bookmark />
          <span className="mobile-bookmark-label">Save moment</span>
        </button>
        <button
          className="icon-button"
          aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          onClick={() => void toggleFullscreen()}
        >
          {fullscreen ? <Minimize /> : <Maximize />}
        </button>
      </div>
    </div>
  );
}
