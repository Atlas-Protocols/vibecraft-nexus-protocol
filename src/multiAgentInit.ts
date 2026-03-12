/**
 * Multi-Agent Initialization
 *
 * Setup and initialize all agents for collaborative work
 * This module can be imported into main.ts when ready to activate
 */

import { AgentManager } from './agents/AgentManager'
import { MultiAgentScene } from './scene/MultiAgentScene'
import { AgentDashboard } from './ui/AgentDashboard'
import type { AgentEvent } from './agents/BaseAgent'
import type * as THREE from 'three'

/**
 * Initialize multi-agent system
 */
export async function initMultiAgentSystem(scene: THREE.Scene): Promise<{
  agentManager: AgentManager
  multiAgentScene: MultiAgentScene
  dashboard: AgentDashboard
}> {
  console.log('[MultiAgent] Initializing multi-agent system...')

  // Create event handler for VibeCraft integration
  const handleAgentEvent = (event: AgentEvent) => {
    console.log(`[MultiAgent] Event from ${event.agentId}:`, event.type)

    // Send to VibeCraft server for WebSocket broadcast
    if (typeof fetch !== 'undefined') {
      fetch('/api/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      }).catch(err => console.warn('[MultiAgent] Failed to send event:', err))
    }

    // Update character animation
    if (multiAgentScene) {
      const activity = event.type === 'pre_tool_use' ? 'working' :
        event.type === 'stop' ? 'idle' :
          'thinking'
      multiAgentScene.updateCharacter(event.agentId, activity)

      // Pulse zone on task completion
      if (event.type === 'post_tool_use') {
        multiAgentScene.pulseZone(event.agentId)
      }
    }
  }

  // Create agent manager
  const agentManager = new AgentManager(handleAgentEvent)

  // Load config
  try {
    const configResponse = await fetch('/agents/config.json')
    const config = await configResponse.json()
    await agentManager.loadAgents(config)
    console.log('[MultiAgent] Loaded agents:', agentManager.getStatus())
  } catch (error) {
    console.error('[MultiAgent] Failed to load agent config:', error)
    // Continue with empty agent manager
  }

  // Create 3D scene for agents
  const multiAgentScene = new MultiAgentScene(scene)

  // Create character for each agent
  const agents = agentManager.getAllAgents()
  for (const agent of agents) {
    const character = multiAgentScene.createCharacter(agent)
    console.log(`[MultiAgent] Created character for ${agent.getName()}`)
  }

  // Create dashboard UI
  const dashboard = new AgentDashboard(agentManager)

  console.log('[MultiAgent] Multi-agent system ready!')

  // --------------------------------------------------------------------------
  // HACK: Inject "Sessions" for Agents so they appear as tabs in the UI
  // --------------------------------------------------------------------------
  // The main UI reads `state.managedSessions`. We can mock these.
  if ((window as any).state && (window as any).state.managedSessions) {
    const agents = agentManager.getAllAgents()
    const state = (window as any).state

    // We need to wait for the main app to initialize sessions, then append ours
    setTimeout(() => {
      const currentSessions = state.managedSessions || []

      agents.forEach(agent => {
        // Skip if already exists or is main "Business-OS" (which is likely the main session)
        if (agent.getId() === 'business-os') return

        const mockSession = {
          id: `session_${agent.getId()}`,
          name: agent.getName(),
          status: 'idle', // or 'working'
          type: 'agent', // Custom type to distinguish
          agentId: agent.getId(),
          tmuxSession: 'virtual', // No real tmux
          messages: [],
          stats: {
            tokens: 0,
            cost: 0
          }
        }

        // Check if already in list
        if (!currentSessions.find((s: any) => s.id === mockSession.id)) {
          currentSessions.push(mockSession)
        }
      })

      // Force update UI
      if (typeof (window as any).renderManagedSessions === 'function') {
        (window as any).renderManagedSessions()
      }
    }, 1000)
  }

  return {
    agentManager,
    multiAgentScene,
    dashboard
  }
}

/**
 * Example: Start all agents on a collaborative task
 */
export async function startCollaborativeTask(
  agentManager: AgentManager,
  taskDescription: string
): Promise<void> {
  const agents = agentManager.getAllAgents()

  console.log(`[MultiAgent] Starting collaborative task: ${taskDescription}`)

  // Assign subtasks to each agent
  const subtasks = [
    `Research: ${taskDescription}`,
    `Implementation: ${taskDescription}`,
    `Testing: ${taskDescription}`,
    `Documentation: ${taskDescription}`
  ]

  for (let i = 0; i < agents.length && i < subtasks.length; i++) {
    try {
      await agentManager.startTask(agents[i].getId(), subtasks[i])
      console.log(`[MultiAgent] Assigned to ${agents[i].getName()}: ${subtasks[i]}`)
    } catch (error) {
      console.error(`[MultiAgent] Failed to start task for ${agents[i].getName()}:`, error)
    }
  }
}
