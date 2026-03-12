/**
 * SubagentManager - Manages subagent visualizations
 *
 * Tracks Task tool spawns and creates mini-Claude instances for each active subagent
 */

import type { WorkshopScene } from '../scene/WorkshopScene'
import { Claude, type ClaudeOptions } from './Claude'

export interface Subagent {
  id: string
  toolUseId: string
  claude: Claude
  spawnTime: number
  description?: string
}

// Different colors for subagents to distinguish them
const SUBAGENT_COLORS = [
  0x60a5fa, // Blue
  0x34d399, // Emerald
  0xf472b6, // Pink
  0xa78bfa, // Purple
  0xfbbf24, // Amber
  0x22d3ee, // Cyan
]

import { StationAssignmentManager } from './StationAssignmentManager'
import { taskRouter, agentRegistry, type AgentModel, type TaskType } from './AgentCapabilities'

export class SubagentManager {
  private scene: WorkshopScene
  private subagents: Map<string, Subagent> = new Map()
  private colorIndex = 0
  private stationManager = new StationAssignmentManager()

  constructor(scene: WorkshopScene) {
    this.scene = scene
  }

  /**
   * Spawn a new subagent when a Task tool starts
   * Automatically classifies task and registers with appropriate agent type
   */
  spawn(toolUseId: string, description?: string, tool?: string): Subagent {
    // Don't spawn duplicates
    if (this.subagents.has(toolUseId)) {
      return this.subagents.get(toolUseId)!
    }

    // Classify task and route to optimal agent
    const taskType: TaskType = tool ? taskRouter.classifyTask(tool, description) : 'implement'
    const agentModel: AgentModel = taskRouter.routeTask(taskType, description)
    const capability = taskRouter.getCapability(agentModel)

    // Use agent's color or fall back to default color scheme
    const color = capability.color || SUBAGENT_COLORS[this.colorIndex % SUBAGENT_COLORS.length]
    this.colorIndex++

    // Assign station (prefer agent's preferred stations)
    const assignedStation = this.stationManager.assignStation(toolUseId)

    // Register agent for tracking
    const registeredAgent = agentRegistry.register(toolUseId, agentModel, toolUseId)

    // Create mini-Claude at assigned station
    const options: ClaudeOptions = {
      scale: 0.6, // Smaller than main Claude
      color: color,
      statusColor: color,
      startStation: assignedStation,
    }

    const claude = new Claude(this.scene, options)
    claude.setState('thinking')

    // Start tracking this task
    agentRegistry.startTask(toolUseId, taskType, description || 'Task execution')

    const subagent: Subagent = {
      id: claude.id,
      toolUseId,
      claude,
      spawnTime: Date.now(),
      description,
    }

    this.subagents.set(toolUseId, subagent)
    console.log(`✨ ${capability.icon} ${agentModel.toUpperCase()} spawned: ${toolUseId} at ${assignedStation}`)
    console.log(`   Task type: ${taskType}, Description: ${description || 'none'}`)

    return subagent
  }

  /**
   * Remove a subagent when its Task completes
   * Logs final statistics and calculates token savings
   */
  remove(toolUseId: string, tokensUsed: number = 0): void {
    const subagent = this.subagents.get(toolUseId)
    if (subagent) {
      // Complete task tracking (log stats)
      if (tokensUsed > 0) {
        agentRegistry.completeTask(toolUseId, tokensUsed)
      }

      // Get final stats before unregistering
      const agent = agentRegistry.getAgent(toolUseId)
      if (agent) {
        const capability = taskRouter.getCapability(agent.model)
        const savings = taskRouter.estimateSavings(agent.model, agent.totalTokens)
        console.log(`✅ ${capability.icon} ${agent.model.toUpperCase()} completed: ${toolUseId}`)
        console.log(`   Stats: ${agent.tasksCompleted} tasks, ${agent.totalTokens} tokens`)
        console.log(`   Cost: $${agent.totalCost.toFixed(4)}, Saved: $${savings.toFixed(4)}`)
      }

      // Unregister agent
      agentRegistry.unregister(toolUseId)

      // Release station
      this.stationManager.releaseStation(toolUseId)

      // Dispose Claude entity
      subagent.claude.dispose()
      this.subagents.delete(toolUseId)
    }
  }

  /**
   * Get a subagent by toolUseId
   */
  get(toolUseId: string): Subagent | undefined {
    return this.subagents.get(toolUseId)
  }

  /**
   * Get all active subagents
   */
  getAll(): Subagent[] {
    return Array.from(this.subagents.values())
  }

  /**
   * Get count of active subagents
   */
  get count(): number {
    return this.subagents.size
  }

  /**
   * Clean up all subagents
   */
  dispose(): void {
    for (const subagent of this.subagents.values()) {
      subagent.claude.dispose()
    }
    this.subagents.clear()
  }
}
