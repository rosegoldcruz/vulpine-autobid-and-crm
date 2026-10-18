import { NextRequest, NextResponse } from "next/server";
import { joinRemotePath } from "@/lib/path";
import { requireSession } from "@/lib/require-auth";
import { writeFile } from "@/lib/sftp";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  try {
    const formData = await request.formData();
    const path = typeof formData.get("path") === "string" ? String(formData.get("path")) : "/";
    const files = formData.getAll("files").filter((value): value is File => value instanceof File);

    if (!files.length) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    for (const file of files) {
      const bytes = Buffer.from(await file.arrayBuffer());
      await writeFile(joinRemotePath(path, file.name), bytes);
    }

    return NextResponse.json({ ok: true, uploaded: files.length });
  } catch (error) {
    return NextResponse.json({ error: "Unable to upload file" }, { status: 500 });
  }
}
