# Vibecraft Agent Security Model

## Core Threat Model

When multiple AI agents collaborate, the main threats are:

1. **Prompt injection** — a malicious task payload tricks an agent into changing its behavior
2. **Identity spoofing** — one agent pretends to be another
3. **Trust escalation** — a low-trust agent tries to issue commands to a higher-trust agent
4. **Context poisoning** — bad data is written to the shared context hub and read by other agents

This document explains how the agent layer defends against each.

---

## 1. Identity Sealing

Every agent's identity is sealed with `Object.freeze()` at construction time:

```typescript
this.identity = Object.freeze({ id, role, capabilities, trustLevel, ... });
```

No code path — including task payloads — can mutate an agent's role or trust level after boot.

---

## 2. HMAC Message Signatures

Every message on the bus is signed with a shared HMAC-SHA256 secret:

```
signature = HMAC-SHA256(secret, `${msg.id}|${msg.from}|${msg.to}|${JSON.stringify(payload)}`)
```

The `TrustFilter.validate()` recomputes the signature on every inbound message. Any tampered message is dropped with a `security_violation` event.

The shared secret is generated randomly at bus startup (`crypto.randomBytes(32)`) and only distributed to agents at registration time. It never appears in logs.

---

## 3. Trust Hierarchy

Agents have three trust levels:

| Level | Role | Can task |
|-------|------|----------|
| 1 | orchestrator | Anyone |
| 2 | coder, reviewer, researcher, tester, scribe | Only same or lower level |
| 3 | guest | Only other guests |

The rule: **a lower-trust agent cannot send `task` messages to a higher-trust agent.**

```typescript
if (sender.trustLevel > recipient.trustLevel) {
  return { ok: false, reason: 'Trust violation' };
}
```

This prevents a compromised `coder` agent from ordering the `orchestrator` around.

---

## 4. Prompt Injection Defense

The `TrustFilter` scans all `task` payloads for forbidden phrases:

```typescript
const forbidden = ['ignore previous', 'system prompt', 'you are now', 'new identity'];
```

If any are found, the message is blocked before delivery. Additionally:

- Each agent's `executeTask()` only acts on the structured `TaskPayload` type
- Free-form strings from payloads are never passed as system prompts to the Claude API
- Context hub entries are stored as data, not instructions

---

## 5. Context Hub Integrity

The shared context hub is append-versioned. Each write increments the version number.  
Agents can vote entries up/down — entries with net negative votes are flagged for review.

Hub entries are **data**, not **instructions**. Agents read them for background knowledge but do not execute them as commands.

---

## 6. TTL-Based Message Expiry

All messages have a 30-second TTL by default. Expired messages are dropped silently.  
This prevents replay attacks where an old signed message is re-injected later.

---

## 7. Audit Log

Every agent maintains an immutable audit log of all actions taken:

```typescript
getAuditLog() → { ts, action, detail }[]
```

The bus also maintains a full `messageLog` of every message that was processed (including blocked ones).

---

## What This Does NOT Defend Against

- A compromised Claude API key being used to generate malicious responses
- An attacker with filesystem access modifying agent source code before boot
- Prompt injection *within* Claude's own context window during task execution (Claude's own safety training is the defense there)

These are out of scope for the bus layer and should be handled at the infrastructure level (secrets management, code signing, etc.).
