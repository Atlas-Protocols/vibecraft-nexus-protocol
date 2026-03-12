/**
 * nexus-transport.ts
 * WebSocket transport adapter for NexusNode.
 * Connects a local NexusNode to the relay server,
 * handles reconnection, and bridges messages in both directions.
 */

import { WebSocket } from 'ws';
import { NexusMessage, NexusNode, NexusIdentity } from '../nexus-protocol/nexus.js';

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const RECONNECT_JITTER_MS = 500;

export class NexusTransport {
  private ws: WebSocket | null = null;
  private relayUrl: string;
  private identity: NexusIdentity;
  private node: NexusNode;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private messageHandlers: ((msg: NexusMessage) => void)[] = [];
  private connected = false;
  private intentionallyClosed = false;

  constructor(node: NexusNode, identity: NexusIdentity) {
    this.node = node;
    this.identity = identity;
    this.relayUrl = '';
  }

  async connect(relayUrl: string): Promise<void> {
    this.relayUrl = relayUrl;
    this.intentionallyClosed = false;
    return this._connect();
  }

  private _connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`[transport] Connecting to relay: ${this.relayUrl}`);
      this.ws = new WebSocket(this.relayUrl);

      this.ws.on('open', async () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        console.log(`[transport] ✅ Connected to relay`);

        // Announce ourselves immediately
        const announcement = await this.node.announce('*');
        this.send(announcement);

        // Start heartbeat
        this._startHeartbeat();

        resolve();
      });

      this.ws.on('message', async (data) => {
        let msg: NexusMessage;
        try {
          msg = JSON.parse(data.toString()) as NexusMessage;
        } catch {
          console.warn('[transport] Received non-JSON message');
          return;
        }

        // Skip relay-generated messages (like offline notices)
        if (msg.sig === 'relay-generated') {
          console.log(`[transport] 📢 ${msg.from.slice(-8)} went ${(msg.payload as { status: string }).status}`);
          return;
        }

        console.log(`[transport] 📨 ${msg.type} from ${msg.from.slice(-12)}`);

        // Let the NexusNode verify and handle
        const result = await this.node.receive(msg);
        if (!result.ok) {
          console.warn(`[transport] ❌ Rejected: ${result.reason}`);
          return;
        }

        // Call any external handlers
        for (const handler of this.messageHandlers) {
          handler(msg);
        }
      });

      this.ws.on('close', () => {
        this.connected = false;
        console.log('[transport] Connection closed');
        if (!this.intentionallyClosed) {
          this._scheduleReconnect();
        }
      });

      this.ws.on('error', (err) => {
        console.error('[transport] WebSocket error:', err.message);
        if (!this.connected) {
          reject(err);
        }
      });
    });
  }

  send(msg: NexusMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      console.warn('[transport] Cannot send — not connected');
    }
  }

  onMessage(handler: (msg: NexusMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  close(): void {
    this.intentionallyClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }

  get isConnected(): boolean {
    return this.connected;
  }

  private _scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(
      RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempts - 1) +
        Math.random() * RECONNECT_JITTER_MS,
      RECONNECT_MAX_MS
    );
    console.log(`[transport] Reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => this._connect().catch(console.error), delay);
  }

  private _heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private _startHeartbeat(): void {
    if (this._heartbeatInterval) clearInterval(this._heartbeatInterval);
    this._heartbeatInterval = setInterval(async () => {
      if (this.connected) {
        const hb = await this.node.heartbeat('idle');
        this.send(hb);
      }
    }, 15_000);
  }
}
