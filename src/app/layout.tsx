import type { Metadata } from "next";
import localFont from "next/font/local";
import { getServerSession } from "next-auth";
import "./globals.css";
import { Providers } from "./providers";
import { Nav } from "./components/Nav";
import { authOptions } from "@/lib/auth";
import { getSiteSettings } from "@/lib/site-settings-service";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Reserva de citas",
  description: "Sistema de reserva de citas",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  const settings = await getSiteSettings();

  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen`}
        style={{ backgroundColor: settings.backgroundColor }}
      >
        <Providers>
          <Nav
            role={session?.user.role}
            settings={{
              businessName: settings.businessName,
              menuColor: settings.menuColor,
              menuTextColor: settings.menuTextColor,
              hasLogo: settings.logoImage !== null,
            }}
          />
          {children}
        </Providers>
      </body>
    </html>
  );
}
