import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Authenticated project integration is not configured.", code: "AUTH_NOT_CONFIGURED" },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
