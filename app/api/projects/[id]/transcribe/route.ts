import { NextResponse } from "next/server";
import { getProject, updateProject } from "@/lib/db";
import { estimateDuration, makeSubtitleCues, saveSubtitles } from "@/lib/subtitles";

export const dynamic = "force-dynamic";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const project = getProject(params.id);
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  if (!project.audioPath) return NextResponse.json({ error: "Upload or record audio first." }, { status: 400 });
  const transcription = project.scriptEn || "No script was available. Please edit the transcript before publishing.";
  const duration = project.estimatedDuration || estimateDuration(transcription);
  const cues = makeSubtitleCues(transcription, duration);
  const { assPath, srtPath } = saveSubtitles(params.id, cues);
  return NextResponse.json({
    cues,
    srtPath,
    project: updateProject(params.id, {
      transcription,
      subtitlePath: assPath,
      status: "TRANSCRIBED"
    })
  });
}
