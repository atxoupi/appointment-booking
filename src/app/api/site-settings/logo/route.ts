import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/site-settings-service";

export async function GET() {
  const settings = await getSiteSettings();
  if (!settings.logoImage || !settings.logoMimeType) {
    return NextResponse.json({ error: "No hay logo configurado" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(settings.logoImage), {
    headers: {
      "Content-Type": settings.logoMimeType,
      "Cache-Control": "public, max-age=300",
    },
  });
}
