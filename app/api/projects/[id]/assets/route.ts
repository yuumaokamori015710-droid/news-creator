import { NextResponse } from "next/server";
import { ensureFallbackAssets } from "@/lib/assets";
import { getProject, updateProject } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const project = getProject(params.id);
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  const assets = ensureFallbackAssets(project);
  return NextResponse.json({ assets, project: updateProject(params.id, { status: "ASSETS_COLLECTED" }) });
}
