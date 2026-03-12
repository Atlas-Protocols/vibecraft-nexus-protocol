/**
 * AgentManager - Manages multiple agents and routes events
 *
 * Handles agent lifecycle, event routing, and workspace coordination
 */

import { BaseAgent, type AgentConfig, type AgentEvent } from './BaseAgent'
import { ClaudeAgent } from './ClaudeAgent'
import { OllamaAgent } from './OllamaAgent'

export class AgentManager {
  private agents: Map<string, BaseAgent> = new Map()
  private eventCallback: ((event: AgentEvent) => void) | null = null

  constructor(eventCallback?: (event: AgentEvent) => void) {
    this.eventCallback = eventCallback || null
  }

  /**
   * Load agents from config
   */
  async loadAgents(config: { agents: AgentConfig[] }): Promise<void> {
    for (const agentConfig of config.agents) {
      if (!agentConfig.enabled) {
        console.log(`[AgentManager] Skipping disabled agent: ${agentConfig.name}`)
        continue
      }

      try {
        const agent = this.createAgent(agentConfig)
        this.agents.set(agentConfig.id, agent)
        console.log(`[AgentManager] Loaded agent: ${agentConfig.name} (${agentConfig.type})`)
      } catch (error) {
        console.error(`[AgentManager] Failed to load agent ${agentConfig.name}:`, error)
      }
    }
  }

  /**
   * Create agent instance based on type
   */
  private createAgent(config: AgentConfig): BaseAgent {
    const handleEvent = (event: AgentEvent) => {
      if (this.eventCallback) {
        this.eventCallback(event)
      }
    }

    switch (config.type) {
      case 'claude':
        return new ClaudeAgent(config, handleEvent)
      case 'ollama':
        return new OllamaAgent(config, handleEvent)
      default:
        throw new Error(`Unsupported agent type: ${config.type}`)
    }
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): BaseAgent | undefined {
    return this.agents.get(agentId)
  }

  /**
   * Get all agents
   */
  getAllAgents(): BaseAgent[] {
    return Array.from(this.agents.values())
  }

  /**
   * Get active agents (with active sessions)
   */
  getActiveAgents(): BaseAgent[] {
    // Filter by session activity
    return this.getAllAgents().filter(agent => agent.isEnabled())
  }

  /**
   * Start a task for a specific agent
   */
  async startTask(agentId: string, task: string): Promise<void> {
    const agent = this.getAgent(agentId)
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`)
    }

    await agent.startSession(task)
  }

  /**
   * Stop a task for a specific agent
   */
  async stopTask(agentId: string, reason?: string): Promise<void> {
    const agent = this.getAgent(agentId)
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`)
    }

    await agent.stopSession(reason)
  }

  /**
   * Send message to a specific agent
   */
  async sendMessage(agentId: string, message: string, systemPrompt?: string): Promise<string> {
    const agent = this.getAgent(agentId)
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`)
    }

    const response = await agent.sendMessage(message, systemPrompt)
    return response.content
  }

  /**
   * Get agent status summary
   */
  getStatus(): {
    total: number
    active: number
    agents: Array<{
      id: string
      name: string
      type: string
      enabled: boolean
      color: string
      avatar: string
    }>
  } {
    const all = this.getAllAgents()
    const active = this.getActiveAgents()

    return {
      total: all.length,
      active: active.length,
      agents: all.map(agent => ({
        id: agent.getId(),
        name: agent.getName(),
        type: this.agents.get(agent.getId())!.constructor.name,
        enabled: agent.isEnabled(),
        color: agent.getColor(),
        avatar: agent.getAvatar()
      }))
    }
  }

  /**
   * Shutdown all agents
   */
  async shutdown(): Promise<void> {
    const stopPromises = Array.from(this.agents.values()).map(agent =>
      agent.stopSession('shutdown')
    )
    await Promise.all(stopPromises)
    this.agents.clear()
  }
}
