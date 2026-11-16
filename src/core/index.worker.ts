import { scanFiles } from "./indexer";
import type { SourceFile } from "./types";
self.onmessage = async (event: MessageEvent<SourceFile[]>) => {
  try {
    const result = await scanFiles(event.data, (done, total) => {
      if (done % 10 === 0 || done === total)
        self.postMessage({ type: "progress", done, total });
    });
    self.postMessage({ type: "result", result });
  } catch (e) {
    self.postMessage({
      type: "error",
      message: e instanceof Error ? e.message : "Cannot inspect folder.",
    });
  }
};
