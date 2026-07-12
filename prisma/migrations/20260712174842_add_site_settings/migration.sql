-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL DEFAULT 'Mi Negocio',
    "tagline" TEXT NOT NULL DEFAULT '',
    "backgroundColor" TEXT NOT NULL DEFAULT '#ffffff',
    "menuColor" TEXT NOT NULL DEFAULT '#171717',
    "logoImage" BYTEA,
    "logoMimeType" TEXT,
    "heroImage" BYTEA,
    "heroMimeType" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);
