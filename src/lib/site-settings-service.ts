import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";

const SINGLETON_ID = "singleton";

export interface SiteSettingsData {
  businessName: string;
  tagline: string;
  backgroundColor: string;
  menuColor: string;
  logoImage: Buffer | null;
  logoMimeType: string | null;
  heroImage: Buffer | null;
  heroMimeType: string | null;
}

const DEFAULTS: SiteSettingsData = {
  businessName: "Mi Negocio",
  tagline: "",
  backgroundColor: "#ffffff",
  menuColor: "#171717",
  logoImage: null,
  logoMimeType: null,
  heroImage: null,
  heroMimeType: null,
};

function toBuffer(value: Uint8Array | null): Buffer | null {
  return value ? Buffer.from(value) : null;
}

function toBytes(value: Buffer | null | undefined): Uint8Array<ArrayBuffer> | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  const bytes = new Uint8Array(value.length);
  bytes.set(value);
  return bytes;
}

export async function getSiteSettings(
  db: PrismaClient = defaultPrisma
): Promise<SiteSettingsData> {
  const row = await db.siteSettings.findUnique({ where: { id: SINGLETON_ID } });
  if (!row) return DEFAULTS;
  return { ...row, logoImage: toBuffer(row.logoImage), heroImage: toBuffer(row.heroImage) };
}

export async function updateSiteSettings(
  input: Partial<SiteSettingsData>,
  db: PrismaClient = defaultPrisma
): Promise<SiteSettingsData> {
  const data = { ...input, logoImage: toBytes(input.logoImage), heroImage: toBytes(input.heroImage) };
  const row = await db.siteSettings.upsert({
    where: { id: SINGLETON_ID },
    update: data,
    create: { id: SINGLETON_ID, ...DEFAULTS, ...data },
  });
  return { ...row, logoImage: toBuffer(row.logoImage), heroImage: toBuffer(row.heroImage) };
}
