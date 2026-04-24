import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["gym.homelab989.duckdns.org", "coachia.jmlabs.app"],
  devIndicators: false,
};

export default nextConfig;
