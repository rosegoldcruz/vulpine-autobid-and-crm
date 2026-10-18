import { NextResponse } from "next/server";
import { latestAccessByPath } from "@/lib/access-log";
import { requireSession } from "@/lib/require-auth";
import { listAllItems } from "@/lib/sftp";
import type { RecentDriveItem } from "@/types/files";

export const dynamic = "force-dynamic";

function maxTimestamp(a: string | null, b: string | null) {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

export async function GET() {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  try {
    const items = await listAllItems();
    const accessMap = await latestAccessByPath(items.map((item) => item.path));
    const recentItems: RecentDriveItem[] = items
      .map((item) => {
        const lastAccessedAt = accessMap.get(item.path) ?? null;
        return {
          ...item,
          lastAccessedAt,
          recentAt: maxTimestamp(item.modifiedAt, lastAccessedAt),
        };
      })
      .sort((a, b) => {
        const left = a.recentAt ? new Date(a.recentAt).getTime() : 0;
        const right = b.recentAt ? new Date(b.recentAt).getTime() : 0;
        return right - left;
      });

    return NextResponse.json({
      items: recentItems,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: "Unable to load recent items" }, { status: 500 });
  }
}
