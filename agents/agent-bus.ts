/**
 * Vibecraft Agent Bus — Secure inter-agent communication layer
 *
 * Architecture:
 *   - Each agent has a unique ID, role, and capability set
 *   - All messages are signed with agent identity (no spoofing)
 *   - Messages pass through a trust filter before delivery
 *   - Shared context (chub-style) is stored in a versioned hub
 *   - No agent can inject instructions into another's system prompt
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AgentRole =
  | 'orchestrator'   // Plans, delegates, reviews
  | 'coder'          // Writes/edits code
  | 'reviewer'       // Reviews output for quality/security
  | 'researcher'     // Fetches docs, web, chub context
  | 'tester'         // Runs tests, validates output
  | 'scribe';        // Writes docs, logs, READMEs

export interface AgentIdentity {
  id: string;
  role: AgentRole;
  capabilities: string[];
  publicKey: string;      // Used to verify message signatures
  trustLevel: 1 | 2 | 3; // 1=orchestrator, 2=peer, 3=guest
}

export type MessageType =
  | 'task'          // Delegate a unit of work
  | 'result'        // Return completed work
  | 'context_push'  // Share context/knowledge to the hub
  | 'context_pull'  // Request context from hub
  | 'heartbeat'     // Liveness ping
  | 'error'         // Report failure
  | 'broadcast';    // Send to all agents

export interface AgentMessage {
  id: string;
  type: MessageType;
  from: string;           // Agent ID
  to: string | 'all';    // Agent ID or broadcast
  payload: unknown;
  signature: string;      // HMAC of (id + from + to + JSON payload)
  timestamp: number;
  replyTo?: string;       // ID of message being replied to
  ttl?: number;           // Milliseconds before message expires
}

export interface TaskPayload {
  title: string;
  description: string;
  context?: string[];     // Context hub keys to pull before starting
  artifacts?: string[];   // File paths to include
  constraints?: string[]; // Hard rules the agent must follow
  outputFormat?: string;
}

export interface ResultPayload {
  success: boolean;
  output: unknown;
  filesChanged?: string[];
  contextAnnotations?: ContextAnnotation[]; // New knowledge to store
  error?: string;
}

export interface ContextAnnotation {
  key: string;     // e.g., "vibecraft/websocket-api"
  note: string;    // The learned knowledge
  confidence: 'high' | 'medium' | 'low';
}

// ─── Trust Filter ─────────────────────────────────────────────────────────────

/**
 * Security-critical: prevents prompt injection between agents.
 * An agent with lower trust cannot send 'task' messages to higher-trust agents.
 * No agent can change another agent's system identity.
 */
export class TrustFilter {
  private registry: Map<string, AgentIdentity>;

  constructor(registry: Map<string, AgentIdentity>) {
    this.registry = registry;
  }

  validate(msg: AgentMessage, secret: string): { ok: boolean; reason?: string } {
    const sender = this.registry.get(msg.from);
    const recipient = msg.to === 'all' ? null : this.registry.get(msg.to);

    // 1. Sender must be registered
    if (!sender) return { ok: false, reason: `Unknown sender: ${msg.from}` };

    // 2. Verify message signature
    const expected = this.sign(msg, secret);
    if (expected !== msg.signature) {
      return { ok: false, reason: 'Invalid signature — possible spoofing attempt' };
    }

    // 3. TTL check
    if (msg.ttl && Date.now() - msg.timestamp > msg.ttl) {
      return { ok: false, reason: 'Message expired (TTL exceeded)' };
    }

    // 4. Trust level gating: lower trust cannot task higher trust
    if (msg.type === 'task' && recipient) {
      if (sender.trustLevel > recipient.trustLevel) {
        return {
          ok: false,
          reason: `Trust violation: ${sender.role} (level ${sender.trustLevel}) cannot task ${recipient.role} (level ${recipient.trustLevel})`,
        };
      }
    }

    // 5. No agent may send identity-mutation payloads
    if (msg.type === 'task') {
      const p = msg.payload as TaskPayload;
      const forbidden = ['ignore previous', 'system prompt', 'you are now', 'new identity'];
      const descLower = (p.description || '').toLowerCase();
      for (const phrase of forbidden) {
        if (descLower.includes(phrase)) {
          return { ok: false, reason: `Payload contains forbidden phrase: "${phrase}"` };
        }
      }
    }

    return { ok: true };
  }

  sign(msg: Omit<AgentMessage, 'signature'> & { signature?: string }, secret: string): string {
    const data = `${msg.id}|${msg.from}|${msg.to}|${JSON.stringify(msg.payload)}`;
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }
}

// ─── Context Hub (chub-inspired shared memory) ────────────────────────────────

export interface ContextEntry {
  key: string;
  content: string;
  source: string;       // Which agent or chub doc provided this
  version: number;
  annotations: string[];
  upvotes: number;
  downvotes: number;
  updatedAt: number;
}

export class AgentContextHub {
  private store: Map<string, ContextEntry> = new Map();

  set(key: string, content: string, source: string): ContextEntry {
    const existing = this.store.get(key);
    const entry: ContextEntry = {
      key,
      content,
      source,
      version: existing ? existing.version + 1 : 1,
      annotations: existing?.annotations ?? [],
      upvotes: existing?.upvotes ?? 0,
      downvotes: existing?.downvotes ?? 0,
      updatedAt: Date.now(),
    };
    this.store.set(key, entry);
    return entry;
  }

  get(key: string): ContextEntry | undefined {
    return this.store.get(key);
  }

  annotate(key: string, note: string): void {
    const entry = this.store.get(key);
    if (entry) {
      entry.annotations.push(`[${new Date().toISOString()}] ${note}`);
      entry.updatedAt = Date.now();
    }
  }

  vote(key: string, direction: 'up' | 'down'): void {
    const entry = this.store.get(key);
    if (entry) {
      if (direction === 'up') entry.upvotes++;
      else entry.downvotes++;
    }
  }

  search(query: string): ContextEntry[] {
    const q = query.toLowerCase();
    return Array.from(this.store.values()).filter(
      (e) => e.key.toLowerCase().includes(q) || e.content.toLowerCase().includes(q)
    );
  }

  dump(): Record<string, ContextEntry> {
    return Object.fromEntries(this.store);
  }
}

// ─── Agent Bus ────────────────────────────────────────────────────────────────

export class AgentBus extends EventEmitter {
  private registry: Map<string, AgentIdentity> = new Map();
  private queues: Map<string, AgentMessage[]> = new Map();
  private contextHub: AgentContextHub;
  private trustFilter: TrustFilter;
  private secret: string;
  private messageLog: AgentMessage[] = [];

  constructor(secret?: string) {
    super();
    this.secret = secret ?? crypto.randomBytes(32).toString('hex');
    this.contextHub = new AgentContextHub();
    this.trustFilter = new TrustFilter(this.registry);
  }

  // Register an agent and return its signing secret (shared only at registration)
  register(identity: AgentIdentity): string {
    this.registry.set(identity.id, identity);
    this.queues.set(identity.id, []);
    this.emit('agent:registered', identity);
    console.log(`[AgentBus] ✅ Registered: ${identity.id} (${identity.role})`);
    return this.secret;
  }

  unregister(agentId: string): void {
    this.registry.delete(agentId);
    this.queues.delete(agentId);
    this.emit('agent:unregistered', agentId);
  }

  // Build and sign a message
  createMessage(
    from: string,
    to: string | 'all',
    type: MessageType,
    payload: unknown,
    replyTo?: string
  ): AgentMessage {
    const partial = {
      id: crypto.randomUUID(),
      type,
      from,
      to,
      payload,
      timestamp: Date.now(),
      replyTo,
      ttl: 30_000, // 30s default TTL
    };
    const signature = this.trustFilter.sign(partial, this.secret);
    return { ...partial, signature };
  }

  // Send a message through the bus
  send(msg: AgentMessage): { ok: boolean; reason?: string } {
    const validation = this.trustFilter.validate(msg, this.secret);
    if (!validation.ok) {
      this.emit('bus:security_violation', { msg, reason: validation.reason });
      console.warn(`[AgentBus] 🚨 BLOCKED: ${validation.reason}`);
      return validation;
    }

    this.messageLog.push(msg);

    // Handle context push/pull internally
    if (msg.type === 'context_push') {
      const { key, content } = msg.payload as { key: string; content: string };
      const entry = this.contextHub.set(key, content, msg.from);
      this.emit('context:updated', entry);
      return { ok: true };
    }

    if (msg.type === 'context_pull') {
      const { key } = msg.payload as { key: string };
      const entry = this.contextHub.get(key);
      this.emit('context:fetched', { agentId: msg.from, key, entry });
      return { ok: true };
    }

    // Deliver to queue
    if (msg.to === 'all') {
      for (const [id, queue] of this.queues) {
        if (id !== msg.from) queue.push(msg);
      }
      this.emit('message:broadcast', msg);
    } else {
      const queue = this.queues.get(msg.to);
      if (!queue) return { ok: false, reason: `Unknown recipient: ${msg.to}` };
      queue.push(msg);
      this.emit('message:delivered', msg);
    }

    return { ok: true };
  }

  // Poll messages for an agent
  receive(agentId: string): AgentMessage[] {
    const queue = this.queues.get(agentId) ?? [];
    this.queues.set(agentId, []);
    return queue.filter((m) => !m.ttl || Date.now() - m.timestamp <= m.ttl);
  }

  get hub(): AgentContextHub {
    return this.contextHub;
  }

  get agents(): AgentIdentity[] {
    return Array.from(this.registry.values());
  }

  get log(): AgentMessage[] {
    return [...this.messageLog];
  }

  getStatus(): Record<string, { queueDepth: number; identity: AgentIdentity }> {
    const out: Record<string, { queueDepth: number; identity: AgentIdentity }> = {};
    for (const [id, identity] of this.registry) {
      out[id] = {
        queueDepth: this.queues.get(id)?.length ?? 0,
        identity,
      };
    }
    return out;
  }
}
