import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  // Experimental Option D: self-hosted pybricks-code under /pybricks.
  // Official code.pybricks.com sets X-Frame-Options: SAMEORIGIN via CDN;
  // our static export must NOT set XFO. COOP/COEP match upstream serve.py
  // so Pyodide / SharedArrayBuffer keep working.
  async headers() {
    return [
      {
        source: "/pybricks/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          // Explicitly allow framing by same-origin parent (and omit XFO).
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
