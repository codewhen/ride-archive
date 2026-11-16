import { useEffect, useState } from "react";
import { library } from "../core/files";
import type { Clip } from "../core/types";
import { FileVideo } from "./Icons";
export function Thumbnail({
  clip,
  connection,
}: {
  clip: Clip;
  connection: number;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let live = true;
    let allocated = "";
    setUrl("");
    if (clip.thumbnail)
      library
        .read(clip.thumbnail)
        .then((file) => {
          if (live) {
            allocated = URL.createObjectURL(file);
            setUrl(allocated);
          }
        })
        .catch(() => {});
    return () => {
      live = false;
      if (allocated) URL.revokeObjectURL(allocated);
    };
  }, [clip.thumbnail?.path, connection]);
  return url ? (
    <img src={url} alt="" loading="lazy" onError={() => setUrl("")} />
  ) : (
    <span className="thumbnail-placeholder">
      <FileVideo />
      <span>No preview</span>
    </span>
  );
}
