import { fileURLToPath } from "node:url";
export default {
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), geolocation=(self), microphone=()",
          },
        ],
      },
    ];
  },
};
