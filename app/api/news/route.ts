import { NextResponse } from "next/server";
import { listNews, refreshNews } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ news: listNews() });
}

export async function POST() {
  return NextResponse.json({ news: await refreshNews(), refreshedAt: new Date().toISOString() });
}
