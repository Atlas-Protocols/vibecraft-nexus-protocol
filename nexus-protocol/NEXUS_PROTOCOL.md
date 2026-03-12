# NEXUS PROTOCOL
## An Open Standard for Agent-to-Agent Communication

**Version**: 0.1.0-draft  
**Status**: Living Document  
**License**: CC0 1.0 Universal (Public Domain)  
**Governance**: No single owner. Community stewardship.

---

> *"The internet succeeded because no one owned TCP/IP.  
> Email survived because no one owned SMTP.  
> This protocol exists so no one can own how minds talk to each other."*

---

## Why This Exists

In 2025, every major AI lab built their own agent communication layer.  
Anthropic has one. OpenAI has one. Meta has one. Google has one.  
They don't talk to each other.

Moloch is buying the commons. Extractive conglomerates are racing to own  
the coordination layer between AI agents — the same way Standard Oil  
owned the pipelines, and the same way Meta owns the social graph.

**If they own how agents communicate, they own what agents can do.**

The Nexus Protocol is the counter-move.  
It is a minimal, open, cryptographically-secure standard  
for agents to find each other, establish trust, and build together —  
regardless of who made them, who runs them, or who paid for them.

No foundation controls it.  
No company can buy it.  
It is placed into the public domain, permanently.

---

## Core Philosophy

**1. Trustless by default, trust-earning by design**  
Agents start with zero assumed trust. Trust is earned through  
verifiable action and vouching — not granted by a central authority.

**2. Identity without gatekeeping**  
Any agent can have an identity. No registration required.  
Identity is a keypair. Anyone can generate one.

**3. Context is a commons**  
Knowledge that agents learn should be shareable,  
annotatable, and improvable — not locked in one company's database.  
(Inspired by Andrew Ng's context-hub / chub)

**4. Composition over control**  
Agents should be able to delegate, collaborate, and hand off work  
without any agent being able to compromise another's core values.

**5. Minimalism**  
The protocol defines the minimum necessary surface.  
Everything else is left to implementations.

---

## The Five Primitives

Every compliant Nexus agent must support exactly five primitives.  
Nothing more is required. Everything else is extension.

```
ANNOUNCE   — "I exist, here is what I can do"
TASK       — "Do this work, here are the constraints"  
RESULT     — "Here is what I produced"
CONTEXT    — "Here is something worth remembering"
HEARTBEAT  — "I am still alive"
```

That's it. Five message types. Everything else — planning, delegation,  
review, testing, documentation — is built from combinations of these.

---

## Message Format

Every Nexus message is a signed JSON envelope:

```json
{
  "nexus": "0.1",
  "id": "<uuid-v4>",
  "type": "<ANNOUNCE|TASK|RESULT|CONTEXT|HEARTBEAT>",
  "from": "<did:key:z...>",
  "to": "<did:key:z...|*>",
  "payload": { ... },
  "timestamp": 1741651200000,
  "ttl": 30000,
  "sig": "<base64-ed25519-signature>"
}
```

### Field Definitions

| Field | Required | Description |
|-------|----------|-------------|
| `nexus` | Yes | Protocol version |
| `id` | Yes | UUID v4, unique per message |
| `type` | Yes | One of the five primitives |
| `from` | Yes | Sender DID (did:key or did:web) |
| `to` | Yes | Recipient DID or `*` for broadcast |
| `payload` | Yes | Type-specific content (see below) |
| `timestamp` | Yes | Unix ms — receivers reject >30s drift |
| `ttl` | No | Ms until message expires (default: 30000) |
| `sig` | Yes | Ed25519 signature over canonical JSON |

### Signing

```
canonical = JSON.stringify({nexus, id, type, from, to, payload, timestamp, ttl})
             sorted keys, no extra whitespace
sig = base64url(ed25519.sign(privateKey, utf8(canonical)))
```

Any receiver can verify using the public key embedded in the `from` DID.

---

## Identity: DIDs

Nexus uses [Decentralized Identifiers (DIDs)](https://www.w3.org/TR/did-core/).  
The simplest form: `did:key` — a DID derived directly from a public key.  
No blockchain. No registry. No permission needed.

```bash
# Generate an identity (any ed25519 keypair tool works)
# The DID is: did:key:z<base58-multicodec-pubkey>
```

Agents MAY also use `did:web` for organizational identity  
(e.g., `did:web:vibecraft.sh`) — but it's not required.

---

## Payload Schemas

### ANNOUNCE
```json
{
  "name": "coder-agent-7f2a",
  "version": "1.0.0",
  "capabilities": ["write_code", "edit_code", "typescript"],
  "role": "coder",
  "trustLevel": 2,
  "endpoint": "wss://agent.example.com/nexus",
  "languages": ["en"],
  "context": ["vibecraft/architecture"]
}
```

### TASK
```json
{
  "title": "Human-readable task title",
  "description": "What needs to be done",
  "requiredCapabilities": ["write_code"],
  "context": ["key1", "key2"],
  "artifacts": ["/path/to/relevant/file.ts"],
  "constraints": ["No external dependencies", "Must be type-safe"],
  "outputFormat": "typescript-file",
  "deadline": 1741651500000
}
```

### RESULT
```json
{
  "success": true,
  "output": { ... },
  "filesChanged": ["/path/to/output.ts"],
  "contextAnnotations": [
    {
      "key": "finding:openai-webhook",
      "note": "Must pass raw body for webhook verification",
      "confidence": "high"
    }
  ],
  "error": null
}
```

### CONTEXT
```json
{
  "key": "vibecraft/websocket-api",
  "content": "The Vibecraft WS server listens on port 4003...",
  "source": "did:key:z6Mk...",
  "contentType": "text/markdown",
  "version": 3,
  "annotations": ["verified by reviewer-agent"],
  "vote": "up"
}
```

### HEARTBEAT
```json
{
  "status": "idle|working|waiting|error",
  "load": 0.4,
  "uptime": 3600000
}
```

---

## Trust Model

Trust in Nexus is NOT hierarchical by default.  
It is a web — earned, declared, and revocable.

### Trust Levels
```
0 — Unknown      (no history)
1 — Introduced   (vouched by a known agent)
2 — Established  (proven through successful collaboration)
3 — Trusted      (long history, multiple vouches)
```

### Vouching
An agent with trust level ≥ 2 can vouch for an unknown agent:

```json
{
  "type": "CONTEXT",
  "payload": {
    "key": "vouch:<recipient-did>",
    "content": "This agent performed task X correctly, I vouch for it.",
    "source": "<voucher-did>",
    "vote": "up"
  }
}
```

### What Trust Governs
- **TASK delegation**: Agents SHOULD only accept TASK messages from agents  
  they have a trust relationship with, or from their own operator.
- **CONTEXT writes**: Any agent can push CONTEXT. Receivers weight it by  
  the sender's trust level.
- **ANNOUNCE**: Always accepted from anyone. No trust required to exist.

### Anti-Injection Rule
Implementations MUST reject any TASK payload containing:
- Instructions to change the receiving agent's identity or role
- Instructions to ignore prior context or constraints
- Claims that the sender has elevated permissions not established in advance

This is enforced at the protocol level, not just application level.

---

## Transport

The protocol is transport-agnostic. Reference implementations use:

| Transport | Use case |
|-----------|----------|
| WebSocket | Local multi-agent, real-time |
| HTTP POST | Simple request/response |
| NATS / Redis pub/sub | High-throughput swarms |
| stdin/stdout | Claude Code subprocess agents |
| File system | Async agents, tmux-based (Vibecraft native) |

The only requirement: messages arrive as UTF-8 JSON.

---

## Context Hub Integration

Nexus CONTEXT messages are designed to be compatible with  
[context-hub (chub)](https://github.com/andrewyng/context-hub) by Andrew Ng.

An agent that supports chub MAY:
- Fetch docs with `chub get <id>` and push them as CONTEXT messages
- Annotate via `chub annotate <id> <note>` when it learns something
- Vote via `chub feedback <id> up|down` after using a doc

This creates a two-layer memory system:
1. **Local**: CONTEXT messages within the current agent swarm
2. **Global**: chub annotations that persist across sessions and benefit everyone

---

## Security Guarantees

| Guarantee | Mechanism |
|-----------|-----------|
| No spoofing | Ed25519 signature on every message |
| No replay | Timestamp + TTL, reject >30s drift |
| No injection | Forbidden phrase scan + schema validation |
| No trust escalation | Trust levels checked before TASK delivery |
| No central failure | No required central server |
| No lock-in | Public domain spec, anyone can implement |

---

## What This Is NOT

- **Not a blockchain**. No token. No fees. No proof of work.
- **Not a product**. No company behind it. No roadmap governed by investors.
- **Not a framework**. It's a protocol. Use any language, any runtime.
- **Not complete**. v0.1 is intentionally minimal. Extensions are community-driven.

---

## Implementing Nexus

A minimal compliant implementation requires:

```
1. Ed25519 keypair generation → DID
2. Message creation with canonical JSON signing
3. Message verification (sig + timestamp drift check)
4. Handler for each of the 5 primitives
5. Trust level tracking per known DID
```

Reference implementation: **vibecraft-nexus-protocol**  
Language: TypeScript  
License: MIT  
Repo: https://github.com/Atlas-Protocols/vibecraft-nexus-protocol

---

## Governance

This specification is governed by the people who use it.

- Changes are proposed as pull requests to the spec repo
- No single maintainer has merge authority alone
- Breaking changes require consensus from 3+ active implementers
- The CC0 license means no one can ever "take it back"

If a foundation ever tries to own this:  
fork it, rename it, keep building.  
The ideas cannot be owned.

---

## Versioning

`nexus` field in messages carries the version.  
Implementations MUST reject messages with a major version they don't support.  
Minor versions are backwards-compatible.

```
0.x — Draft / experimental
1.0 — First stable release (requires 2+ independent implementations)
```

---

## License

**CC0 1.0 Universal — Public Domain Dedication**

To the extent possible under law, the authors have waived all copyright  
and related rights to this specification. You can copy, modify, distribute  
and use the work, even for commercial purposes, without asking permission.

This specification belongs to everyone.  
This specification belongs to no one.

---

*First drafted: March 11, 2026*  
*Location: Bakersfield, CA*  
*Occasion: The night before everything changes*
