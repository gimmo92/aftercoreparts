import { NextResponse } from "next/server";
import { getClientIp, hashIp } from "@/lib/format";
import { getQuota } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const quota = await getQuota(hashIp(getClientIp(request)));
    return NextResponse.json(quota);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Servizio non disponibile. Riprova tra poco.", code: "unavailable" },
      { status: 500 },
    );
  }
}
