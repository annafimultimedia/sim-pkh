import type { MetadataRoute } from "next";
import { getAppName } from "@/lib/data";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const appName = await getAppName();
  return {
    name: appName,
    short_name: "SIM-PKH",
    description: "Sistem Informasi Manajemen PKH",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#087f5b",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-1024.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icon-1024.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
