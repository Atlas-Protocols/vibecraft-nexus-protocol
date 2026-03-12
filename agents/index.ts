/**
 * agents/index.ts — Updated entry point
 *
 * Now supports:
 *   --relay ws://<ip>:4020   Connect to a Nexus relay for cross-machine comms
 *   --session <name>         Named session (identity persisted to disk)
 *   --vibecraft              Bridge to local Vibecraft UI
 *   --task="..."             Run a specific task
 *
 * Examples:
 *   Machine A (runs relay):
 *     npx tsx agents/nexus-relay.ts &
 *     npx tsx agents/index.ts --session alice --relay ws://localhost:4020 --vibecraft
 *
 *   Machine B (connects to A):
 *     npx tsx agents/index.ts --session bob --relay ws://192.168.1.10:4020 --vibecraft
 */

import { AgentBus } from './agent-bus.js';
import { AgentBridge } from './agent-bridge.js';
import { OrchestratorAgent, CoderAgent, ReviewerAgent, ResearcherAgent, TesterAgent, ScribeAgent } from './agents.js';
import { NexusNode, NexusMessage, TaskPayload } from '../nexus-protocol/nexus.js';
import { getOrCreateIdentity, listIdentities } from './session-identity.js';
import { NexusTransport } from './nexus-transport.js';

const args = process.argv.slice(2);
const connectToVibecraft = args.includes('--vibecraft');
const relayUrl = args.find((a) => a.startsWith('--relay='))?.replace('--relay=', '')
  ?? args[args.indexOf('--relay') + 1];
const sessionName = args.find((a) => a.startsWith('--session='))?.replace('--session=', '')
  ?? args[args.indexOf('--session') + 1]
  ?? 'default';
const taskArg = args.find((a) => a.startsWith('--task='))?.replace('--task=', '');

async function main() {
  console.log(`\n🚀 Vibecraft Agent Swarm — Session: "${sessionName}"\n`);

  // ── Load or create this session's Nexus identity ─────────────────────────
  const identity = await getOrCreateIdentity(sessionName);
  console.log(`\n🔑 DID: ${identity.did}\n`);

  // ── Show all known identities ─────────────────────────────────────────────
  const knownIds = listIdentities();
  if (Object.keys(knownIds).length > 1) {
    console.log('📋 Known sessions:');
    for (const [sid, did] of Object.entries(knownIds)) {
      const marker = sid === sessionName ? ' ← you' : '';
      console.log(`   ${sid.padEnd(20)} ${did.slice(0, 35)}...${marker}`);
    }
    console.log();
  }

  // ── Create NexusNode for this session ─────────────────────────────────────
  const nexusNode = new NexusNode(identity, {
    name: sessionName,
    version: '1.0.0',
    capabilities: ['orchestrate', 'code', 'review', 'research', 'test', 'document'],
    role: 'orchestrator',
    trustLevel: 1,
  });

  // ── Internal agent bus (local swarm) ─────────────────────────────────────
  const bus = new AgentBus();
  const orchestrator = new OrchestratorAgent(bus, `orchestrator-${sessionName}`);
  const coder = new CoderAgent(bus, `./output/${sessionName}`);
  const reviewer = new ReviewerAgent(bus);
  const researcher = new ResearcherAgent(bus);
  const tester = new TesterAgent(bus);
  const scribe = new ScribeAgent(bus, `./docs/output/${sessionName}`);

  // Seed shared context
  bus.hub.set('vibecraft/architecture', `Vibecraft: Claude Code → hooks → WS server (port 4003) → Three.js browser. Sessions are tmux processes. Hook script at hooks/vibecraft-hook.sh`, 'system');
  bus.hub.set('nexus/identity', `This session DID: ${identity.did}`, 'system');

  const agents = [orchestrator, coder, reviewer, researcher, tester, scribe];
  for (const agent of agents) agent.start(300);

  console.log('✅ Local agents online:');
  for (const s of Object.values(bus.getStatus())) {
    console.log(`   ${s.identity.role.padEnd(15)} ${s.identity.id}`);
  }

  // ── Connect to Nexus relay (cross-machine) ────────────────────────────────
  let transport: NexusTransport | null = null;
  if (relayUrl) {
    transport = new NexusTransport(nexusNode, identity);

    // When we receive a TASK from another machine, route to local orchestrator
    nexusNode.on('TASK', async (msg: NexusMessage) => {
      const task = msg.payload as TaskPayload;
      console.log(`\n📋 Remote task from ${msg.from.slice(-12)}: "${task.title}"`);

      // Push to local bus
      const busMsg = bus.createMessage('nexus-remote', orchestrator.identity.id, 'task', task);
      bus.send(busMsg);
    });

    // When remote agent announces, log it
    nexusNode.on('ANNOUNCE', async (msg: NexusMessage) => {
      const payload = msg.payload as { name: string; role: string; capabilities: string[] };
      console.log(`\n🤖 New agent online: ${payload.name} (${payload.role})`);
      console.log(`   DID: ${msg.from}`);
      console.log(`   Capabilities: ${payload.capabilities.join(', ')}`);

      // Store in context hub
      bus.hub.set(`peer:${payload.name}`, JSON.stringify({ did: msg.from, ...payload }), 'nexus-relay');
    });

    try {
      await transport.connect(relayUrl);
      console.log(`\n🌐 Connected to relay: ${relayUrl}`);
      console.log(`   Your DID: ${identity.did}`);
      console.log(`   Waiting for peers...\n`);
    } catch (err) {
      console.warn(`\n⚠️  Could not connect to relay at ${relayUrl}`);
      console.warn('   Running in local-only mode\n');
    }
  }

  // ── Optional: bridge to Vibecraft UI ─────────────────────────────────────
  if (connectToVibecraft) {
    const bridge = new AgentBridge(bus);
    bridge.startAgentServer(4010);
    try {
      await bridge.connectToVibecraft();
      console.log('🎮 Connected to Vibecraft UI\n');
    } catch {
      console.log('⚠️  Vibecraft not running — headless mode\n');
    }
  }

  // ── Optional: run a task ──────────────────────────────────────────────────
  if (taskArg && transport) {
    // If relay is connected, broadcast task to all peers
    console.log(`\n📋 Broadcasting task to network: "${taskArg}"\n`);
    const msg = await nexusNode.task('*', taskArg, taskArg, {
      context: ['vibecraft/architecture'],
    });
    transport.send(msg);
  }

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    if (transport) {
      const hb = await nexusNode.heartbeat('idle');
      (hb.payload as { status: string }).status = 'offline';
      transport.send(hb);
      transport.close();
    }
    for (const agent of agents) agent.stop();
    process.exit(0);
  });

  console.log('🔄 Swarm running. Ctrl+C to stop.\n');
}

main().catch(console.error);
