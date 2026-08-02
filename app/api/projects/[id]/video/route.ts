import { NextResponse } from "next/server";
import { getProject } from "@/lib/db";
import { generateVideo } from "@/lib/video";

export const dynamic = "force-dynamic";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const project = getProject(params.id);
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  try {
    await generateVideo(project);
    return NextResponse.json({ project: getProject(params.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Video generation failed.", project: getProject(params.id) }, { status: 500 });
  }
}
