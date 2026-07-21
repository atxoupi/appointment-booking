import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSiteSettings } from "@/lib/site-settings-service";

export default async function Home() {
  const session = await getServerSession(authOptions);
  const settings = await getSiteSettings();

  const cta =
    session?.user.role === "CLIENT"
      ? { href: "/book", label: "Reservar cita" }
      : { href: "/login", label: "Iniciar sesión" };

  return (
    <main
      className="flex min-h-[calc(100vh-56px)] items-center justify-center bg-slate-100 bg-cover bg-center px-4 text-center"
      style={settings.heroImage ? { backgroundImage: "url(/api/site-settings/hero-photo)" } : undefined}
    >
      <div className="rounded-lg bg-white/85 px-8 py-10 backdrop-blur-sm">
        <h1 className="text-3xl font-semibold" style={{ color: settings.textColor }}>{settings.businessName}</h1>
        {settings.tagline && (
          <p className="mt-2 text-lg" style={{ color: settings.textColor }}>
            {settings.tagline}
          </p>
        )}
        <Link
          href={cta.href}
          className="mt-6 inline-block rounded-md px-6 py-3 text-sm font-medium hover:opacity-90"
          style={{ backgroundColor: settings.ctaBackgroundColor, color: settings.ctaTextColor }}
        >
          {cta.label}
        </Link>
      </div>
    </main>
  );
}
