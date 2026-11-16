export interface SourceFile {
  path: string;
  file: File;
}
export interface FileRecord {
  path: string;
  size: number;
  modified: number;
}
export interface Issue {
  path: string;
  code: string;
  message: string;
  severity: "error" | "warning";
}
export interface Clip {
  id: string;
  stem: string;
  start: number;
  sequence: number;
  duration: number;
  video: FileRecord;
  thumbnail?: FileRecord;
  timeSource?: "filename" | "embedded" | "file-modified";
  channel?: import("./camera").CameraChannel;
  sessionId: string;
}
export interface Candidate extends Omit<Clip, "duration" | "sessionId"> {}
export interface Annotation {
  clipId: string;
  at: number;
  note: string;
  favourite: boolean;
  id: string;
}
export interface Correction {
  sessionId: string;
  offset: number;
}
export interface Resume {
  clipId: string;
  at: number;
  scope: "day" | "trip";
  speed: number;
  volume: number;
  channel?: import("./camera").CameraChannel;
}
export interface Trip {
  id: string;
  name: string;
  created: number;
  updated: number;
  clips: Clip[];
  issues: Issue[];
  annotations: Annotation[];
  corrections: Correction[];
  resume?: Resume;
  handle?: FileSystemDirectoryHandle;
}
export interface IndexedClip extends Clip {
  effectiveStart: number;
}
export interface Session {
  id: string;
  clips: IndexedClip[];
  start: number;
  end: number;
  gap: number;
}
export interface Day {
  key: string;
  clips: IndexedClip[];
  sessions: Session[];
  duration: number;
  start: number;
  end: number;
}
export interface ScanResult {
  candidates: Candidate[];
  issues: Issue[];
  totalVideos: number;
}
export interface ImportResult {
  name: string;
  clips: Clip[];
  issues: Issue[];
  totalVideos: number;
  files: Map<string, File>;
  handle?: FileSystemDirectoryHandle;
}
