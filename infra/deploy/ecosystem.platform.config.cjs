// Private configs contain credentials and account IDs; never commit their values.
// Their cwd/script paths are validated by scripts/verify-consolidation.py.
const paths = ["vulpine-ai", "vulpine-bids-tracker", "vulpine-vision", "vulpine-documents-platform"];
module.exports = { apps: paths.flatMap(name => require(`/etc/vulpine-apps/${name}.pm2.json`).apps) };
