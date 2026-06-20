import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIM-PKH",
  description: "Sistem Informasi Manajemen PKH",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "SIM-PKH",
    statusBarStyle: "default"
  },
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/icon-1024.png"
  }
};

export const viewport: Viewport = {
  themeColor: "#087f5b"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
