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
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Content-Security-Policy', value: "base-uri 'self'; object-src 'none'; frame-ancestors 'self'" },
      ],
    }]
  },
}

export default nextConfig
