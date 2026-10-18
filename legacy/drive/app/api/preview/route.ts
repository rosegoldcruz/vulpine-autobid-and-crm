import { NextRequest, NextResponse } from "next/server";
import { logAccess } from "@/lib/access-log";
import { contentDisposition, contentTypeForPath, filenameFromPath, previewKind } from "@/lib/file-meta";
import { requireSession } from "@/lib/require-auth";
import { readFile } from "@/lib/sftp";

export const dynamic = "force-dynamic";

const inlineKinds = new Set(["image", "video", "model", "pdf", "text"]);

export async function GET(request: NextRequest) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const path = request.nextUrl.searchParams.get("path") || "";
  if (!path) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  if (!inlineKinds.has(previewKind(path))) {
    return NextResponse.json({ error: "No inline preview available" }, { status: 415 });
  }

  try {
    const data = await readFile(path);
    await logAccess(path, "view").catch(() => undefined);

    return new NextResponse(new Uint8Array(data), {
      headers: {
        "content-type": contentTypeForPath(path),
        "content-length": String(data.byteLength),
        "content-disposition": contentDisposition("inline", filenameFromPath(path)),
        "cache-control": "private, max-age=60",
        "content-security-policy": "sandbox",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Unable to preview file" }, { status: 500 });
  }
}
