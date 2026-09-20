import path from "node:path"

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  turbopack: {
    root: path.resolve(process.cwd(), "../.."),
  },
  transpilePackages: [
    "@vulpine/auth",
    "@vulpine/config",
    "@vulpine/contracts",
    "@vulpine/permissions",
    "@vulpine/sdk",
  ],
  images: {
    unoptimized: true,
  },
}

export default nextConfig
