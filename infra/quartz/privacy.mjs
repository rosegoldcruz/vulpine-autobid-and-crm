import path from 'node:path'
// Apply after Quartz has loaded its existing configuration. No access or auth
// settings are changed. Attachments require a separate approved publication flow.
export function restrictVaultPublishing(config) {
  config.configuration.ignorePatterns = [...new Set([
    ...config.configuration.ignorePatterns,
    '.aeon/**', 'raw/**', 'inbox/**', 'sources/aeon-sessions/**',
    '**/.env*', '**/*.json',
  ])]
  config.plugins.filters.push({
    name: 'AEONExplicitPrivateVaultPolicy',
    shouldPublish(_ctx, [_tree, file]) {
      const fm = file.data?.frontmatter
      return (fm?.publish === true || fm?.publish === 'true') &&
        fm?.private !== true && fm?.private !== 'true' &&
        fm?.draft !== true && fm?.draft !== 'true'
    },
  })
  // Quartz's built-in Assets emitter copies non-Markdown vault files regardless
  // of page publication flags. Disable it to avoid exposing PDFs or attachments.
  config.plugins.emitters = config.plugins.emitters.filter(e => e.name !== 'Assets')
  return config
}

// Owner-approved full-vault view. Output is private and separate from public
// Quartz builds; the build wrapper verifies the existing Nginx login gate.
export function privateVaultView(config, output) {
  if (typeof output !== 'string' || !path.resolve(output).startsWith('/var/lib/aeon-quartz-private/releases/')) throw new Error('Private vault output must stay outside public build directories')
  config.configuration.pageTitle = 'AEON Vault'
  config.configuration.baseUrl = 'brain.vulpine.llc'
  config.configuration.analytics = undefined
  config.configuration.ignorePatterns = ['**/.*', '**/.*/**', '**/.env*', '**/*.json', '**/*.db', '**/*.sqlite*']
  config.plugins.filters = [{
    name: 'AEONAuthenticatedPrivateView',
    shouldPublish(ctx) {
      if (ctx.argv.output !== output) throw new Error('Private vault output does not match the approved directory')
      return true
    },
  }]
  config.plugins.emitters = config.plugins.emitters.filter(e => e.name !== 'Assets')
  return config
}
