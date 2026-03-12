/**
 * AgentCapabilities - Smart routing for different agent types
 * Routes tasks to optimal agents: Cove (lightweight), Ralph (analysis), Sonnet (general)
 */

import type { StationType } from '../../shared/types'

export type AgentModel = 'sonnet' | 'haiku' | 'opus' | 'cove' | 'ralph' | 'ollama'
export type AgentSpecialization = 'general' | 'lightweight' | 'analysis' | 'local'
export type TaskType =
  | 'read' | 'write' | 'edit' | 'search' | 'grep' | 'glob'
  | 'bash' | 'analyze' | 'plan' | 'implement' | 'test'
  | 'web_fetch' | 'web_search' | 'task' | 'review'

export interface AgentCapability {
  model: AgentModel
  specialization: AgentSpecialization
  costPerToken: number
  speedMultiplier: number // 1.0 = normal, 2.0 = 2x faster
  color: number // Visual color for this agent type
  icon: string
  preferredStations: StationType[] // Which stations this agent likes
  skillRatings: Record<TaskType, number> // 1-10 rating per task type
}

// Agent type definitions
export const AGENT_CAPABILITIES: Record<AgentModel, AgentCapability> = {
  sonnet: {
    model: 'sonnet',
    specialization: 'general',
    costPerToken: 3.0, // $3/M input tokens
    speedMultiplier: 1.0,
    color: 0xd4a574, // Warm beige (Claude's color)
    icon: '🧠',
    preferredStations: ['desk', 'terminal', 'workbench'],
    skillRatings: {
      read: 9, write: 9, edit: 9, search: 7, grep: 7, glob: 7,
      bash: 8, analyze: 9, plan: 9, implement: 10, test: 9,
      web_fetch: 8, web_search: 8, task: 9, review: 10
    }
  },

  haiku: {
    model: 'haiku',
    specialization: 'general',
    costPerToken: 0.25, // $0.25/M tokens (estimated)
    speedMultiplier: 3.0, // Much faster than Sonnet
    color: 0x60a5fa, // Blue
    icon: '⚡',
    preferredStations: ['terminal', 'scanner', 'portal'],
    skillRatings: {
      read: 8, write: 8, edit: 8, search: 9, grep: 9, glob: 9,
      bash: 9, analyze: 7, plan: 7, implement: 8, test: 8,
      web_fetch: 10, web_search: 10, task: 8, review: 7
    }
  },

  opus: {
    model: 'opus',
    specialization: 'general',
    costPerToken: 15.0, // $15/M input tokens
    speedMultiplier: 0.7, // Slower but more capable
    color: 0xa78bfa, // Purple
    icon: '👑',
    preferredStations: ['desk', 'workbench', 'taskboard'],
    skillRatings: {
      read: 10, write: 10, edit: 10, search: 8, grep: 8, glob: 8,
      bash: 9, analyze: 10, plan: 10, implement: 10, test: 10,
      web_fetch: 9, web_search: 9, task: 10, review: 10
    }
  },

  cove: {
    model: 'cove',
    specialization: 'lightweight',
    costPerToken: 0.10, // Ultra cheap
    speedMultiplier: 5.0, // Very fast
    color: 0x34d399, // Emerald green
    icon: '🌿',
    preferredStations: ['scanner', 'bookshelf', 'antenna'],
    skillRatings: {
      read: 10, write: 6, edit: 6, search: 10, grep: 10, glob: 10,
      bash: 5, analyze: 6, plan: 6, implement: 6, test: 7,
      web_fetch: 9, web_search: 9, task: 7, review: 6
    }
  },

  ralph: {
    model: 'ralph',
    specialization: 'analysis',
    costPerToken: 1.5, // Mid-range
    speedMultiplier: 1.5,
    color: 0xfbbf24, // Amber
    icon: '📊',
    preferredStations: ['desk', 'bookshelf', 'taskboard'],
    skillRatings: {
      read: 8, write: 7, edit: 7, search: 9, grep: 9, glob: 9,
      bash: 6, analyze: 10, plan: 10, implement: 7, test: 9,
      web_fetch: 8, web_search: 8, task: 8, review: 10
    }
  },

  ollama: {
    model: 'ollama',
    specialization: 'local',
    costPerToken: 0.0, // Free (local)
    speedMultiplier: 0.5, // Slower (depends on hardware)
    color: 0x22d3ee, // Cyan
    icon: '🏠',
    preferredStations: ['terminal', 'workbench', 'portal'],
    skillRatings: {
      read: 7, write: 7, edit: 7, search: 7, grep: 7, glob: 7,
      bash: 10, analyze: 6, plan: 6, implement: 7, test: 7,
      web_fetch: 5, web_search: 5, task: 7, review: 6
    }
  }
}

/**
 * Task Router - Routes tasks to optimal agents
 */
export class TaskRouter {
  /**
   * Classify task type based on tool name and description
   */
  classifyTask(tool: string, description?: string): TaskType {
    const toolLower = tool.toLowerCase()
    const descLower = description?.toLowerCase() || ''

    // File operations
    if (toolLower === 'read' || descLower.includes('read file')) return 'read'
    if (toolLower === 'write' || descLower.includes('write file')) return 'write'
    if (toolLower === 'edit' || descLower.includes('edit file')) return 'edit'

    // Search operations
    if (toolLower === 'grep' || descLower.includes('search')) return 'grep'
    if (toolLower === 'glob' || descLower.includes('find files')) return 'glob'

    // Execution
    if (toolLower === 'bash' || toolLower === 'shell') return 'bash'

    // Complex operations
    if (toolLower === 'task' && descLower.includes('explore')) return 'search'
    if (toolLower === 'task' && descLower.includes('plan')) return 'plan'
    if (toolLower === 'task' && descLower.includes('analyze')) return 'analyze'
    if (descLower.includes('review') || descLower.includes('architecture')) return 'review'

    // Web operations
    if (toolLower === 'webfetch') return 'web_fetch'
    if (toolLower === 'websearch') return 'web_search'

    // Default to implementation
    return 'implement'
  }

  /**
   * Route task to optimal agent based on task type
   */
  routeTask(taskType: TaskType, context?: string): AgentModel {
    // Lightweight tasks → Cove
    if (['read', 'grep', 'glob', 'search'].includes(taskType)) {
      return 'cove'
    }

    // Analysis tasks → Ralph
    if (['analyze', 'review', 'plan'].includes(taskType)) {
      return 'ralph'
    }

    // Web operations → Haiku (fast, cheap)
    if (['web_fetch', 'web_search'].includes(taskType)) {
      return 'haiku'
    }

    // Complex implementation → Sonnet (default)
    if (['implement', 'write', 'edit', 'task'].includes(taskType)) {
      // Check context for complexity indicators
      if (context && this.isComplexTask(context)) {
        return 'sonnet'
      }
      return 'haiku' // Most tasks can use faster Haiku
    }

    // Bash commands → Ollama (free, local)
    if (taskType === 'bash') {
      return 'ollama'
    }

    // Default to Sonnet for general work
    return 'sonnet'
  }

  /**
   * Determine if task is complex enough to need Sonnet
   */
  private isComplexTask(context: string): boolean {
    const complexityIndicators = [
      'multi-file',
      'refactor',
      'architecture',
      'design pattern',
      'complex logic',
      'algorithm',
      'optimization',
      'security',
      'performance'
    ]

    return complexityIndicators.some(indicator =>
      context.toLowerCase().includes(indicator)
    )
  }

  /**
   * Get agent capability info
   */
  getCapability(model: AgentModel): AgentCapability {
    return AGENT_CAPABILITIES[model]
  }

  /**
   * Estimate cost savings vs always using Sonnet
   */
  estimateSavings(model: AgentModel, tokens: number): number {
    const sonnetCost = AGENT_CAPABILITIES.sonnet.costPerToken
    const modelCost = AGENT_CAPABILITIES[model].costPerToken
    const savings = (sonnetCost - modelCost) * (tokens / 1_000_000)
    return Math.max(0, savings) // Return dollars saved
  }

  /**
   * Get all available agents and their stats
   */
  getAvailableAgents(): AgentCapability[] {
    return Object.values(AGENT_CAPABILITIES)
  }

  /**
   * Recommend best agent for a given budget and task
   */
  recommendAgent(
    taskType: TaskType,
    budget: number, // dollars
    tokens: number // estimated tokens
  ): AgentModel {
    const defaultAgent = this.routeTask(taskType)
    const defaultCost = (AGENT_CAPABILITIES[defaultAgent].costPerToken * tokens) / 1_000_000

    // If within budget, use recommended agent
    if (defaultCost <= budget) {
      return defaultAgent
    }

    // Fall back to cheaper options
    if (taskType === 'analyze' || taskType === 'review') {
      return 'cove' // Cheaper than Ralph
    }

    return 'ollama' // Free fallback
  }

  /**
   * Get capable agents for a task type ranked by skill
   */
  getCapableAgents(taskType: TaskType, minSkill: number = 5): AgentModel[] {
    const agents = Object.values(AGENT_CAPABILITIES)
      .filter(agent => agent.skillRatings[taskType] >= minSkill)
      .sort((a, b) => b.skillRatings[taskType] - a.skillRatings[taskType])
      .map(agent => agent.model);

    return agents;
  }
}

/**
 * Agent Registry - Register and track active agents
 */
export interface RegisteredAgent {
  id: string
  model: AgentModel
  toolUseId?: string
  spawnTime: number
  totalTokens: number
  totalCost: number
  tasksCompleted: number
  currentTask?: {
    type: TaskType
    description: string
    startTime: number
  }
}

export class AgentRegistry {
  private agents: Map<string, RegisteredAgent> = new Map()
  private router = new TaskRouter()

  /**
   * Register a new agent and start tracking it immediately
   */
  register(id: string, model: AgentModel, toolUseId?: string): RegisteredAgent {
    const agent: RegisteredAgent = {
      id,
      model,
      toolUseId,
      spawnTime: Date.now(),
      totalTokens: 0,
      totalCost: 0,
      tasksCompleted: 0
    }

    this.agents.set(id, agent)
    console.log(`[AgentRegistry] Registered ${model} agent: ${id}`)

    return agent
  }

  /**
   * Unregister agent when complete
   */
  unregister(id: string): void {
    const agent = this.agents.get(id)
    if (agent) {
      console.log(`[AgentRegistry] Unregistered ${agent.model} agent: ${id}`)
      console.log(`  Stats: ${agent.tasksCompleted} tasks, ${agent.totalTokens} tokens, $${agent.totalCost.toFixed(4)}`)
      this.agents.delete(id)
    }
  }

  /**
   * Track task start for an agent
   */
  startTask(id: string, taskType: TaskType, description: string): void {
    const agent = this.agents.get(id)
    if (agent) {
      agent.currentTask = {
        type: taskType,
        description,
        startTime: Date.now()
      }
    }
  }

  /**
   * Track task completion and update stats
   */
  completeTask(id: string, tokens: number): void {
    const agent = this.agents.get(id)
    if (agent) {
      const capability = this.router.getCapability(agent.model)
      const cost = (capability.costPerToken * tokens) / 1_000_000

      agent.totalTokens += tokens
      agent.totalCost += cost
      agent.tasksCompleted++
      agent.currentTask = undefined

      console.log(`[AgentRegistry] ${agent.model} completed task: ${tokens} tokens, $${cost.toFixed(4)}`)
    }
  }

  /**
   * Get agent by ID
   */
  getAgent(id: string): RegisteredAgent | undefined {
    return this.agents.get(id)
  }

  /**
   * Get all active agents
   */
  getAllAgents(): RegisteredAgent[] {
    return Array.from(this.agents.values())
  }

  /**
   * Get aggregated statistics
   */
  getStats() {
    const agents = Array.from(this.agents.values())

    return {
      activeAgents: agents.length,
      totalTokens: agents.reduce((sum, a) => sum + a.totalTokens, 0),
      totalCost: agents.reduce((sum, a) => sum + a.totalCost, 0),
      totalTasks: agents.reduce((sum, a) => sum + a.tasksCompleted, 0),
      byModel: this.groupByModel(agents)
    }
  }

  private groupByModel(agents: RegisteredAgent[]) {
    const grouped: Record<AgentModel, { count: number, tokens: number, cost: number }> = {
      sonnet: { count: 0, tokens: 0, cost: 0 },
      haiku: { count: 0, tokens: 0, cost: 0 },
      opus: { count: 0, tokens: 0, cost: 0 },
      cove: { count: 0, tokens: 0, cost: 0 },
      ralph: { count: 0, tokens: 0, cost: 0 },
      ollama: { count: 0, tokens: 0, cost: 0 }
    }

    for (const agent of agents) {
      grouped[agent.model].count++
      grouped[agent.model].tokens += agent.totalTokens
      grouped[agent.model].cost += agent.totalCost
    }

    return grouped
  }

  /**
   * Calculate total savings vs all-Sonnet approach
   */
  calculateSavings(): number {
    const agents = Array.from(this.agents.values())
    let totalSavings = 0

    for (const agent of agents) {
      if (agent.model !== 'sonnet') {
        const sonnetCost = (AGENT_CAPABILITIES.sonnet.costPerToken * agent.totalTokens) / 1_000_000
        totalSavings += (sonnetCost - agent.totalCost)
      }
    }

    return totalSavings
  }
}

// Export singleton instances
export const taskRouter = new TaskRouter()
export const agentRegistry = new AgentRegistry()
