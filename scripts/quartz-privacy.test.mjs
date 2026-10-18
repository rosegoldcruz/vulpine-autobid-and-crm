import { test } from 'node:test'
import assert from 'node:assert/strict'
import { restrictVaultPublishing, privateVaultView } from '../infra/quartz/privacy.mjs'

test('Quartz preserves existing filters, denies private/draft/unapproved notes and disables attachment copying', () => {
  const previous = { name: 'ExistingRestriction' }
  const config = restrictVaultPublishing({ configuration: { ignorePatterns: ['private'] }, plugins: { filters: [previous], emitters: [{ name: 'Assets' }, { name: 'Static' }] } })
  assert.equal(config.plugins.filters[0], previous)
  assert.ok(config.configuration.ignorePatterns.includes('private'))
  assert.ok(config.configuration.ignorePatterns.includes('.aeon/**'))
  assert.ok(config.configuration.ignorePatterns.includes('sources/aeon-sessions/**'))
  assert.deepEqual(config.plugins.emitters.map(e => e.name), ['Static'])
  const allow = frontmatter => config.plugins.filters.at(-1).shouldPublish({}, [null, { data: { frontmatter } }])
  assert.equal(allow(undefined), false)
  assert.equal(allow({}), false)
  assert.equal(allow({ publish: false }), false)
  assert.equal(allow({ publish: true, private: true }), false)
  assert.equal(allow({ publish: true, private: 'true' }), false)
  assert.equal(allow({ publish: true, draft: true }), false)
  assert.equal(allow({ publish: true }), true)
})


test('private full-vault view requires isolated output and preserves attachment exclusion', () => {
  const config = () => ({configuration: {ignorePatterns: []}, plugins: {filters: [], emitters: [{name: 'Assets'}, {name: 'Static'}]}})
  for (const output of ['/opt/quartz/public', '/var/lib/aeon-quartz-private/releases/../../public', undefined]) {
    assert.throws(() => privateVaultView(config(), output))
  }
  const output = '/var/lib/aeon-quartz-private/releases/test'
  const result = privateVaultView(config(), output)
  assert.equal(result.configuration.analytics, undefined)
  assert.deepEqual(result.plugins.emitters.map(e => e.name), ['Static'])
  assert.equal(result.plugins.filters[0].shouldPublish({argv: {output}}), true)
  assert.throws(() => result.plugins.filters[0].shouldPublish({argv: {output: '/opt/quartz/public'}}))
})
