import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfigured, authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const nextAuthHandler = NextAuth(authOptions);

function notConfigured() {
  return new NextResponse(
    "Zitadel authentication is not configured. Set ZITADEL_ISSUER, ZITADEL_CLIENT_ID, NEXTAUTH_SECRET, and NEXTAUTH_URL.",
    {
      status: 503,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    },
  );
}

export function GET(...args: Parameters<typeof nextAuthHandler>) {
  if (!authConfigured()) return notConfigured();
  return nextAuthHandler(...args);
}

export function POST(...args: Parameters<typeof nextAuthHandler>) {
  if (!authConfigured()) return notConfigured();
  return nextAuthHandler(...args);
}
