/**
 * session-identity.ts
 * Generates and persists a Nexus keypair for each Vibecraft session.
 * Stored at ~/.vibecraft/identities/<sessionId>.json
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { generateIdentity, restoreIdentity, NexusIdentity } from '../nexus-protocol/nexus.js';

const IDENTITIES_DIR = path.join(os.homedir(), '.vibecraft', 'identities');

interface StoredIdentity {
  did: string;
  privateKeyHex: string;
  createdAt: number;
  sessionId: string;
}

function ensureDir() {
  fs.mkdirSync(IDENTITIES_DIR, { recursive: true, mode: 0o700 }); // owner-only
}

function identityPath(sessionId: string): string {
  // Sanitize sessionId to safe filename
  const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(IDENTITIES_DIR, `${safe}.json`);
}

export async function getOrCreateIdentity(sessionId: string): Promise<NexusIdentity> {
  ensureDir();
  const filepath = identityPath(sessionId);

  if (fs.existsSync(filepath)) {
    const stored: StoredIdentity = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    const identity = await restoreIdentity(stored.privateKeyHex);
    console.log(`[identity] Loaded existing identity for "${sessionId}": ${identity.did}`);
    return identity;
  }

  // Generate new
  const identity = await generateIdentity();
  const stored: StoredIdentity = {
    did: identity.did,
    privateKeyHex: Buffer.from(identity.privateKey).toString('hex'),
    createdAt: Date.now(),
    sessionId,
  };

  fs.writeFileSync(filepath, JSON.stringify(stored, null, 2), { mode: 0o600 }); // owner read/write only
  console.log(`[identity] ✨ New identity for "${sessionId}": ${identity.did}`);
  console.log(`[identity] Saved to: ${filepath}`);
  return identity;
}

export function listIdentities(): Record<string, string> {
  ensureDir();
  const result: Record<string, string> = {};
  try {
    for (const file of fs.readdirSync(IDENTITIES_DIR)) {
      if (!file.endsWith('.json')) continue;
      const data: StoredIdentity = JSON.parse(
        fs.readFileSync(path.join(IDENTITIES_DIR, file), 'utf-8')
      );
      result[data.sessionId] = data.did;
    }
  } catch { /* empty dir is fine */ }
  return result;
}

export function deleteIdentity(sessionId: string): void {
  const filepath = identityPath(sessionId);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
    console.log(`[identity] Deleted identity for "${sessionId}"`);
  }
}

// CLI: npx tsx agents/session-identity.ts list
// CLI: npx tsx agents/session-identity.ts create <sessionId>
if (process.argv[1]?.endsWith('session-identity.ts') || process.argv[1]?.endsWith('session-identity.js')) {
  const [,, cmd, sessionId] = process.argv;
  if (cmd === 'list') {
    const ids = listIdentities();
    console.log('\n📋 Known identities:');
    for (const [sid, did] of Object.entries(ids)) {
      console.log(`  ${sid.padEnd(20)} ${did}`);
    }
  } else if (cmd === 'create' && sessionId) {
    getOrCreateIdentity(sessionId).then(() => process.exit(0));
  } else {
    console.log('Usage: npx tsx agents/session-identity.ts list');
    console.log('       npx tsx agents/session-identity.ts create <sessionId>');
  }
}
