import { NextRequest, NextResponse } from "next/server";
import { logAccess, type AccessAction } from "@/lib/access-log";
import { requireSession } from "@/lib/require-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  try {
    const body = await request.json();
    const path = typeof body.path === "string" ? body.path : "";
    const action = body.action === "modify" ? "modify" : "view";
    if (!path) {
      return NextResponse.json({ error: "Missing path" }, { status: 400 });
    }

    await logAccess(path, action as AccessAction);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Unable to log access" }, { status: 500 });
  }
}
