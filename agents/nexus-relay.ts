/**
 * nexus-relay.ts
 * Lightweight relay server — routes signed Nexus messages between agents on
 * different machines. Pure forward-only pipe. Does NOT verify signatures.
 * Receivers are responsible for verification.
 *
 * Run on one machine: npx tsx agents/nexus-relay.ts
 * Both agents connect to: ws://<this-machine-ip>:4020
 */

import { WebSocketServer, WebSocket } from 'ws';
import { NexusMessage } from '../nexus-protocol/nexus.js';

const PORT = Number(process.env.PORT ?? process.env.NEXUS_RELAY_PORT ?? 4020);

interface ConnectedPeer {
  ws: WebSocket;
  did: string | null;
  connectedAt: number;
  messageCount: number;
  label: string; // human-readable (from ANNOUNCE payload name)
}

const peers = new Map<WebSocket, ConnectedPeer>();
const didIndex = new Map<string, WebSocket>(); // DID → WebSocket

const wss = new WebSocketServer({ port: PORT });

console.log(`\n🌐 Nexus Relay starting on port ${PORT}`);
console.log(`   Agents connect to: ws://localhost:${PORT}`);
console.log(`   Or from remote:    ws://<your-ip>:${PORT}\n`);

wss.on('connection', (ws, req) => {
  const remoteIp = req.socket.remoteAddress ?? 'unknown';
  const peer: ConnectedPeer = {
    ws,
    did: null,
    connectedAt: Date.now(),
    messageCount: 0,
    label: remoteIp,
  };
  peers.set(ws, peer);

  console.log(`[relay] ➕ New connection from ${remoteIp} (${peers.size} total)`);

  ws.on('message', (data) => {
    let msg: NexusMessage;
    try {
      msg = JSON.parse(data.toString()) as NexusMessage;
    } catch {
      console.warn(`[relay] ⚠️  Invalid JSON from ${peer.label}`);
      return;
    }

    peer.messageCount++;

    // Register DID on first ANNOUNCE
    if (msg.type === 'ANNOUNCE' && msg.from && !peer.did) {
      peer.did = msg.from;
      peer.label = `${(msg.payload as { name?: string })?.name ?? 'agent'}@${msg.from.slice(-8)}`;
      didIndex.set(msg.from, ws);
      console.log(`[relay] 🤖 Registered: ${peer.label}`);

      // Broadcast ANNOUNCE to all other peers so they know who's online
      broadcast(msg, ws);
      return;
    }

    // Re-register if DID changes (shouldn't happen but be safe)
    if (msg.from && msg.from !== peer.did) {
      if (peer.did) didIndex.delete(peer.did);
      peer.did = msg.from;
      didIndex.set(msg.from, ws);
    }

    const fromLabel = peer.label;
    const msgPreview = JSON.stringify(msg.payload).slice(0, 60);

    // Route by recipient
    if (msg.to === '*') {
      console.log(`[relay] 📢 broadcast ${msg.type} from ${fromLabel}`);
      broadcast(msg, ws);
    } else {
      const recipientWs = didIndex.get(msg.to);
      if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
        const recipientPeer = peers.get(recipientWs);
        console.log(`[relay] 📨 ${msg.type} ${fromLabel} → ${recipientPeer?.label ?? msg.to.slice(-8)}`);
        console.log(`        ${msgPreview}`);
        recipientWs.send(data.toString()); // forward raw — don't touch signatures
      } else {
        console.warn(`[relay] ❓ Unknown/offline recipient: ${msg.to.slice(-12)}`);
        // Send back a routing error
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            nexus: '0.1',
            type: 'error',
            from: 'relay',
            to: msg.from,
            payload: { error: 'recipient_not_found', did: msg.to },
            timestamp: Date.now(),
          }));
        }
      }
    }
  });

  ws.on('close', () => {
    if (peer.did) {
      didIndex.delete(peer.did);
      // Broadcast offline notice
      broadcast({
        nexus: '0.1',
        id: crypto.randomUUID(),
        type: 'HEARTBEAT',
        from: peer.did,
        to: '*',
        payload: { status: 'offline' },
        timestamp: Date.now(),
        sig: 'relay-generated',
      }, ws);
    }
    peers.delete(ws);
    console.log(`[relay] ➖ Disconnected: ${peer.label} (${peers.size} remaining)`);
  });

  ws.on('error', (err) => {
    console.error(`[relay] Error from ${peer.label}:`, err.message);
  });
});

function broadcast(msg: NexusMessage, excludeWs: WebSocket) {
  const data = JSON.stringify(msg);
  for (const [ws] of peers) {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

// Status dump every 30s
setInterval(() => {
  if (peers.size > 0) {
    console.log(`\n[relay] 📊 Status: ${peers.size} connected`);
    for (const peer of peers.values()) {
      const uptime = Math.round((Date.now() - peer.connectedAt) / 1000);
      console.log(`   ${peer.label.padEnd(30)} ${peer.messageCount} msgs  ${uptime}s uptime`);
    }
    console.log();
  }
}, 30_000);

console.log('Waiting for agents to connect...\n');
