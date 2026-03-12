/**
 * Vibecraft Agent Bridge
 *
 * Connects the AgentBus to the existing Vibecraft WebSocket server.
 * Agents appear as sessions in the Vibecraft UI — their tool calls,
 * messages, and context updates flow into the activity feed and 3D scene.
 */

import { WebSocket, WebSocketServer } from 'ws';
import { AgentBus, AgentMessage } from './agent-bus.js';

interface VibecraftEvent {
  type: string;
  sessionId?: string;
  tool?: string;
  path?: string;
  content?: string;
  [key: string]: unknown;
}

export class AgentBridge {
  private wss: WebSocketServer | null = null;
  private vibecraftWs: WebSocket | null = null;
  private bus: AgentBus;
  private vibecraftUrl: string;

  constructor(bus: AgentBus, vibecraftUrl = 'ws://localhost:4003') {
    this.bus = bus;
    this.vibecraftUrl = vibecraftUrl;
    this.setupBusListeners();
  }

  // Connect to the running vibecraft WebSocket server
  connectToVibecraft(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.vibecraftWs = new WebSocket(this.vibecraftUrl);

      this.vibecraftWs.on('open', () => {
        console.log('[Bridge] ✅ Connected to Vibecraft at', this.vibecraftUrl);

        // Register all current agents as sessions
        for (const agent of this.bus.agents) {
          this.sendToVibecraft({
            type: 'session_create',
            sessionId: agent.id,
            name: `${agent.role} [${agent.id.slice(-6)}]`,
            flags: agent.capabilities.join(' '),
          });
        }

        resolve();
      });

      this.vibecraftWs.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString()) as VibecraftEvent;
          this.handleVibecraftMessage(msg);
        } catch { /* ignore parse errors */ }
      });

      this.vibecraftWs.on('error', reject);
      this.vibecraftWs.on('close', () => {
        console.log('[Bridge] Vibecraft connection closed');
        this.vibecraftWs = null;
      });
    });
  }

  private handleVibecraftMessage(msg: VibecraftEvent): void {
    // Allow sending prompts from vibecraft UI to specific agents
    if (msg.type === 'prompt' && msg.sessionId && msg.content) {
      const agentId = msg.sessionId;
      const busMsg = this.bus.createMessage('vibecraft-ui', agentId, 'task', {
        title: 'User prompt',
        description: msg.content,
      });
      // Note: UI messages skip trust filter since they come from the user
      this.bus.send(busMsg);
    }
  }

  private setupBusListeners(): void {
    // Forward all bus events to Vibecraft UI

    this.bus.on('message:delivered', (msg: AgentMessage) => {
      if (msg.type === 'task') {
        this.sendToVibecraft({
          type: 'tool_call',
          sessionId: msg.from,
          tool: 'Task',
          path: (msg.payload as { title: string }).title,
          content: JSON.stringify(msg.payload),
        });
      }
    });

    this.bus.on('message:broadcast', (msg: AgentMessage) => {
      this.sendToVibecraft({
        type: 'activity',
        sessionId: msg.from,
        content: `📢 Broadcast: ${JSON.stringify(msg.payload).slice(0, 100)}`,
      });
    });

    this.bus.on('context:updated', (entry: { key: string; content: string; source: string }) => {
      this.sendToVibecraft({
        type: 'tool_call',
        sessionId: entry.source,
        tool: 'Write',
        path: `context:${entry.key}`,
        content: entry.content.slice(0, 200),
      });
    });

    this.bus.on('bus:security_violation', (event: { msg: AgentMessage; reason: string }) => {
      this.sendToVibecraft({
        type: 'activity',
        sessionId: event.msg.from,
        content: `🚨 SECURITY: ${event.reason}`,
        level: 'error',
      });
    });

    this.bus.on('agent:registered', (identity: { id: string; role: string; capabilities: string[] }) => {
      this.sendToVibecraft({
        type: 'session_create',
        sessionId: identity.id,
        name: `${identity.role} [${identity.id.slice(-6)}]`,
        flags: identity.capabilities.join(' '),
      });
    });

    this.bus.on('agent:unregistered', (agentId: string) => {
      this.sendToVibecraft({ type: 'session_end', sessionId: agentId });
    });
  }

  private sendToVibecraft(event: VibecraftEvent): void {
    if (this.vibecraftWs?.readyState === WebSocket.OPEN) {
      this.vibecraftWs.send(JSON.stringify(event));
    }
  }

  // Also expose a standalone WS server for direct agent connections
  startAgentServer(port = 4010): void {
    this.wss = new WebSocketServer({ port });
    console.log(`[Bridge] Agent WS server listening on :${port}`);

    this.wss.on('connection', (ws) => {
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString()) as AgentMessage;
          const result = this.bus.send(msg);
          ws.send(JSON.stringify({ ok: result.ok, reason: result.reason }));
        } catch (err) {
          ws.send(JSON.stringify({ ok: false, reason: String(err) }));
        }
      });
    });
  }

  close(): void {
    this.vibecraftWs?.close();
    this.wss?.close();
  }
}
