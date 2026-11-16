import { useEffect, useRef, useState } from "react";
import { Dialog } from "./Dialog";
import { AlertTriangle, Check, Download, FolderOpen, Upload } from "./Icons";
import { collectDirectory, downloadJSON, fromFileList } from "../core/files";
import { inspectFolder } from "../core/importer";
import type { Progress } from "../core/importer";
import type { ImportResult } from "../core/types";
import { VirtualList } from "./VirtualList";
import { formatDuration } from "../core/indexer";
export function ImportDialog({
  onClose,
  onCommit,
}: {
  onClose: () => void;
  onCommit: (result: ImportResult) => Promise<void>;
}) {
  const [progress, setProgress] = useState<Progress | null>(null),
    [result, setResult] = useState<ImportResult | null>(null),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const close = () => {
    controller.current?.abort();
    onClose();
  };
  async function inspect(
    name: string,
    files: Parameters<typeof inspectFolder>[1],
    signal: AbortSignal,
    handle?: FileSystemDirectoryHandle,
  ) {
    try {
      const r = await inspectFolder(name, files, signal, setProgress, handle);
      if (signal.aborted) return;
      setResult(r);
      setProgress(null);
    } catch (e) {
      if (signal.aborted) return;
      setError(
        e instanceof Error ? e.message : "Could not inspect this folder.",
      );
      setProgress(null);
    }
  }
  async function pick() {
    if (!("showDirectoryPicker" in window)) {
      input.current?.click();
      return;
    }
    setError("");
    setResult(null);
    const ac = new AbortController();
    controller.current = ac;
    try {
      const handle = await (
        window as unknown as {
          showDirectoryPicker: (o: {
            mode: string;
          }) => Promise<FileSystemDirectoryHandle>;
        }
      ).showDirectoryPicker({ mode: "read" });
      setProgress({ stage: "Reading folder contents", done: 0, total: 0 });
      const files = await collectDirectory(handle, ac.signal);
      await inspect(handle.name, files, ac.signal, handle);
    } catch (e) {
      if (ac.signal.aborted) return;
      setProgress(null);
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(
        e instanceof Error
          ? e.message
          : "Folder permission was denied. Try selecting the folder again.",
      );
    }
  }
  const valid =
    !!result?.clips.length &&
    !result.issues.some((i) => i.severity === "error");
  const commit = async () => {
    if (!result) return;
    setSaving(true);
    try {
      await onCommit(result);
    } catch (e) {
      setSaving(false);
      setError(
        e instanceof Error ? e.message : "Could not save the trip index.",
      );
    }
  };
  return (
    <Dialog
      title={result ? "Folder inspection" : "Import a trip"}
      onClose={close}
      wide={!!result}
    >
      <p className="dialog-intro">
        Choose a recording folder. Videos stay on your device.
      </p>
      <input
        ref={input}
        hidden
        aria-label="Recording folder"
        type="file"
        multiple
        {...{ webkitdirectory: "" }}
        onChange={(e) => {
          const list = e.target.files;
          if (!list?.length) return;
          const files = fromFileList(list);
          const name = list[0].webkitRelativePath.split("/")[0] || "My trip";
          const ac = new AbortController();
          controller.current = ac;
          setError("");
          void inspect(name, files, ac.signal);
          e.target.value = "";
        }}
      />
      {!progress && !result && (
        <>
          <p className="import-hint">
            Video clips of any length, with optional thumbnail images.
          </p>
          <button className="primary full" onClick={() => void pick()}>
            <FolderOpen />
            Choose folder
          </button>
          {"showDirectoryPicker" in window && (
            <details className="import-options">
              <summary>Folder access options</summary>
              <button
                className="text-button"
                onClick={() => input.current?.click()}
              >
                Use compatibility folder picker
              </button>
              <p className="help-text">
                Use this if the folder picker does not work. You'll need to
                select the folder again after reopening the app.
              </p>
            </details>
          )}
        </>
      )}
      {progress && (
        <div className="import-progress" role="status">
          <span className="spinner" />
          <h3>{progress.stage}</h3>
          <p>
            {progress.total
              ? `${progress.done.toLocaleString()} of ${progress.total.toLocaleString()}`
              : "This can take a moment for large folders."}
          </p>
          <progress
            max={progress.total || 1}
            value={progress.total ? progress.done : undefined}
          />
          <button
            onClick={() => {
              controller.current?.abort();
              setProgress(null);
              setError("Import cancelled. Nothing was saved.");
            }}
          >
            Cancel import
          </button>
        </div>
      )}
      {result && (
        <>
          <div className={`validation-summary ${valid ? "valid" : "invalid"}`}>
            {valid ? <Check /> : <AlertTriangle />}
            <div>
              <h3>
                {valid
                  ? "Ready to import"
                  : result.clips.length
                    ? "Strict import rejected"
                    : "No usable recordings found"}
              </h3>
              <p>
                {result.clips.length.toLocaleString()} of{" "}
                {result.totalVideos.toLocaleString()} videos readable ·{" "}
                {formatDuration(
                  result.clips.reduce((n, c) => n + c.duration, 0),
                )}{" "}
                recorded
              </p>
            </div>
          </div>
          {!!result.issues.length && (
            <>
              <p className="help-text">
                {result.issues.length} import notices. Missing previews and
                estimated dates are warnings, not import blockers. Recovery
                excludes damaged or ambiguous videos and keeps the playable
                recordings.
              </p>
              <VirtualList
                items={result.issues}
                height={260}
                rowHeight={78}
                label="Import issues"
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
            </>
          )}
          <div className="dialog-actions">
            <button
              onClick={() => {
                setResult(null);
                setError("");
              }}
            >
              <FolderOpen />
              Choose another folder
            </button>
            <button
              onClick={() =>
                downloadJSON("ride-import-report.json", {
                  name: result.name,
                  totalVideos: result.totalVideos,
                  readable: result.clips.length,
                  issues: result.issues,
                })
              }
            >
              <Download />
              Report
            </button>
            <button
              className="primary"
              disabled={!result.clips.length || saving}
              onClick={() => void commit()}
            >
              {saving
                ? "Saving index…"
                : valid
                  ? "Import trip"
                  : "Recover playable videos"}
              <Upload />
            </button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
    </Dialog>
  );
}
