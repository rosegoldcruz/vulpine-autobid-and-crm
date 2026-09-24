module.exports = {
  apps: [
    {
      name: "vulpine-documents",
      cwd: "/opt/vulpine-platform",
      script: "./node_modules/.bin/tsx",
      args: "services/documents/src/server.ts",
      interpreter: "none",
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      env: {
        NODE_ENV: "production",
        DOCUMENTS_HOST: "127.0.0.1",
        DOCUMENTS_PORT: "3016",
      },
    },
  ],
}
