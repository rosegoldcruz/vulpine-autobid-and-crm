import { test } from 'node:test'
import assert from 'node:assert/strict'
import { restrictVaultPublishing } from '../infra/quartz/privacy.mjs'

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
