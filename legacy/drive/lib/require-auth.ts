import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authConfigured, authOptions } from "@/lib/auth";

export async function requireSession() {
  if (!authConfigured()) {
    return {
      response: NextResponse.json(
        {
          error:
            "Authentication is not configured. Set ZITADEL_ISSUER, ZITADEL_CLIENT_ID, and NEXTAUTH_SECRET.",
        },
        { status: 503 },
      ),
    };
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { session };
}
