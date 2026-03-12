/**
 * OllamaAgent - Local Ollama model implementation
 *
 * Connects to local Ollama server (no external API required)
 * Fully private and local execution
 */

import { BaseAgent, type AgentConfig, type AgentResponse, type ToolUse, type AgentEvent } from './BaseAgent'

export class OllamaAgent extends BaseAgent {
  private endpoint: string
  private eventCallback: ((event: AgentEvent) => void) | null = null

  constructor(config: AgentConfig, eventCallback?: (event: AgentEvent) => void) {
    super(config)
    this.endpoint = config.auth.endpoint || 'http://localhost:11434'
    this.eventCallback = eventCallback || null
  }

  /**
   * Authenticate (local Ollama doesn't require auth)
   */
  protected async authenticate(): Promise<boolean> {
    try {
      // Test connection to Ollama
      const response = await fetch(`${this.endpoint}/api/tags`)
      return response.ok
    } catch (error) {
      console.error(`[${this.config.name}] Cannot connect to Ollama at ${this.endpoint}`)
      return false
    }
  }

  /**
   * Send message to Ollama model
   */
  async sendMessage(message: string, systemPrompt?: string): Promise<AgentResponse> {
    // Add message to history
    this.messageHistory.push({ role: 'user', content: message })

    // Build prompt from history
    let fullPrompt = ''
    if (systemPrompt) {
      fullPrompt += `System: ${systemPrompt}\n\n`
    }
    for (const msg of this.messageHistory) {
      fullPrompt += `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}\n\n`
    }

    try {
      const response = await fetch(`${this.endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model,
          prompt: fullPrompt,
          stream: false
        })
      })

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`)
      }

      const data = await response.json()
      const content = data.response || ''

      // Add to history
      this.messageHistory.push({ role: 'assistant', content })

      return {
        content,
        toolUses: [], // Ollama doesn't natively support tool use
        stopReason: 'end_turn'
      }
    } catch (error) {
      console.error(`[${this.config.name}] Ollama call failed:`, error)
      throw error
    }
  }

  /**
   * Execute a tool (Ollama-specific implementation)
   */
  async executeTool(tool: ToolUse): Promise<any> {
    this.emitEvent({
      type: 'pre_tool_use',
      tool: tool.name,
      toolInput: tool.input,
      message: `Executing ${tool.name}`
    })

    // Ollama tool execution (simplified)
    const result = {}

    this.emitEvent({
      type: 'post_tool_use',
      tool: tool.name,
      message: `Completed ${tool.name}`,
      data: result
    })

    return result
  }

  /**
   * Emit event to VibeCraft
   */
  emitEvent(event: Omit<AgentEvent, 'agentId' | 'sessionId' | 'timestamp'>): void {
    const fullEvent: AgentEvent = {
      ...event,
      agentId: this.config.id,
      sessionId: this.sessionId,
      timestamp: Date.now()
    }

    if (this.eventCallback) {
      this.eventCallback(fullEvent)
    }

    // Send to VibeCraft server if available
    if (typeof fetch !== 'undefined') {
      fetch('/api/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullEvent)
      }).catch(err => console.warn(`[${this.config.name}] Failed to send event:`, err))
    }
  }
}
