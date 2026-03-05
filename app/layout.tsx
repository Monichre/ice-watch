import type { Metadata } from "next";
import Link from "next/link";
import { ReactNode } from "react";
import { ConvexAppProvider } from "@/lib/convex-client";
import "./globals.css";

export const metadata: Metadata = {
  title: "ICE Watch",
  description: "Realtime vehicle tracking with Convex, geolocation, AI, and RAG.",
};

const NAV_LINKS = [
  { href: "/", label: "Map" },
  { href: "/sightings", label: "Sightings" },
  { href: "/camera", label: "Camera" },
  { href: "/submit", label: "Submit" },
  { href: "/widget", label: "Widget" },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ConvexAppProvider>
          <main className="shell">
            <nav className="topnav">
              <strong style={{ fontSize: 14, marginRight: 6 }}>ICE WATCH</strong>
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </nav>
            {children}
          </main>
        </ConvexAppProvider>
      </body>
    </html>
  );
}
