import { NextResponse } from "next/server";
import { z } from "zod";
import { createProject, listProjects } from "@/lib/db";

export const dynamic = "force-dynamic";

const createProjectSchema = z.object({ newsId: z.string().min(1) });

export async function GET() {
  return NextResponse.json({ projects: listProjects() });
}

export async function POST(request: Request) {
  const parsed = createProjectSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid news selection." }, { status: 400 });
  return NextResponse.json({ project: createProject(parsed.data.newsId) });
}
