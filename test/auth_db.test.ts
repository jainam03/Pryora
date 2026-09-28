/**
 * PRYORA Automated Test Suite: Auth, Password Hashing & Data Isolation
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../server/auth.js';

describe('PRYORA Security & Authentication', () => {
  test('Password hashing produces unique salts and verifies correctly', () => {
    const pwd = 'StrongSecretPassword123!';
    const creds1 = hashPassword(pwd);
    const creds2 = hashPassword(pwd);

    // Different salts for identical passwords
    assert.notEqual(creds1.salt, creds2.salt);
    assert.notEqual(creds1.hash, creds2.hash);

    // Correct verification
    assert.equal(verifyPassword(pwd, creds1.salt, creds1.hash), true);
    assert.equal(verifyPassword(pwd, creds2.salt, creds2.hash), true);

    // Wrong password fails
    assert.equal(verifyPassword('WrongPassword', creds1.salt, creds1.hash), false);
  });
});
