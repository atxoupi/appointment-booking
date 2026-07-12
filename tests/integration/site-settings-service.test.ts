import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb, resetDatabase } from "./setup";
import { getSiteSettings, updateSiteSettings } from "@/lib/site-settings-service";

describe("site-settings-service", () => {
  beforeEach(resetDatabase);
  afterAll(() => testDb.$disconnect());

  it("returns defaults when no settings row exists yet", async () => {
    const settings = await getSiteSettings(testDb);

    expect(settings.businessName).toBe("Mi Negocio");
    expect(settings.backgroundColor).toBe("#ffffff");
    expect(settings.menuColor).toBe("#171717");
    expect(settings.logoImage).toBeNull();
    expect(settings.heroImage).toBeNull();
  });

  it("creates the singleton row on first update", async () => {
    const updated = await updateSiteSettings(
      { businessName: "Peluquería Ana", menuColor: "#222222" },
      testDb
    );

    expect(updated.businessName).toBe("Peluquería Ana");
    expect(updated.menuColor).toBe("#222222");

    const fetched = await getSiteSettings(testDb);
    expect(fetched.businessName).toBe("Peluquería Ana");
  });

  it("stores and returns uploaded image bytes and mime type", async () => {
    const fakeImage = Buffer.from([137, 80, 78, 71]);

    const updated = await updateSiteSettings(
      { logoImage: fakeImage, logoMimeType: "image/png" },
      testDb
    );

    expect(updated.logoImage).toEqual(fakeImage);
    expect(updated.logoMimeType).toBe("image/png");
  });

  it("updates only the fields provided, leaving others unchanged", async () => {
    await updateSiteSettings(
      { businessName: "Peluquería Ana", tagline: "Cortes desde 1990" },
      testDb
    );

    const updated = await updateSiteSettings({ tagline: "Nueva frase" }, testDb);

    expect(updated.businessName).toBe("Peluquería Ana");
    expect(updated.tagline).toBe("Nueva frase");
  });

  it("leaves a previously uploaded image untouched when updating only text fields", async () => {
    const fakeImage = Buffer.from([137, 80, 78, 71]);
    await updateSiteSettings({ logoImage: fakeImage, logoMimeType: "image/png" }, testDb);

    const updated = await updateSiteSettings({ businessName: "Nuevo Nombre" }, testDb);

    expect(updated.businessName).toBe("Nuevo Nombre");
    expect(updated.logoImage).toEqual(fakeImage);
    expect(updated.logoMimeType).toBe("image/png");
  });
});
