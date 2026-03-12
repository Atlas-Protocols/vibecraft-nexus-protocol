# Multi-Agent VibeCraft System

## Overview

This system enables multiple AI agents (Antigravity, Jules, Ollama, Business-OS) to work simultaneously in VibeCraft **without OAuth token conflicts**. Each agent operates independently with its own API authentication.

## Architecture

```
┌─────────────────────────────────────────────┐
│         VibeCraft Multi-Agent Core          │
├─────────────────────────────────────────────┤
│  AgentManager                               │
│  ├─ ClaudeAgent (Business-OS) ──┐          │
│  ├─ ClaudeAgent (Antigravity) ───┼─> EventBus
│  ├─ ClaudeAgent (Jules) ─────────┤          │
│  └─ OllamaAgent (Local Model) ───┘          │
└─────────────────────────────────────────────┘
                    ↓
         ┌──────────────────────┐
         │   3D Scene Manager   │
         ├──────────────────────┤
         │  Zone 1: Business-OS │
         │  Zone 2: Antigravity │
         │  Zone 3: Jules       │
         │  Zone 4: Ollama      │
         └──────────────────────┘
```

## Setup

### 1. Configure API Keys

Each Claude-based agent needs its own API key. Set environment variables:

```bash
# In your .env file or shell profile
export ANTHROPIC_API_KEY="sk-ant-..."      # For Business-OS
export ANTIGRAVITY_API_KEY="sk-ant-..."    # For Antigravity
export JULES_API_KEY="sk-ant-..."          # For Jules
```

**Important**: These are **direct Anthropic API keys**, NOT Claude Code OAuth tokens. Get them from:
- https://console.anthropic.com/settings/keys

### 2. Configure Ollama (Optional)

If using the local Ollama agent:

```bash
# Start Ollama server
ollama serve

# Pull your custom model
ollama pull your-model-name
```

Update `vibecraft/agents/config.json` with your model name:

```json
{
  "id": "ollama-local",
  "model": "your-model-name",
  ...
}
```

### 3. Agent Configuration

Edit `vibecraft/agents/config.json` to enable/disable agents:

```json
{
  "agents": [
    {
      "id": "business-os",
      "name": "Business-OS",
      "type": "claude",
      "enabled": true,
      ...
    },
    {
      "id": "antigravity",
      "name": "Antigravity",
      "type": "claude",
      "enabled": true,
      ...
    }
  ]
}
```

## Usage

### Activate Multi-Agent Mode

In `vibecraft/src/main.ts`, add after initialization:

```typescript
import { initMultiAgentSystem } from './multiAgentInit'

// In init() function, after scene creation:
const multiAgent = await initMultiAgentSystem(scene)
```

### Start Tasks via Dashboard

1. Open VibeCraft (http://localhost:4002)
2. See "Multi-Agent Workspace" panel (bottom-right)
3. Click "Start Task" for any agent
4. Enter task description
5. Watch agents work in real-time in 3D space

### Start Tasks Programmatically

```typescript
import { startCollaborativeTask } from './multiAgentInit'

// Assign subtasks to all agents
await startCollaborativeTask(
  agentManager,
  "Build a new authentication system"
)
```

## Features

### Independent Authentication
- Each agent uses its own API key
- No OAuth token sharing
- Supports Claude API, Ollama, and custom endpoints

### Real-Time Visualization
- Each agent has a unique 3D character body
- Color-coded zones per agent
- Activity animations (idle, working, thinking)
- Zone pulse effects on task completion

### Event Attribution
- All events tagged with `agentId`
- Activity feed shows which agent did what
- Prevents file edit collisions

### Privacy
- External telemetry **disabled** (version checker commented out)
- All data stays in `~/.vibecraft/`
- Ollama agent runs fully local (no external calls)

## File Structure

```
vibecraft/
├── agents/
│   └── config.json                 # Agent configuration
├── src/
│   ├── agents/
│   │   ├── BaseAgent.ts           # Abstract agent class
│   │   ├── ClaudeAgent.ts         # Claude API implementation
│   │   ├── OllamaAgent.ts         # Ollama implementation
│   │   ├── AgentManager.ts        # Agent lifecycle manager
│   │   └── index.ts               # Module exports
│   ├── scene/
│   │   └── MultiAgentScene.ts     # 3D character bodies
│   ├── ui/
│   │   └── AgentDashboard.ts      # Control panel
│   └── multiAgentInit.ts          # Initialization helper
└── MULTI_AGENT_README.md          # This file
```

## API Reference

### AgentManager

```typescript
const manager = new AgentManager(eventCallback)

// Load agents from config
await manager.loadAgents(config)

// Start a task
await manager.startTask('antigravity', 'Research authentication patterns')

// Stop a task
await manager.stopTask('antigravity')

// Get status
const status = manager.getStatus()
// { total: 4, active: 2, agents: [...] }
```

### MultiAgentScene

```typescript
const scene = new MultiAgentScene(threeJsScene)

// Create character for agent
const character = scene.createCharacter(agent)

// Update animation
scene.updateCharacter('antigravity', 'working')

// Pulse zone
scene.pulseZone('antigravity')
```

### AgentDashboard

```typescript
const dashboard = new AgentDashboard(agentManager)
// Automatically renders UI panel
```

## Telemetry & Privacy

### What Was Removed
- ❌ Version checker (`VersionChecker.ts`) - disabled in main.ts
- ❌ External API calls to vibecraft.sh

### What Remains (Local Only)
- ✅ Event logging to `~/.vibecraft/data/events.jsonl`
- ✅ Session data in `~/.vibecraft/data/sessions.json`
- ✅ WebSocket connections (localhost:4003)

### How to Re-enable Version Checker (Optional)

In `src/main.ts`, uncomment:

```typescript
import { checkForUpdates } from './ui/VersionChecker'
// ...
checkForUpdates()
```

## Troubleshooting

### "Agent authentication failed"
- Check API keys are set in environment
- Verify keys are valid on https://console.anthropic.com

### "Cannot connect to Ollama"
- Ensure Ollama is running: `ollama serve`
- Check endpoint in config.json (default: http://localhost:11434)

### Agents not visible in 3D scene
- Verify `multiAgentInit.ts` is imported in main.ts
- Check browser console for errors
- Ensure agents are enabled in config.json

### Multiple agents using same session
- Each agent should have unique `keyEnv` in config.json
- Don't reuse the same API key across agents

## Contributing Agents

Want to add a new agent type? Follow this pattern:

```typescript
// src/agents/MyCustomAgent.ts
import { BaseAgent } from './BaseAgent'

export class MyCustomAgent extends BaseAgent {
  protected async authenticate(): Promise<boolean> {
    // Your auth logic
  }

  async sendMessage(message: string): Promise<AgentResponse> {
    // Your API call
  }

  async executeTool(tool: ToolUse): Promise<any> {
    // Your tool execution
  }

  emitEvent(event: Omit<AgentEvent, 'agentId' | 'sessionId' | 'timestamp'>): void {
    // Event emission
  }
}
```

Then register in `AgentManager.ts`:

```typescript
case 'mycustom':
  return new MyCustomAgent(config, handleEvent)
```

## Credits

- Built on VibeCraft multi-session architecture
- Uses Anthropic Claude API (direct, not OAuth)
- Ollama integration for local models
- No external tracking or telemetry

## License

Same as VibeCraft main project.
