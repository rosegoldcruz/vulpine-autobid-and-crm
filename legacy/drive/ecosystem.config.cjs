module.exports = {
  apps: [
    {
      name: "vulpine-drive",
      cwd: "/opt/vulpine-drive",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: "3014",
      },
    },
  ],
};
