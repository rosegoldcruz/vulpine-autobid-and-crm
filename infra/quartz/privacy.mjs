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
