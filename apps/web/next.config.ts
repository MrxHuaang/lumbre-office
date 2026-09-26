import type { NextConfig } from "next";

// Las variables vienen del .env de la raíz del monorepo: los scripts arrancan Next con
// `node --env-file-if-exists=../../.env` (ver package.json).
const nextConfig: NextConfig = {
  transpilePackages: ["@hyvento/shared", "@hyvento/map", "@hyvento/db"],
  reactStrictMode: true,
  // Permite probar una segunda persona en http://127.0.0.1:3000 (otro jar de cookies).
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
