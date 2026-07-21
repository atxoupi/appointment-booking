-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "ctaBackgroundColor" TEXT NOT NULL DEFAULT '#0f172a',
ADD COLUMN     "ctaTextColor" TEXT NOT NULL DEFAULT '#ffffff',
ADD COLUMN     "menuTextColor" TEXT NOT NULL DEFAULT '#ffffff',
ADD COLUMN     "textColor" TEXT NOT NULL DEFAULT '#0f172a';
