import { NextRequest, NextResponse } from "next/server";
import { logAccess } from "@/lib/access-log";
import { contentDisposition, contentTypeForPath, filenameFromPath, zipFilenameFromPath } from "@/lib/file-meta";
import { requireSession } from "@/lib/require-auth";
import { readFile, zipDirectory } from "@/lib/sftp";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const path = request.nextUrl.searchParams.get("path") || "";
  if (!path) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  try {
    const type = request.nextUrl.searchParams.get("type");
    const isFolder = type === "folder";
    const data = isFolder ? await zipDirectory(path) : await readFile(path);
    await logAccess(path, "view").catch(() => undefined);

    return new NextResponse(new Uint8Array(data), {
      headers: {
        "content-type": isFolder ? "application/zip" : contentTypeForPath(path),
        "content-length": String(data.byteLength),
        "content-disposition": contentDisposition("attachment", isFolder ? zipFilenameFromPath(path) : filenameFromPath(path)),
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Unable to download file" }, { status: 500 });
  }
}
