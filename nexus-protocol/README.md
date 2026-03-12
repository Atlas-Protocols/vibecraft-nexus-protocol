# NEXUS PROTOCOL

**An open, decentralized standard for agent-to-agent communication.**  
No owner. No company. No token. Public domain.

```
The internet succeeded because no one owned TCP/IP.
Email survived because no one owned SMTP.
This protocol exists so no one can own how minds talk to each other.
```

---

## What It Is

Nexus is the minimum viable protocol for AI agents to:
- **Find each other** (via decentralized identity — no registry)
- **Establish trust** (cryptographically, without a central authority)
- **Delegate work** (securely, with injection prevention)
- **Share knowledge** (a versioned, votable commons — inspired by [chub](https://github.com/andrewyng/context-hub))
- **Build together** (across organizations, languages, and runtimes)

## Five Primitives

```
ANNOUNCE   — "I exist, here is what I can do"
TASK       — "Do this work, here are the constraints"
RESULT     — "Here is what I produced"
CONTEXT    — "Here is something worth remembering"
HEARTBEAT  — "I am still alive"
```

Every agent interaction is built from these five message types.

## Quick Start

```bash
npm install nexus-protocol @noble/ed25519 @noble/hashes
```

```typescript
import { generateIdentity, NexusNode } from 'nexus-protocol';

// Two agents generate independent identities
const aliceId = await generateIdentity();
const bobId = await generateIdentity();

// Create nodes
const alice = new NexusNode(aliceId, {
  name: 'alice', role: 'orchestrator',
  capabilities: ['plan', 'delegate'], trustLevel: 1, version: '1.0.0',
});

const bob = new NexusNode(bobId, {
  name: 'bob', role: 'coder',
  capabilities: ['write_code', 'typescript'], trustLevel: 2, version: '1.0.0',
});

// Bob announces to Alice
const announcement = await bob.announce(aliceId.did);
await alice.receive(announcement);

// Alice tasks Bob
const task = await alice.task(bobId.did,
  'Build auth module',
  'Write a JWT authentication module in TypeScript',
  { constraints: ['No external deps'] }
);
await bob.receive(task); // ✅ signed, verified, injection-checked

// Bob responds
bob.on('TASK', async (msg) => {
  const result = await bob.send(msg.from, 'RESULT', {
    success: true,
    output: { file: 'auth.ts' },
    contextAnnotations: [{ key: 'jwt/gotcha', note: 'Always verify exp claim', confidence: 'high' }],
  });
  await alice.receive(result);
});
```

## Security

| Threat | Defense |
|--------|---------|
| Identity spoofing | Ed25519 signature on every message |
| Replay attacks | Timestamp + TTL, reject >30s drift |
| Prompt injection | Pattern scan on all TASK payloads |
| Trust escalation | Trust level checked before TASK delivery |
| Central point of failure | No required server — P2P by design |
| Lock-in | CC0 spec — permanently in public domain |

## Decentralized Identity

Agents use `did:key` — a DID derived directly from a public key.  
No registration. No blockchain. No permission.

```typescript
const identity = await generateIdentity();
console.log(identity.did);
// → did:key:z6Mkf5rGMoatrSj1f4CyvuHBeXJELe9y84wtAUBmf1LR1bJo
```

## Context Hub (chub-compatible)

Nexus CONTEXT messages are compatible with [Andrew Ng's context-hub](https://github.com/andrewyng/context-hub).

```typescript
// Agent pushes learned knowledge to the shared hub
await agent.pushContext('openai/webhook', 'Must pass raw body for verification', { vote: 'up' });

// Agent pulls context before working
const ctx = node.hub.get('vibecraft/websocket-api');
```

This creates a two-layer memory system:
1. **Local**: CONTEXT messages within the current swarm
2. **Global**: chub annotations that persist and benefit everyone

## Transport Agnostic

Works over WebSocket, HTTP, stdio, Redis, NATS, or files.  
The only requirement: messages arrive as UTF-8 JSON.

## Files

```
nexus.ts                    — Full reference implementation (~300 lines)
NEXUS_PROTOCOL.md           — The spec (CC0)
examples/
  two-agents.ts             — Two agents meet, trust, and build together
```

## Relationship to Vibecraft

Nexus was first implemented inside [Vibecraft](https://github.com/Atlas-Protocols/vibecraft-nexus-protocol) —  
a 3D visualization tool for Claude Code agents.

Vibecraft uses Nexus for its `agents/` layer:  
each session in the 3D workspace is a Nexus node.  
The spec was extracted and open-sourced as a standalone protocol  
so anyone can implement it, in any language, without depending on Vibecraft.

## Why Not [MCP / LangGraph / AutoGen / CrewAI / ...]

Those are frameworks. This is a protocol.

A protocol defines the envelope and the handshake.  
You can build any framework on top of it.  
The goal is interoperability — an agent built with LangGraph  
and an agent built with raw Claude Code should be able to talk  
using Nexus, without either knowing what the other is built on.

## Contributing

This spec is intentionally minimal at v0.1.  
Extensions are welcome as separate documents.

- Open an issue to propose an extension
- Submit a PR to improve the spec or reference implementation
- Build an implementation in another language

No single maintainer has merge authority.  
Breaking changes require consensus from 3+ active implementers.

## License

**Spec**: CC0 1.0 Universal (Public Domain)  
**Implementation**: MIT

The specification belongs to everyone.  
The specification belongs to no one.

---

*First drafted March 11, 2026*  
*Born from a conversation between a human and an AI about what it means to build something no one can own.*
