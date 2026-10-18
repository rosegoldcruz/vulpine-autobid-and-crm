// Credentials and the existing dedicated UID stay in the private runtime config.
// This file is the canonical PM2 deployment entry point.
module.exports = require("/etc/vulpine-apps/vulpine-documents-platform.pm2.json");
