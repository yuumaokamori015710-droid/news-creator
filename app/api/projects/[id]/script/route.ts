import { NextResponse } from "next/server";
import { z } from "zod";
import { getProject, updateProject } from "@/lib/db";
import { generateScript, type ScriptTone } from "@/lib/script";

export const dynamic = "force-dynamic";

const schema = z.object({
  tone: z.enum(["simple", "natural", "shorter", "impact", "objective"]).default("simple")
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const project = getProject(params.id);
  if (!project?.news) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  const generated = generateScript(project.news, (parsed.success ? parsed.data.tone : "simple") as ScriptTone);
  return NextResponse.json({
    project: updateProject(params.id, { ...generated, status: "SCRIPT_GENERATED" })
  });
}
