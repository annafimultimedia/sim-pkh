import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SIM-PKH Kabupaten",
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
        src: "/icon.svg",
        sizes: "64x64",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ]
  };
}
