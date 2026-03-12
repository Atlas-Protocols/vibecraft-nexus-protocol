/**
 * BaseAgent — All vibecraft agents extend this.
 *
 * Each agent:
 *   1. Has a fixed identity (role, capabilities, trust level)
 *   2. Runs a process loop (poll → think → act → respond)
 *   3. Can read/write shared context via the hub
 *   4. Cannot modify its own identity after boot
 *   5. Logs all actions for auditability
 */

import { AgentBus, AgentIdentity, AgentMessage, AgentRole, TaskPayload, ResultPayload } from './agent-bus.js';
import * as crypto from 'crypto';

export interface AgentConfig {
  id?: string;
  role: AgentRole;
  capabilities: string[];
  trustLevel: 1 | 2 | 3;
  pollIntervalMs?: number;
}

export abstract class BaseAgent {
  readonly identity: AgentIdentity;
  protected bus: AgentBus;
  protected running = false;
  protected actionLog: { ts: number; action: string; detail?: unknown }[] = [];
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private busSecret: string;

  constructor(config: AgentConfig, bus: AgentBus) {
    // Identity is sealed at construction — cannot be changed
    this.identity = Object.freeze({
      id: config.id ?? `${config.role}-${crypto.randomBytes(4).toString('hex')}`,
      role: config.role,
      capabilities: [...config.capabilities],
      publicKey: crypto.randomBytes(16).toString('hex'), // simplified
      trustLevel: config.trustLevel,
    });
    this.bus = bus;
    this.busSecret = bus.register(this.identity);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  start(pollIntervalMs = 500): void {
    if (this.running) return;
    this.running = true;
    this.log('start', `Agent ${this.identity.id} online`);
    this.pollInterval = setInterval(() => this.tick(), pollIntervalMs);
    this.onStart();
  }

  stop(): void {
    this.running = false;
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.bus.unregister(this.identity.id);
    this.log('stop', `Agent ${this.identity.id} offline`);
    this.onStop();
  }

  // ── Message loop ──────────────────────────────────────────────────────────

  private async tick(): Promise<void> {
    const messages = this.bus.receive(this.identity.id);
    for (const msg of messages) {
      await this.handleMessage(msg);
    }
  }

  private async handleMessage(msg: AgentMessage): Promise<void> {
    this.log('receive', `${msg.type} from ${msg.from}`);

    try {
      switch (msg.type) {
        case 'task':
          await this.handleTask(msg);
          break;
        case 'result':
          await this.onResult(msg, msg.payload as ResultPayload);
          break;
        case 'broadcast':
          await this.onBroadcast(msg);
          break;
        case 'heartbeat':
          this.send(msg.from, 'heartbeat', { status: 'alive', role: this.identity.role });
          break;
        case 'error':
          await this.onError(msg);
          break;
      }
    } catch (err) {
      this.log('error', `Failed to handle ${msg.type}`, err);
      this.send(msg.from, 'error', {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async handleTask(msg: AgentMessage): Promise<void> {
    const task = msg.payload as TaskPayload;
    this.log('task:start', task.title);

    // Pull required context before working
    if (task.context?.length) {
      for (const key of task.context) {
        const entry = this.bus.hub.get(key);
        if (entry) {
          this.log('context:loaded', key);
        }
      }
    }

    const result = await this.executeTask(task, msg);
    this.log('task:complete', task.title, { success: result.success });

    // Push any annotations back to the hub
    if (result.contextAnnotations?.length) {
      for (const ann of result.contextAnnotations) {
        this.pushContext(ann.key, ann.note);
      }
    }

    // Send result back to sender
    this.send(msg.from, 'result', result, msg.id);
  }

  // ── Messaging helpers ─────────────────────────────────────────────────────

  protected send(to: string | 'all', type: AgentMessage['type'], payload: unknown, replyTo?: string): void {
    const msg = this.bus.createMessage(this.identity.id, to, type, payload, replyTo);
    const result = this.bus.send(msg);
    if (!result.ok) {
      this.log('send:blocked', result.reason);
    }
  }

  protected task(to: string, title: string, description: string, extras?: Partial<TaskPayload>): void {
    this.send(to, 'task', { title, description, ...extras } as TaskPayload);
  }

  protected pushContext(key: string, content: string): void {
    this.send(this.identity.id, 'context_push', { key, content });
    // Direct hub write (bypasses message routing since it's self)
    this.bus.hub.set(key, content, this.identity.id);
  }

  protected pullContext(key: string): string | undefined {
    return this.bus.hub.get(key)?.content;
  }

  protected broadcast(payload: unknown): void {
    this.send('all', 'broadcast', payload);
  }

  // ── Audit logging ─────────────────────────────────────────────────────────

  protected log(action: string, detail?: unknown, extra?: unknown): void {
    const entry = { ts: Date.now(), action, detail, extra };
    this.actionLog.push(entry);
    console.log(`[${this.identity.role}:${this.identity.id.slice(-6)}] ${action}`, detail ?? '');
  }

  getAuditLog() {
    return [...this.actionLog];
  }

  // ── Abstract interface (subclasses implement) ─────────────────────────────

  abstract executeTask(task: TaskPayload, msg: AgentMessage): Promise<ResultPayload>;

  protected onStart(): void {}
  protected onStop(): void {}
  protected async onResult(_msg: AgentMessage, _result: ResultPayload): Promise<void> {}
  protected async onBroadcast(_msg: AgentMessage): Promise<void> {}
  protected async onError(_msg: AgentMessage): Promise<void> {}
}
