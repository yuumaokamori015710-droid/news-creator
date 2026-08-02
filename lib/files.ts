import path from "node:path";
import { storageDir } from "./config";

export function toMediaUrl(filePath: string | null | undefined) {
  if (!filePath) return null;
  const relative = path.relative(storageDir, filePath).replace(/\\/g, "/");
  return relative.startsWith("..") ? null : `/api/media/${relative}`;
}
