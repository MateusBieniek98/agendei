import { NextResponse } from "next/server";
import { getLoginSettings } from "@/lib/app-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const settings = await getLoginSettings();
  return NextResponse.json({ settings });
}

export async function PATCH() {
  return NextResponse.json(
    { error: "A identidade global do produto e gerenciada pela plataforma." },
    { status: 403 }
  );
}
