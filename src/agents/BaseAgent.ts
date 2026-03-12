/**
 * BaseAgent - Abstract base class for all agent types
 *
 * Provides unified interface for Claude API, Ollama, and custom agents
 * Each agent operates independently without OAuth token sharing
 */

export interface AgentConfig {
  id: string
  name: string
  type: 'claude' | 'ollama' | 'custom' | 'human'
  model: string
  color: string
  avatar: string
  enabled: boolean
  auth: {
    type: 'api_key' | 'local' | 'custom'
    keyEnv?: string
    endpoint?: string
    customAuth?: Record<string, any>
  }
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AgentResponse {
  content: string
  toolUses?: ToolUse[]
  stopReason: string
}

export interface ToolUse {
  id: string
  name: string
  input: Record<string, any>
}

export interface AgentEvent {
  agentId: string
  sessionId: string
  type: 'session_start' | 'pre_tool_use' | 'post_tool_use' | 'stop' | 'notification'
  timestamp: number
  tool?: string
  toolInput?: Record<string, any>
  message?: string
  data?: Record<string, any>
}

/**
 * Abstract base agent class
 */
export abstract class BaseAgent {
  protected config: AgentConfig
  protected sessionId: string
  protected messageHistory: AgentMessage[] = []

  constructor(config: AgentConfig) {
    this.config = config
    this.sessionId = `${config.id}-${Date.now()}`
  }

  /**
   * Get agent identity
   */
  getId(): string {
    return this.config.id
  }

  getType(): string {
    return this.config.type
  }

  getName(): string {
    return this.config.name
  }

  getColor(): string {
    return this.config.color
  }

  getAvatar(): string {
    return this.config.avatar
  }

  getSessionId(): string {
    return this.sessionId
  }

  /**
   * Check if agent is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled
  }

  /**
   * Authentication - each agent handles own auth
   */
  protected abstract authenticate(): Promise<boolean>

  /**
   * Send message to agent's AI model
   */
  abstract sendMessage(message: string, systemPrompt?: string): Promise<AgentResponse>

  /**
   * Execute a tool on behalf of the agent
   */
  abstract executeTool(tool: ToolUse): Promise<any>

  /**
   * Emit an event to VibeCraft
   */
  abstract emitEvent(event: Omit<AgentEvent, 'agentId' | 'sessionId' | 'timestamp'>): void

  /**
   * Start a new session
   */
  async startSession(task: string): Promise<void> {
    this.sessionId = `${this.config.id}-${Date.now()}`
    this.messageHistory = []

    this.emitEvent({
      type: 'session_start',
      message: `${this.config.name} started working on: ${task}`,
      data: { task }
    })
  }

  /**
   * Stop the current session
   */
  async stopSession(reason: string = 'completed'): Promise<void> {
    this.emitEvent({
      type: 'stop',
      message: `${this.config.name} stopped: ${reason}`,
      data: { reason }
    })
  }

  /**
   * Reset agent state
   */
  reset(): void {
    this.messageHistory = []
  }
}
