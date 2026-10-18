import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { sftpHostVerifier } from '../lib/sftp-host-key';

test('legacy Drive rejects missing and mismatched SFTP host pins', () => {
  assert.throws(() => sftpHostVerifier(''), /SFTP_HOST_KEY_SHA256/);
  const publicKey = Buffer.from('test-only public host key');
  const pin = `SHA256:${createHash('sha256').update(publicKey).digest('base64').replace(/=+$/, '')}`;
  const verify = sftpHostVerifier(pin);
  assert.equal(verify(publicKey), true);
  assert.equal(verify(Buffer.from('another public host key')), false);
});
