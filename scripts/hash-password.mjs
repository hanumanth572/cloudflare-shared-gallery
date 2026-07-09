#!/usr/bin/env node
/**
 * Prints a GALLERY_PASSWORD_HASH string for the given password:
 *
 *   npm run hash-password -- "your shared password"
 *   # or: node scripts/hash-password.mjs "your shared password"
 *
 * Paste the output into: wrangler secret put GALLERY_PASSWORD_HASH
 *
 * Format: pbkdf2$<iterations>$<saltB64>$<hashB64> (PBKDF2-SHA256).
 * 100,000 iterations is the maximum the Workers runtime supports for
 * WebCrypto PBKDF2, so the verifier can never exceed it.
 */
import { pbkdf2Sync, randomBytes } from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-password.mjs "<password>"');
  process.exit(1);
}

const iterations = 100_000;
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256");

console.log(`pbkdf2$${iterations}$${salt.toString("base64")}$${hash.toString("base64")}`);
