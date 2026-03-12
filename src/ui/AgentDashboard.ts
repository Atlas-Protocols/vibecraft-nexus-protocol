/**
 * AgentDashboard - UI for managing multiple agents
 *
 * Shows status, tasks, and controls for all agents
 */

import type { AgentManager } from '../agents/AgentManager'

export class AgentDashboard {
  private panel: HTMLElement
  private agentManager: AgentManager
  private updateInterval: number | null = null

  constructor(agentManager: AgentManager) {
    this.agentManager = agentManager
    this.panel = this.createPanel()
    document.body.appendChild(this.panel)

    // Update every 2 seconds
    this.updateInterval = window.setInterval(() => this.render(), 2000)
    this.render()
  }

  private createPanel(): HTMLElement {
    const panel = document.createElement('div')
    panel.id = 'agent-dashboard'
    panel.innerHTML = `
      <div class="agent-dashboard-header">
        <span class="agent-dashboard-icon" title="Toggle collapse">🤖</span>
        <h3>Multi-Agent Workspace</h3>
        <button class="agent-dashboard-toggle">−</button>
      </div>
      <div class="agent-tabs">
        <div class="agent-tab active" data-agent="all" title="Show all agents">
          <span class="agent-tab-icon">👁️</span>
          All
        </div>
        <div class="agent-tab" data-agent="claude" title="Claude Code">
          <span class="agent-tab-icon">🧠</span>
          Claude
        </div>
        <div class="agent-tab" data-agent="antigravity" title="Antigravity (Gemini)">
          <span class="agent-tab-icon">🚀</span>
          AG
        </div>
        <div class="agent-tab" data-agent="ollama" title="Ollama (Local)">
          <span class="agent-tab-icon">🦙</span>
          Ollama
        </div>
        <div class="agent-tab" data-agent="jules" title="Jules (n8n)">
          <span class="agent-tab-icon">⚡</span>
          Jules
        </div>
      </div>
      <div class="agent-dashboard-content">
        <div id="agent-list"></div>
      </div>
    `

    // Add styles - REPOSITIONED TO LEFT SIDE PANEL
    const style = document.createElement('style')
    style.textContent = `
      #agent-dashboard {
        /* TEMPORARY: Hidden until integrated into sidebar properly */
        display: none;
        position: fixed;
        top: 60px;
        left: 10px;
        width: 240px;
        max-height: calc(100vh - 80px);
        background: rgba(26, 27, 38, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 12px;
        font-family: system-ui, -apple-system, sans-serif;
        color: #e0e0e0;
        z-index: 1000;
        backdrop-filter: blur(10px);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        flex-direction: column;
      }

      #agent-dashboard.collapsed {
        width: 48px;
        padding: 8px;
      }

      #agent-dashboard.collapsed .agent-dashboard-content,
      #agent-dashboard.collapsed .agent-dashboard-header h3,
      #agent-dashboard.collapsed .agent-tabs {
        display: none;
      }

      .agent-dashboard-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .agent-dashboard-icon {
        font-size: 18px;
        cursor: pointer;
      }

      .agent-dashboard-header h3 {
        margin: 0;
        font-size: 13px;
        flex: 1;
        color: #fff;
        white-space: nowrap;
      }

      .agent-dashboard-toggle {
        background: none;
        border: none;
        color: #888;
        font-size: 16px;
        cursor: pointer;
        padding: 0 4px;
      }

      .agent-dashboard-toggle:hover {
        color: #fff;
      }

      /* Agent Tabs */
      .agent-tabs {
        display: flex;
        gap: 4px;
        margin-bottom: 8px;
        flex-wrap: wrap;
      }

      .agent-tab {
        flex: 1;
        min-width: 45px;
        padding: 6px 4px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        cursor: pointer;
        text-align: center;
        font-size: 11px;
        color: #999;
        transition: all 0.2s ease;
      }

      .agent-tab:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
      }

      .agent-tab.active {
        background: rgba(99, 102, 241, 0.3);
        border-color: #6366f1;
        color: #fff;
      }

      .agent-tab-icon {
        display: block;
        font-size: 16px;
        margin-bottom: 2px;
      }

      .agent-dashboard-content {
        flex: 1;
        overflow-y: auto;
        max-height: 400px;
      }

      .agent-item {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        padding: 10px;
        margin-bottom: 6px;
        border-left: 3px solid;
      }

      .agent-item-header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 6px;
      }

      .agent-avatar {
        font-size: 20px;
      }

      .agent-name {
        font-weight: 600;
        color: #fff;
        flex: 1;
        font-size: 12px;
      }

      .agent-status {
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 8px;
        font-weight: 600;
      }

      .agent-status.online {
        background: rgba(34, 197, 94, 0.2);
        color: #22c55e;
      }

      .agent-status.offline {
        background: rgba(156, 163, 175, 0.2);
        color: #9ca3af;
      }

      .agent-info {
        font-size: 11px;
        color: #999;
        margin-bottom: 4px;
      }

      .agent-chat-history {
        max-height: 80px;
        overflow-y: auto;
        font-size: 10px;
        color: #888;
        background: rgba(0,0,0,0.2);
        border-radius: 4px;
        padding: 6px;
        margin: 6px 0;
      }

      .agent-chat-msg {
        margin-bottom: 4px;
        padding-bottom: 4px;
        border-bottom: 1px solid rgba(255,255,255,0.05);
      }

      .agent-controls {
        display: flex;
        gap: 4px;
        margin-top: 6px;
      }

      .agent-btn {
        flex: 1;
        padding: 5px 8px;
        border: none;
        border-radius: 6px;
        font-size: 10px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .agent-btn:hover {
        transform: translateY(-1px);
      }

      .agent-btn-start {
        background: linear-gradient(135deg, #22c55e, #16a34a);
        color: white;
      }

      .agent-btn-stop {
        background: linear-gradient(135deg, #ef4444, #dc2626);
        color: white;
      }

      .agent-btn-filter {
        background: linear-gradient(135deg, #6366f1, #4f46e5);
        color: white;
      }

      .agent-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }
    `
    document.head.appendChild(style)

    // Toggle collapse - improved for side panel
    const toggleBtn = panel.querySelector('.agent-dashboard-toggle')!
    const dashboardIcon = panel.querySelector('.agent-dashboard-icon')!
    const content = panel.querySelector('.agent-dashboard-content')!
    const tabs = panel.querySelector('.agent-tabs')!
    const header = panel.querySelector('.agent-dashboard-header h3')!

    const toggleCollapse = () => {
      const isCollapsed = panel.classList.toggle('collapsed')
      toggleBtn.textContent = isCollapsed ? '+' : '−'
      if (isCollapsed) {
        (content as HTMLElement).style.display = 'none';
        (tabs as HTMLElement).style.display = 'none';
        (header as HTMLElement).style.display = 'none';
      } else {
        (content as HTMLElement).style.display = 'block';
        (tabs as HTMLElement).style.display = 'flex';
        (header as HTMLElement).style.display = 'block';
      }
    }

    toggleBtn.addEventListener('click', toggleCollapse)
    dashboardIcon.addEventListener('click', toggleCollapse)

    // Tab click handlers - filter agents
    const tabElements = panel.querySelectorAll('.agent-tab')
    tabElements.forEach(tab => {
      tab.addEventListener('click', (e) => {
        // Remove active from all
        tabElements.forEach(t => t.classList.remove('active'))
          // Add active to clicked
          ; (e.currentTarget as HTMLElement).classList.add('active')

        const agentId = (e.currentTarget as HTMLElement).dataset.agent
        this.setActiveTab(agentId || 'all')
      })
    })

    return panel
  }

  private activeTab: string = 'all'
  private onFilterCallback: ((agentId: string | null) => void) | null = null

  /**
   * Set callback for when tab filter changes
   */
  setFilterCallback(callback: (agentId: string | null) => void): void {
    this.onFilterCallback = callback
  }

  private setActiveTab(agentId: string): void {
    this.activeTab = agentId

    // Notify callback (for FeedManager integration)
    if (this.onFilterCallback) {
      this.onFilterCallback(agentId === 'all' ? null : `session_${agentId}`)
    }

    this.render()
  }

  render(): void {
    const status = this.agentManager.getStatus()
    const agentList = this.panel.querySelector('#agent-list')!

    agentList.innerHTML = status.agents
      .map(
        agent => `
      <div class="agent-item" style="border-left-color: ${agent.color}">
        <div class="agent-item-header">
          <span class="agent-avatar">${agent.avatar}</span>
          <span class="agent-name">${agent.name}</span>
          <span class="agent-status ${agent.enabled ? 'online' : 'offline'}">
            ${agent.enabled ? 'Online' : 'Offline'}
          </span>
        </div>
        <div class="agent-info">Type: ${agent.type}</div>
        <div class="agent-controls">
          <button class="agent-btn agent-btn-start" data-agent="${agent.id}" ${!agent.enabled ? 'disabled' : ''}>
            Start Task
          </button>
          <button class="agent-btn agent-btn-stop" data-agent="${agent.id}" ${!agent.enabled ? 'disabled' : ''}>
            Stop
          </button>
        </div>
      </div>
    `
      )
      .join('')

    // Attach event listeners
    agentList.querySelectorAll('.agent-btn-start').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const agentId = (e.target as HTMLElement).dataset.agent!
        this.handleStartTask(agentId)
      })
    })

    agentList.querySelectorAll('.agent-btn-stop').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const agentId = (e.target as HTMLElement).dataset.agent!
        this.handleStopTask(agentId)
      })
    })
  }

  private async handleStartTask(agentId: string): Promise<void> {
    const task = prompt(`Enter task for ${agentId}:`)
    if (!task) return

    try {
      await this.agentManager.startTask(agentId, task)
      this.render()
    } catch (error) {
      console.error(`Failed to start task for ${agentId}:`, error)
      alert(`Failed to start task: ${error}`)
    }
  }

  private async handleStopTask(agentId: string): Promise<void> {
    try {
      await this.agentManager.stopTask(agentId)
      this.render()
    } catch (error) {
      console.error(`Failed to stop task for ${agentId}:`, error)
      alert(`Failed to stop task: ${error}`)
    }
  }

  dispose(): void {
    if (this.updateInterval !== null) {
      window.clearInterval(this.updateInterval)
    }
    this.panel.remove()
  }
}
