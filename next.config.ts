import os from "node:os";

import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

/** LAN IPs so `next dev` Network URL works (HMR / `/_next/*` origin checks). */
function localNetworkHosts() {
  const hosts = new Set<string>();
  for (const infos of Object.values(os.networkInterfaces())) {
    for (const info of infos ?? []) {
      if (info.family === "IPv4" && !info.internal) {
        hosts.add(info.address);
      }
    }
  }
  return [...hosts];
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: localNetworkHosts(),
  async redirects() {
    return [
      {
        source: "/contact",
        destination: "https://postrack.in/#contact",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
