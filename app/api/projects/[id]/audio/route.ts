import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { storage } from "@/lib/config";
import { getProject, updateProject } from "@/lib/db";

export const dynamic = "force-dynamic";

const allowed = new Set(["audio/webm", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/m4a"]);

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const project = getProject(params.id);
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  const form = await request.formData();
  const file = form.get("audio");
  if (!(file instanceof File)) return NextResponse.json({ error: "Audio file is required." }, { status: 400 });
  if (file.size > 30 * 1024 * 1024) return NextResponse.json({ error: "Audio file must be under 30MB." }, { status: 400 });
  if (file.type && !allowed.has(file.type)) return NextResponse.json({ error: `Unsupported audio type: ${file.type}` }, { status: 400 });
  fs.mkdirSync(storage.audio, { recursive: true });
  const extension = extensionFor(file.name, file.type);
  const audioPath = path.join(storage.audio, `${params.id}${extension}`);
  fs.writeFileSync(audioPath, Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ project: updateProject(params.id, { audioPath, status: "AUDIO_UPLOADED" }) });
}

function extensionFor(name: string, type: string) {
  const existing = path.extname(name);
  if (existing) return existing;
  if (type.includes("webm")) return ".webm";
  if (type.includes("mpeg")) return ".mp3";
  if (type.includes("mp4") || type.includes("m4a")) return ".m4a";
  return ".wav";
}
