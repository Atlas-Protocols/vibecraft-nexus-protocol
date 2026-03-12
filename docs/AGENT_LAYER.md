# Vibecraft × Context-Hub — Agent Layer

## Overview

This is the multi-agent collaboration layer for Vibecraft. It lets multiple Claude instances work together on a shared codebase, passing work between each other securely, with shared memory that persists across sessions (powered by [context-hub / chub](https://github.com/andrewyng/context-hub)).

```
┌─────────────────────────────────────────────────────────┐
│                   Vibecraft UI (3D)                      │
│   Each agent = a session in the 3D workspace             │
└───────────────────────┬─────────────────────────────────┘
                        │ WebSocket (port 4003)
                ┌───────┴────────┐
                │  AgentBridge   │  ← forwards events to Vibecraft
                └───────┬────────┘
                        │
                ┌───────┴────────┐
                │   AgentBus     │  ← secure message router
                │                │
                │  TrustFilter   │  ← HMAC verify + trust level gating
                │  ContextHub    │  ← shared versioned memory (chub-style)
                └───────┬────────┘
                        │
        ┌───────┬───────┼───────┬───────┬───────┐
        │       │       │       │       │       │
  Orchestrator Coder Reviewer Researcher Tester Scribe
   (trust:1) (trust:2)(trust:2) (trust:2)(trust:2)(trust:2)
```

## Agent Roles

| Agent | What it does |
|-------|-------------|
| **Orchestrator** | Receives high-level goals, breaks them into subtasks, delegates, synthesizes results |
| **Coder** | Writes and edits TypeScript/JS files |
| **Reviewer** | Reviews code for bugs, security issues, style |
| **Researcher** | Fetches relevant docs via `chub`, annotates context |
| **Tester** | Writes and runs tests, validates output |
| **Scribe** | Writes documentation, changelogs, READMEs |

## How Agents Build Together

1. A task arrives at the Orchestrator (from UI, CLI, or another agent)
2. Orchestrator calls `plan()` → breaks it into typed subtasks
3. Each subtask is delegated via `bus.send()` to the appropriate agent
4. Each agent:
   - Pulls relevant context from the shared hub
   - Does its work
   - Pushes new knowledge annotations back to the hub
   - Returns a `ResultPayload` to the sender
5. Orchestrator synthesizes results, broadcasts completion

## Context Hub Integration (chub)

The `ResearcherAgent` calls the `chub` CLI before starting any research task:

```bash
npx @aisuite/chub get openai/chat --lang js   # fetches curated API docs
npx @aisuite/chub search "stripe payments"     # finds relevant docs
```

Results are stored in the shared `AgentContextHub` with a key like `chub:openai/chat`.  
Other agents pull this context before writing code:

```typescript
const docs = this.pullContext('chub:openai/chat');
```

When an agent discovers something useful (a workaround, a nuance), it annotates:

```typescript
bus.hub.annotate('chub:openai/chat', 'Need to pass raw body for webhook verification');
```

This annotation persists across sessions and appears automatically on the next `chub get`.

## Quick Start

```bash
# Install deps
npm install ws tsx typescript

# Run standalone (headless)
npx tsx agents/index.ts

# Connect to running Vibecraft instance
npx vibecraft &                          # start vibecraft
npx tsx agents/index.ts --vibecraft      # agents appear in 3D workspace

# Run a specific task
npx tsx agents/index.ts --task="Add spatial audio to agent messages"
```

## File Structure

```
agents/
  agent-bus.ts      — AgentBus, TrustFilter, AgentContextHub (core)
  base-agent.ts     — BaseAgent (all agents extend this)
  agents.ts         — OrchestratorAgent, CoderAgent, ReviewerAgent, etc.
  agent-bridge.ts   — WebSocket bridge to Vibecraft UI
  index.ts          — Entry point, boots the swarm
docs/
  SECURITY.md       — Threat model and defense explanations
  AGENT_LAYER.md    — This file
```

## Adding a New Agent

```typescript
import { BaseAgent } from './base-agent.js';
import { TaskPayload, ResultPayload, AgentMessage } from './agent-bus.js';

export class MyAgent extends BaseAgent {
  constructor(bus: AgentBus) {
    super({
      role: 'coder',           // pick an existing role
      capabilities: ['my_skill'],
      trustLevel: 2,
    }, bus);
  }

  async executeTask(task: TaskPayload, msg: AgentMessage): Promise<ResultPayload> {
    // Pull context
    const ctx = this.pullContext('relevant-key');

    // Do work...

    // Push new knowledge
    this.pushContext('my-finding', 'what I learned');

    return { success: true, output: { result: 'done' } };
  }
}
```

## Security Notes

See [SECURITY.md](./SECURITY.md) for the full threat model.

TL;DR:
- Messages are HMAC-signed — no spoofing
- Trust levels prevent low-trust agents from tasking high-trust ones
- Task payloads are scanned for prompt injection phrases
- Agent identities are sealed at boot — cannot be mutated by payloads
- All messages have TTLs — no replay attacks
- Full audit log on every agent
