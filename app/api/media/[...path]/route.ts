import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { storageDir } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { path: string[] } }) {
  const requested = path.join(storageDir, ...params.path);
  const resolved = path.resolve(requested);
  if (!resolved.startsWith(path.resolve(storageDir))) {
    return NextResponse.json({ error: "Invalid media path." }, { status: 400 });
  }
  if (!fs.existsSync(resolved)) return NextResponse.json({ error: "File not found." }, { status: 404 });
  const data = fs.readFileSync(resolved);
  return new NextResponse(data, {
    headers: {
      "content-type": contentType(resolved),
      "content-disposition": `inline; filename="${path.basename(resolved)}"`
    }
  });
}

function contentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".webm") return "audio/webm";
  if (ext === ".srt") return "text/plain; charset=utf-8";
  if (ext === ".ass") return "text/plain; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}
