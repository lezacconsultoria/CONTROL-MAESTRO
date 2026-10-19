import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  // Los posts suben videos de hasta 50 MB (y carruseles de varios archivos) por server action.
  // proxy.ts también copia el cuerpo en memoria y por defecto corta a los 10 MB.
  experimental: { serverActions: { bodySizeLimit: "200mb" }, proxyClientMaxBodySize: "200mb" },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
