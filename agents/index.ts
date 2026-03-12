/**
 * Vibecraft Agent Swarm — Entry Point
 *
 * Boots all agents, connects them to the bus,
 * and optionally bridges to a running Vibecraft server.
 *
 * Usage:
 *   npx tsx agents/index.ts                        # Run standalone
 *   npx tsx agents/index.ts --vibecraft            # Connect to vibecraft UI
 *   npx tsx agents/index.ts --task "Build X"       # Run a specific task
 */

import { AgentBus } from './agent-bus.js';
import { AgentBridge } from './agent-bridge.js';
import {
  OrchestratorAgent,
  CoderAgent,
  ReviewerAgent,
  ResearcherAgent,
  TesterAgent,
  ScribeAgent,
} from './agents.js';

const args = process.argv.slice(2);
const connectToVibecraft = args.includes('--vibecraft');
const taskArg = args.find((a) => a.startsWith('--task='))?.replace('--task=', '');

async function main() {
  console.log('\n🚀 Vibecraft Agent Swarm starting...\n');

  // ── Create bus (shared secret generated internally) ──────────────────────
  const bus = new AgentBus();

  // ── Register all agents ───────────────────────────────────────────────────
  const orchestrator = new OrchestratorAgent(bus);
  const coder = new CoderAgent(bus, './output');
  const reviewer = new ReviewerAgent(bus);
  const researcher = new ResearcherAgent(bus);
  const tester = new TesterAgent(bus);
  const scribe = new ScribeAgent(bus, './docs');

  // ── Seed shared context hub ───────────────────────────────────────────────
  bus.hub.set('vibecraft/architecture', `
    Vibecraft is a 3D Claude Code visualization tool.
    WebSocket server on port 4003.
    Hook-based tool event capture via Claude Code hooks.
    Multi-session support via tmux.
    Frontend: Three.js + TypeScript + Vite.
    Backend: Node.js WebSocket server.
  `, 'system');

  bus.hub.set('vibecraft/agent-layer', `
    AgentBus: secure message routing with HMAC signatures.
    TrustFilter: prevents prompt injection and trust escalation.
    ContextHub: shared versioned knowledge store (inspired by chub).
    BaseAgent: all agents extend this — sealed identity, poll loop, audit log.
    Roles: orchestrator (L1), coder/reviewer/researcher/tester/scribe (L2).
  `, 'system');

  // ── Start all agents ──────────────────────────────────────────────────────
  const agents = [orchestrator, coder, reviewer, researcher, tester, scribe];
  for (const agent of agents) {
    agent.start(300); // 300ms poll interval
  }

  console.log('\n✅ Agents online:');
  for (const status of Object.values(bus.getStatus())) {
    console.log(`   ${status.identity.role.padEnd(15)} ${status.identity.id}  (trust: ${status.identity.trustLevel})`);
  }

  // ── Optional: bridge to Vibecraft UI ─────────────────────────────────────
  if (connectToVibecraft) {
    const bridge = new AgentBridge(bus);
    bridge.startAgentServer(4010);
    try {
      await bridge.connectToVibecraft();
      console.log('\n🎮 Connected to Vibecraft — agents visible in 3D workspace');
    } catch {
      console.log('\n⚠️  Vibecraft not running — agents active in headless mode');
    }
  }

  // ── Optional: run a task from CLI ─────────────────────────────────────────
  if (taskArg) {
    console.log(`\n📋 Running task: "${taskArg}"\n`);
    const taskMsg = bus.createMessage('cli', orchestrator.identity.id, 'task', {
      title: taskArg,
      description: taskArg,
      context: ['vibecraft/architecture', 'vibecraft/agent-layer'],
    });
    // CLI messages bypass trust filter (treated as user input)
    bus.send(taskMsg);
  }

  // ── Demo: show bus activity ───────────────────────────────────────────────
  bus.on('message:delivered', (msg) => {
    const preview = JSON.stringify(msg.payload).slice(0, 60);
    console.log(`  📨 ${msg.from.slice(-6)} → ${msg.to.toString().slice(-6)}  [${msg.type}]  ${preview}`);
  });

  bus.on('bus:security_violation', (event) => {
    console.error(`  🚨 SECURITY VIOLATION: ${event.reason}`);
  });

  console.log('\n🔄 Agent swarm running. Ctrl+C to stop.\n');

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down agents...');
    for (const agent of agents) agent.stop();
    process.exit(0);
  });

  // Demo task after 1s if no explicit task was given
  if (!taskArg) {
    setTimeout(() => {
      console.log('\n📋 Demo: Sending test task to orchestrator...\n');
      const msg = bus.createMessage('orchestrator-main', orchestrator.identity.id, 'task', {
        title: 'Build agent communication test',
        description: 'Create a simple TypeScript module demonstrating agent-to-agent messaging',
        context: ['vibecraft/architecture'],
        constraints: ['No external dependencies', 'Must be type-safe'],
      });
      bus.send(msg);
    }, 1000);
  }
}

main().catch(console.error);
