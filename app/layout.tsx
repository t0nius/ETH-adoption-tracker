import type { Metadata } from "next";
import { Syne, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "ETH Adoption Tracker",
  description: "On-chain & institutional adoption fundamentals for Ethereum",
};

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "700", "800"],
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-[#0a0a0a]">
      <body
        className={`${syne.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable} min-h-screen bg-app text-ink antialiased`}
        style={{ backgroundColor: "#0a0a0a", color: "#ededed" }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
