/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    "http://192.168.1.10:3000",
    "https://sim.smkassalamsumbebaru.my.id"
  ],
  eslint: {
    ignoreDuringBuilds: true
  }
};

export default nextConfig;
