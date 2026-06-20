import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  distDir: process.env.NEXT_DIST_DIR || (process.env.NODE_ENV === "development" ? ".next-dev" : ".next"),
  allowedDevOrigins: [
    "http://192.168.1.10:3000",
    "https://sim.smkassalamsumbebaru.my.id"
  ],
  eslint: {
    ignoreDuringBuilds: true
  },
  experimental: {
    cpus: 1,
    webpackBuildWorker: false
  },
  webpack(config) {
    config.resolve.alias["@"] = path.resolve(process.cwd());
    return config;
  }
};

export default nextConfig;
