/**
 * ClaudeAgent - Claude API implementation without OAuth
 *
 * Uses direct API key authentication (no Claude Code OAuth tokens)
 * Each agent instance uses its own API key from environment
 */

import { BaseAgent, type AgentConfig, type AgentResponse, type AgentMessage, type ToolUse, type AgentEvent } from './BaseAgent'

export class ClaudeAgent extends BaseAgent {
  private apiKey: string | null = null
  private apiEndpoint: string = 'https://api.anthropic.com/v1/messages'
  private eventCallback: ((event: AgentEvent) => void) | null = null

  constructor(config: AgentConfig, eventCallback?: (event: AgentEvent) => void) {
    super(config)
    this.eventCallback = eventCallback || null
  }

  /**
   * Authenticate using API key from environment
   */
  protected async authenticate(): Promise<boolean> {
    if (this.config.auth.type !== 'api_key' || !this.config.auth.keyEnv) {
      console.error(`[${this.config.name}] Invalid auth config`)
      return false
    }

    // In Node.js environment, read from process.env
    // In browser, this would come from user input or secure storage
    this.apiKey = process.env[this.config.auth.keyEnv] || null

    if (!this.apiKey) {
      console.warn(`[${this.config.name}] API key not found in ${this.config.auth.keyEnv}`)
      return false
    }

    return true
  }

  /**
   * Send message to Claude API
   */
  async sendMessage(message: string, systemPrompt?: string): Promise<AgentResponse> {
    // Authenticate if needed
    if (!this.apiKey) {
      const authenticated = await this.authenticate()
      if (!authenticated) {
        throw new Error(`Authentication failed for ${this.config.name}`)
      }
    }

    // Add message to history
    this.messageHistory.push({ role: 'user', content: message })

    // Prepare request
    const requestBody = {
      model: this.config.model,
      max_tokens: 4096,
      messages: this.messageHistory,
      ...(systemPrompt && { system: systemPrompt })
    }

    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey!,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Claude API error: ${response.status} - ${error}`)
      }

      const data = await response.json()

      // Extract response content
      const content = data.content[0]?.text || ''
      const toolUses = data.content.filter((c: any) => c.type === 'tool_use')
      const stopReason = data.stop_reason

      // Add to history
      this.messageHistory.push({ role: 'assistant', content })

      return {
        content,
        toolUses,
        stopReason
      }
    } catch (error) {
      console.error(`[${this.config.name}] API call failed:`, error)
      throw error
    }
  }

  /**
   * Execute a tool (stub - implement based on tool type)
   */
  async executeTool(tool: ToolUse): Promise<any> {
    this.emitEvent({
      type: 'pre_tool_use',
      tool: tool.name,
      toolInput: tool.input,
      message: `Executing ${tool.name}`
    })

    // Tool execution logic would go here
    // For now, return empty result
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

    // Also send to VibeCraft server if available
    if (typeof fetch !== 'undefined') {
      fetch('/api/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullEvent)
      }).catch(err => console.warn(`[${this.config.name}] Failed to send event:`, err))
    }
  }
}
