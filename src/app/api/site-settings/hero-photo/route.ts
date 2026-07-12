import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/site-settings-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSiteSettings();
  if (!settings.heroImage || !settings.heroMimeType) {
    return NextResponse.json({ error: "No hay foto de portada configurada" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(settings.heroImage), {
    headers: {
      "Content-Type": settings.heroMimeType,
      "Cache-Control": "no-cache",
    },
  });
}
