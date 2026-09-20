import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const name = formData.get("name") as string;

  const res = await fetch("http://127.0.0.1:8000/api/v1/auto-bid/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }

  const project = await res.json();
  return NextResponse.redirect(new URL(`/projects/${project.id}`, req.url), { status: 302 });
}