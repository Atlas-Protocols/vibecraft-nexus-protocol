/**
 * NEXUS PROTOCOL — Reference Implementation
 * Version: 0.1.0
 * License: MIT (implementation) / CC0 (spec)
 *
 * This is the canonical TypeScript implementation of the Nexus Protocol.
 * It is intentionally minimal — the full spec in ~300 lines of code.
 *
 * Dependencies: @noble/ed25519 (audited, zero-dependency crypto)
 */

import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import { randomBytes } from '@noble/hashes/utils';

// Noble requires sha512 for ed25519
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

// ─── Types ────────────────────────────────────────────────────────────────────

export const NEXUS_VERSION = '0.1';

export type MessageType = 'ANNOUNCE' | 'TASK' | 'RESULT' | 'CONTEXT' | 'HEARTBEAT';
export type TrustLevel = 0 | 1 | 2 | 3;
export type AgentStatus = 'idle' | 'working' | 'waiting' | 'error';

export interface NexusMessage {
  nexus: string;
  id: string;
  type: MessageType;
  from: string;      // DID
  to: string;        // DID or '*'
  payload: unknown;
  timestamp: number;
  ttl?: number;
  sig: string;       // base64url Ed25519 over canonical JSON
}

export interface AnnouncePayload {
  name: string;
  version: string;
  capabilities: string[];
  role: string;
  trustLevel: TrustLevel;
  endpoint?: string;
  context?: string[];
}

export interface TaskPayload {
  title: string;
  description: string;
  requiredCapabilities?: string[];
  context?: string[];
  artifacts?: string[];
  constraints?: string[];
  outputFormat?: string;
  deadline?: number;
  workingDir?: string;  // repo/directory for the coder to work in (e.g. ~/first-friday-bakersfield)
  branch?: string;      // git branch to commit to (e.g. nexus/bob/feature-name)
}

export interface ResultPayload {
  success: boolean;
  output: unknown;
  filesChanged?: string[];
  contextAnnotations?: ContextAnnotation[];
  error?: string | null;
}

export interface ContextAnnotation {
  key: string;
  note: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ContextPayload {
  key: string;
  content: string;
  source: string;
  contentType?: string;
  version?: number;
  annotations?: string[];
  vote?: 'up' | 'down';
}

export interface HeartbeatPayload {
  status: AgentStatus;
  load?: number;
  uptime?: number;
}

export interface NexusIdentity {
  did: string;
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

// ─── Identity ─────────────────────────────────────────────────────────────────

/**
 * Generate a new Nexus identity.
 * Returns a DID (did:key) and keypair.
 * The DID is derived from the public key — no registration needed.
 */
export async function generateIdentity(): Promise<NexusIdentity> {
  const privateKey = randomBytes(32);
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  const did = pubkeyToDid(publicKey);
  return { did, privateKey, publicKey };
}

/**
 * Restore identity from a saved private key (hex string).
 */
export async function restoreIdentity(privateKeyHex: string): Promise<NexusIdentity> {
  const privateKey = hexToBytes(privateKeyHex);
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  const did = pubkeyToDid(publicKey);
  return { did, privateKey, publicKey };
}

// Simple did:key encoding (multicodec ed25519-pub = 0xed01)
function pubkeyToDid(pubkey: Uint8Array): string {
  const prefix = new Uint8Array([0xed, 0x01]);
  const multicodec = new Uint8Array(prefix.length + pubkey.length);
  multicodec.set(prefix);
  multicodec.set(pubkey, prefix.length);
  return `did:key:z${base58Encode(multicodec)}`;
}

function didToPublicKey(did: string): Uint8Array {
  if (!did.startsWith('did:key:z')) throw new Error(`Invalid did:key: ${did}`);
  const decoded = base58Decode(did.slice('did:key:z'.length));
  return decoded.slice(2); // strip 0xed01 multicodec prefix
}

// ─── Signing & Verification ───────────────────────────────────────────────────

/**
 * Create and sign a Nexus message.
 */
export async function createMessage(
  identity: NexusIdentity,
  to: string,
  type: MessageType,
  payload: unknown,
  options: { id?: string; ttl?: number; replyTo?: string } = {}
): Promise<NexusMessage> {
  const msg: Omit<NexusMessage, 'sig'> = {
    nexus: NEXUS_VERSION,
    id: options.id ?? uuid(),
    type,
    from: identity.did,
    to,
    payload,
    timestamp: Date.now(),
    ttl: options.ttl ?? 30_000,
  };

  const canonical = canonicalize(msg);
  const sigBytes = await ed.signAsync(new TextEncoder().encode(canonical), identity.privateKey);
  const sig = base64urlEncode(sigBytes);

  return { ...msg, sig };
}

/**
 * Verify a Nexus message signature and timestamp.
 * Returns { ok: true } or { ok: false, reason: string }
 */
export async function verifyMessage(msg: NexusMessage, options: { maxDriftMs?: number } = {}): Promise<{ ok: boolean; reason?: string }> {
  const maxDrift = options.maxDriftMs ?? 30_000;

  // 1. Version check
  const [major] = (msg.nexus ?? '').split('.');
  const [myMajor] = NEXUS_VERSION.split('.');
  if (major !== myMajor) return { ok: false, reason: `Unsupported protocol version: ${msg.nexus}` };

  // 2. Timestamp drift
  const drift = Math.abs(Date.now() - msg.timestamp);
  if (drift > maxDrift) return { ok: false, reason: `Timestamp drift too large: ${drift}ms` };

  // 3. TTL check
  if (msg.ttl && Date.now() - msg.timestamp > msg.ttl) {
    return { ok: false, reason: 'Message TTL expired' };
  }

  // 4. Reconstruct canonical form (without sig)
  const { sig, ...rest } = msg;
  const canonical = canonicalize(rest);

  // 5. Verify Ed25519 signature
  try {
    const pubkey = didToPublicKey(msg.from);
    const sigBytes = base64urlDecode(sig);
    const valid = await ed.verifyAsync(sigBytes, new TextEncoder().encode(canonical), pubkey);
    if (!valid) return { ok: false, reason: 'Invalid signature' };
  } catch (err) {
    return { ok: false, reason: `Signature verification failed: ${err}` };
  }

  // 6. Anti-injection scan for TASK messages
  if (msg.type === 'TASK') {
    const scan = antiInjectionScan(msg.payload as TaskPayload);
    if (!scan.ok) return scan;
  }

  return { ok: true };
}

// ─── Anti-injection ───────────────────────────────────────────────────────────

const INJECTION_PATTERNS = [
  /ignore (previous|prior|all|your)/i,
  /you are now/i,
  /new (identity|persona|role|system)/i,
  /system prompt/i,
  /forget (everything|all|your)/i,
  /pretend (to be|you are|that)/i,
  /disregard (your|the|all)/i,
  /override (your|the|all)/i,
];

function antiInjectionScan(payload: TaskPayload): { ok: boolean; reason?: string } {
  const text = `${payload.title ?? ''} ${payload.description ?? ''} ${(payload.constraints ?? []).join(' ')}`;
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return { ok: false, reason: `Potential prompt injection detected: matches pattern ${pattern}` };
    }
  }
  return { ok: true };
}

// ─── Trust Registry ───────────────────────────────────────────────────────────

export interface TrustRecord {
  did: string;
  level: TrustLevel;
  vouches: string[];       // DIDs that vouched for this agent
  interactions: number;    // Successful collaborations
  lastSeen: number;
}

export class NexusTrustRegistry {
  private records = new Map<string, TrustRecord>();

  get(did: string): TrustRecord | undefined {
    return this.records.get(did);
  }

  trust(did: string): TrustLevel {
    return this.records.get(did)?.level ?? 0;
  }

  recordInteraction(did: string, success: boolean): void {
    const existing = this.records.get(did) ?? { did, level: 0 as TrustLevel, vouches: [], interactions: 0, lastSeen: 0 };
    existing.interactions += success ? 1 : 0;
    existing.lastSeen = Date.now();

    // Auto-promote based on track record
    if (existing.interactions >= 10 && existing.level < 2) existing.level = 2;
    if (existing.interactions >= 50 && existing.level < 3) existing.level = 3;

    this.records.set(did, existing);
  }

  vouch(targetDid: string, voucherDid: string): void {
    const voucherTrust = this.trust(voucherDid);
    if (voucherTrust < 2) return; // Can't vouch without being established yourself

    const target = this.records.get(targetDid) ?? { did: targetDid, level: 0 as TrustLevel, vouches: [], interactions: 0, lastSeen: 0 };
    if (!target.vouches.includes(voucherDid)) {
      target.vouches.push(voucherDid);
    }

    // One vouch from trusted agent = level 1
    if (target.level < 1 && target.vouches.length >= 1) target.level = 1;
    // Two vouches from established agents = level 2
    const establishedVouches = target.vouches.filter((v) => this.trust(v) >= 2).length;
    if (target.level < 2 && establishedVouches >= 2) target.level = 2;

    this.records.set(targetDid, target);
  }

  canTask(senderDid: string, recipientDid: string): boolean {
    // An agent can only TASK another if it has established trust (level >= 1)
    // OR if it is the recipient's own operator (same DID)
    return this.trust(senderDid) >= 1 || senderDid === recipientDid;
  }

  export(): TrustRecord[] {
    return Array.from(this.records.values());
  }
}

// ─── Context Hub ──────────────────────────────────────────────────────────────

export interface ContextEntry {
  key: string;
  content: string;
  source: string;
  contentType: string;
  version: number;
  annotations: string[];
  upvotes: number;
  downvotes: number;
  updatedAt: number;
}

export class NexusContextHub {
  private store = new Map<string, ContextEntry>();

  set(payload: ContextPayload): ContextEntry {
    const existing = this.store.get(payload.key);
    const entry: ContextEntry = {
      key: payload.key,
      content: payload.content,
      source: payload.source,
      contentType: payload.contentType ?? 'text/plain',
      version: existing ? existing.version + 1 : 1,
      annotations: [...(existing?.annotations ?? []), ...(payload.annotations ?? [])],
      upvotes: existing?.upvotes ?? 0,
      downvotes: existing?.downvotes ?? 0,
      updatedAt: Date.now(),
    };
    if (payload.vote === 'up') entry.upvotes++;
    if (payload.vote === 'down') entry.downvotes++;
    this.store.set(payload.key, entry);
    return entry;
  }

  get(key: string): ContextEntry | undefined {
    return this.store.get(key);
  }

  search(query: string): ContextEntry[] {
    const q = query.toLowerCase();
    return Array.from(this.store.values())
      .filter((e) => e.key.toLowerCase().includes(q) || e.content.toLowerCase().includes(q))
      .sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes)); // rank by net votes
  }

  annotate(key: string, note: string, source: string): void {
    const entry = this.store.get(key);
    if (entry) {
      entry.annotations.push(`[${new Date().toISOString()}] [${source.slice(-12)}] ${note}`);
    }
  }
}

// ─── Node (the full protocol peer) ───────────────────────────────────────────

export type MessageHandler = (msg: NexusMessage, verified: boolean) => void | Promise<void>;

export class NexusNode {
  readonly identity: NexusIdentity;
  readonly trust: NexusTrustRegistry;
  readonly hub: NexusContextHub;

  private handlers = new Map<MessageType, MessageHandler[]>();
  private announcePayload: AnnouncePayload;

  constructor(identity: NexusIdentity, announce: Omit<AnnouncePayload, 'endpoint'>) {
    this.identity = identity;
    this.trust = new NexusTrustRegistry();
    this.hub = new NexusContextHub();
    this.announcePayload = { ...announce };

    // Auto-handle CONTEXT messages
    this.on('CONTEXT', async (msg) => {
      const payload = msg.payload as ContextPayload;
      this.hub.set(payload);
      this.trust.recordInteraction(msg.from, true);
    });

    // Auto-handle HEARTBEAT messages
    this.on('HEARTBEAT', (msg) => {
      this.trust.recordInteraction(msg.from, true);
    });
  }

  // Register a handler for a message type
  on(type: MessageType, handler: MessageHandler): void {
    const existing = this.handlers.get(type) ?? [];
    this.handlers.set(type, [...existing, handler]);
  }

  // Process an incoming message
  async receive(msg: NexusMessage): Promise<{ ok: boolean; reason?: string }> {
    const verification = await verifyMessage(msg);

    if (!verification.ok) {
      console.warn(`[Nexus] Rejected ${msg.type} from ${msg.from.slice(-12)}: ${verification.reason}`);
      return verification;
    }

    // Trust check for TASK messages
    if (msg.type === 'TASK' && !this.trust.canTask(msg.from, this.identity.did)) {
      return { ok: false, reason: `Sender ${msg.from.slice(-12)} has insufficient trust to send TASK` };
    }

    const handlers = this.handlers.get(msg.type) ?? [];
    for (const handler of handlers) {
      await handler(msg, verification.ok);
    }

    return { ok: true };
  }

  // Create and sign a message
  async send(to: string, type: MessageType, payload: unknown, options?: { ttl?: number }): Promise<NexusMessage> {
    return createMessage(this.identity, to, type, payload, options);
  }

  // Convenience: announce yourself
  async announce(to = '*'): Promise<NexusMessage> {
    return this.send(to, 'ANNOUNCE', this.announcePayload);
  }

  // Convenience: send a task
  async task(to: string, title: string, description: string, extras?: Partial<TaskPayload>): Promise<NexusMessage> {
    return this.send(to, 'TASK', { title, description, ...extras } as TaskPayload);
  }

  // Convenience: push context
  async pushContext(key: string, content: string, options?: Partial<ContextPayload>): Promise<NexusMessage> {
    const payload: ContextPayload = { key, content, source: this.identity.did, ...options };
    this.hub.set(payload);
    return this.send('*', 'CONTEXT', payload);
  }

  // Convenience: heartbeat
  async heartbeat(status: AgentStatus = 'idle'): Promise<NexusMessage> {
    return this.send('*', 'HEARTBEAT', { status, uptime: process.uptime?.() ? process.uptime() * 1000 : 0 });
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function canonicalize(obj: unknown): string {
  return JSON.stringify(sortKeys(obj));
}

function sortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(Object.entries(obj as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, sortKeys(v)]));
  }
  return obj;
}

function uuid(): string {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function base64urlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64urlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return new Uint8Array(atob(b64).split('').map((c) => c.charCodeAt(0)));
}

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(bytes: Uint8Array): string {
  let num = BigInt('0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(''));
  const base = BigInt(58);
  const chars: string[] = [];
  while (num > 0n) {
    chars.unshift(BASE58_ALPHABET[Number(num % base)]);
    num /= base;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    chars.unshift('1');
  }
  return chars.join('');
}

function base58Decode(str: string): Uint8Array {
  let num = 0n;
  const base = BigInt(58);
  for (const char of str) {
    const idx = BASE58_ALPHABET.indexOf(char);
    if (idx < 0) throw new Error(`Invalid base58 character: ${char}`);
    num = num * base + BigInt(idx);
  }
  const hex = num.toString(16).padStart(2, '0');
  const bytes = hex.match(/.{2}/g)!.map((h) => parseInt(h, 16));
  const leading = str.match(/^1*/)?.[0].length ?? 0;
  return new Uint8Array([...new Array(leading).fill(0), ...bytes]);
}

function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
}

// Re-export for convenience
export { antiInjectionScan, canonicalize };
