import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSiteSettings, updateSiteSettings, type SiteSettingsData } from "@/lib/site-settings-service";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];

function toResponseShape(settings: SiteSettingsData) {
  return {
    businessName: settings.businessName,
    tagline: settings.tagline,
    backgroundColor: settings.backgroundColor,
    menuColor: settings.menuColor,
    menuTextColor: settings.menuTextColor,
    textColor: settings.textColor,
    ctaBackgroundColor: settings.ctaBackgroundColor,
    ctaTextColor: settings.ctaTextColor,
    hasLogo: settings.logoImage !== null,
    hasHeroPhoto: settings.heroImage !== null,
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const settings = await getSiteSettings();
  return NextResponse.json(toResponseShape(settings));
}

async function readImageField(formData: FormData, field: string) {
  const file = formData.get(field);
  if (!(file instanceof File) || file.size === 0) return undefined;
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("IMAGE_TOO_LARGE");
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error("IMAGE_TYPE_NOT_ALLOWED");
  }
  return { buffer: Buffer.from(await file.arrayBuffer()), mimeType: file.type };
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const formData = await request.formData();

  let logo, heroPhoto;
  try {
    logo = await readImageField(formData, "logo");
    heroPhoto = await readImageField(formData, "heroPhoto");
  } catch (err) {
    const message =
      err instanceof Error && err.message === "IMAGE_TOO_LARGE"
        ? "La imagen supera el tamaño máximo de 2MB"
        : "Formato de imagen no permitido (usa PNG, JPEG o WEBP)";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const businessName = formData.get("businessName");
  const tagline = formData.get("tagline");
  const backgroundColor = formData.get("backgroundColor");
  const menuColor = formData.get("menuColor");
  const menuTextColor = formData.get("menuTextColor");
  const textColor = formData.get("textColor");
  const ctaBackgroundColor = formData.get("ctaBackgroundColor");
  const ctaTextColor = formData.get("ctaTextColor");

  const updated = await updateSiteSettings({
    ...(typeof businessName === "string" ? { businessName } : {}),
    ...(typeof tagline === "string" ? { tagline } : {}),
    ...(typeof backgroundColor === "string" ? { backgroundColor } : {}),
    ...(typeof menuColor === "string" ? { menuColor } : {}),
    ...(typeof menuTextColor === "string" ? { menuTextColor } : {}),
    ...(typeof textColor === "string" ? { textColor } : {}),
    ...(typeof ctaBackgroundColor === "string" ? { ctaBackgroundColor } : {}),
    ...(typeof ctaTextColor === "string" ? { ctaTextColor } : {}),
    ...(logo ? { logoImage: logo.buffer, logoMimeType: logo.mimeType } : {}),
    ...(heroPhoto ? { heroImage: heroPhoto.buffer, heroMimeType: heroPhoto.mimeType } : {}),
  });

  return NextResponse.json(toResponseShape(updated));
}
