/**
 * Ralph Monitoring Dashboard
 *
 * Tracks Ralph autonomous agent sessions and displays progress in the UI
 */

interface Story {
  id: string
  title: string
  passes: boolean
}

interface RalphSession {
  sessionId: string
  status: 'idle' | 'working' | 'complete'
  currentStory: string | null
  currentStoryId: string | null
  storiesCompleted: number
  storiesTotal: number
  stories: Story[]
  currentIteration: number | null
  maxIterations: number | null
  lastUpdate: number
  prdPath?: string
}

export class RalphMonitor {
  private panel: HTMLElement
  private statusEl: HTMLElement
  private currentStoryEl: HTMLElement
  private progressEl: HTMLElement
  private iterationEl: HTMLElement
  private progressFillEl: HTMLElement
  private startBtn: HTMLButtonElement
  private stopBtn: HTMLButtonElement
  private session: RalphSession | null = null
  private apiUrl: string

  constructor(apiUrl: string = '/api') {
    this.panel = document.getElementById('ralph-panel')!
    this.statusEl = document.getElementById('ralph-status')!
    this.currentStoryEl = document.getElementById('ralph-current-story')!
    this.progressEl = document.getElementById('ralph-progress')!
    this.iterationEl = document.getElementById('ralph-iteration')!
    this.progressFillEl = document.getElementById('ralph-progress-fill')!
    this.startBtn = document.getElementById('ralph-start-btn')! as HTMLButtonElement
    this.stopBtn = document.getElementById('ralph-stop-btn')! as HTMLButtonElement
    this.apiUrl = apiUrl

    this.setupEventListeners()
  }

  /**
   * Setup button event listeners
   */
  private setupEventListeners(): void {
    this.startBtn.addEventListener('click', () => this.handleStart())
    this.stopBtn.addEventListener('click', () => this.handleStop())
  }

  /**
   * Handle Start button click
   */
  private async handleStart(): Promise<void> {
    try {
      this.startBtn.disabled = true
      const response = await fetch(`${this.apiUrl}/ralph/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxIterations: 10 })
      })

      if (!response.ok) {
        throw new Error(`Failed to start Ralph: ${response.statusText}`)
      }

      // Button visibility will update when events arrive
    } catch (error) {
      console.error('Failed to start Ralph:', error)
      alert('Failed to start Ralph. Make sure the VibeCraft server is running.')
      this.startBtn.disabled = false
    }
  }

  /**
   * Handle Stop button click
   */
  private async handleStop(): Promise<void> {
    if (!this.session) return

    try {
      this.stopBtn.disabled = true
      const response = await fetch(`${this.apiUrl}/ralph/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: this.session.sessionId })
      })

      if (!response.ok) {
        throw new Error(`Failed to stop Ralph: ${response.statusText}`)
      }

      // Button visibility will update when stop event arrives
    } catch (error) {
      console.error('Failed to stop Ralph:', error)
      alert('Failed to stop Ralph. The process may have already stopped.')
      this.stopBtn.disabled = false
    }
  }

  /**
   * Handle incoming events from Ralph sessions
   */
  handleEvent(event: any): void {
    // Only process events from Ralph sessions (sessionId starts with "ralph-")
    if (!event.sessionId || !event.sessionId.startsWith('ralph-')) {
      return
    }

    // Initialize session if needed
    if (!this.session || this.session.sessionId !== event.sessionId) {
      this.session = {
        sessionId: event.sessionId,
        status: 'idle',
        currentStory: null,
        currentStoryId: null,
        storiesCompleted: 0,
        storiesTotal: 0,
        stories: [],
        currentIteration: null,
        maxIterations: null,
        lastUpdate: Date.now()
      }

      // Load PRD data for this Ralph session
      this.loadPRDData()
    }

    // Update session based on event type
    switch (event.type) {
      case 'session_start':
        this.session.status = 'working'
        this.parseSessionStart(event)
        this.show()
        break

      case 'pre_tool_use':
        if (event.tool === 'Task') {
          this.session.status = 'working'
          this.parseIterationStart(event)
        }
        break

      case 'post_tool_use':
        if (event.tool === 'Task') {
          this.parseIterationComplete(event)
        }
        break

      case 'stop':
        this.parseStop(event)
        break
    }

    this.session.lastUpdate = Date.now()
    this.render()
  }

  /**
   * Parse session_start event to extract max iterations
   */
  private parseSessionStart(event: any): void {
    const desc = event.toolInput?.description || ''
    const match = desc.match(/max (\d+) iterations/)
    if (match) {
      this.session!.maxIterations = parseInt(match[1], 10)
    }
  }

  /**
   * Parse pre_tool_use event to extract current iteration and story
   */
  private parseIterationStart(event: any): void {
    const desc = event.toolInput?.description || ''

    // Extract iteration number: "Ralph iteration 1/10"
    const iterMatch = desc.match(/iteration (\d+)\/(\d+)/)
    if (iterMatch) {
      this.session!.currentIteration = parseInt(iterMatch[1], 10)
      this.session!.maxIterations = parseInt(iterMatch[2], 10)
    }

    // Extract current story: "Working on: US-006: Connect Ralph..."
    const storyMatch = desc.match(/Working on: (.+)$/)
    if (storyMatch) {
      const fullStory = storyMatch[1].trim()
      this.session!.currentStory = fullStory

      // Extract story ID
      const idMatch = fullStory.match(/^(US-\d+)/)
      if (idMatch) {
        this.session!.currentStoryId = idMatch[1]
      }

      // Reload PRD data to get updated story counts
      this.loadPRDData()
    }
  }

  /**
   * Load PRD data from API
   */
  private async loadPRDData(): Promise<void> {
    try {
      // Assume prd.json is in scripts/ralph/prd.json relative to cwd
      // For now, we'll fetch from a known location or use event data
      // This is a simplified implementation - in production, the server would provide this

      // Count stories from current session stories array if available
      if (this.session && this.session.stories.length === 0) {
        // Default counts - will be updated when we get actual PRD data
        this.session.storiesTotal = 10  // US-001 through US-010
        this.session.storiesCompleted = this.session.stories.filter(s => s.passes).length
      }
    } catch (error) {
      console.warn('Could not load PRD data:', error)
    }
  }

  /**
   * Parse post_tool_use event (iteration complete)
   */
  private parseIterationComplete(event: any): void {
    // Could track iteration completion time here if needed
  }

  /**
   * Parse stop event (Ralph completed or reached max iterations)
   */
  private parseStop(event: any): void {
    const desc = event.toolInput?.description || ''

    if (desc.includes('completed all PRD tasks successfully')) {
      this.session!.status = 'complete'
    } else if (desc.includes('reached max iterations')) {
      this.session!.status = 'idle'
    }
  }

  /**
   * Show the Ralph panel
   */
  show(): void {
    this.panel.classList.remove('hidden')
  }

  /**
   * Hide the Ralph panel
   */
  hide(): void {
    this.panel.classList.add('hidden')
  }

  /**
   * Update the UI to reflect current session state
   */
  render(): void {
    if (!this.session) {
      this.hide()
      return
    }

    // Update status
    this.statusEl.textContent = this.session.status.charAt(0).toUpperCase() + this.session.status.slice(1)
    this.statusEl.className = `ralph-value ${this.session.status}`

    // Update current story
    this.currentStoryEl.textContent = this.session.currentStory || '—'
    this.currentStoryEl.title = this.session.currentStory || ''

    // Update progress (we don't have story counts yet, will add in later stories)
    this.progressEl.textContent = `${this.session.storiesCompleted} / ${this.session.storiesTotal || '?'}`

    // Update iteration
    if (this.session.currentIteration !== null && this.session.maxIterations !== null) {
      this.iterationEl.textContent = `${this.session.currentIteration} / ${this.session.maxIterations}`
    } else {
      this.iterationEl.textContent = '—'
    }

    // Update progress bar (based on iteration for now)
    let progress = 0
    if (this.session.currentIteration !== null && this.session.maxIterations !== null && this.session.maxIterations > 0) {
      progress = (this.session.currentIteration / this.session.maxIterations) * 100
    }
    this.progressFillEl.style.width = `${progress}%`

    // Update button visibility based on status
    if (this.session.status === 'working') {
      this.startBtn.classList.add('hidden')
      this.startBtn.disabled = false
      this.stopBtn.classList.remove('hidden')
      this.stopBtn.disabled = false
    } else {
      this.startBtn.classList.remove('hidden')
      this.startBtn.disabled = false
      this.stopBtn.classList.add('hidden')
      this.stopBtn.disabled = false
    }

    this.show()
  }

  /**
   * Reset the monitor state
   */
  reset(): void {
    this.session = null
    this.hide()
  }
}
