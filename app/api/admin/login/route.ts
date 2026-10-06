import { NextResponse } from "next/server";
import { ADMIN_COOKIE, passwordsMatch, signAdminSession } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD ?? "";
  const url = new URL("/admin", request.url);
  if (!expected || !passwordsMatch(password, expected)) {
    url.searchParams.set("errore", "1");
    return NextResponse.redirect(url, 303);
  }
  const response = NextResponse.redirect(new URL("/admin", request.url), 303);
  response.cookies.set(ADMIN_COOKIE, signAdminSession(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
