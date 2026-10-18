import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-auth";
import { listDirectory } from "@/lib/sftp";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const path = request.nextUrl.searchParams.get("path") || "/";

  try {
    const listing = await listDirectory(path);
    return NextResponse.json(listing);
  } catch (error) {
    return NextResponse.json({ error: "Unable to read Storage Box" }, { status: 500 });
  }
}
