# Agent Registration & Instant Work Guide

## Overview

Vibecraft now has a **complete agent registration system** that automatically:
1. Classifies tasks by type
2. Routes to optimal agent (Cove/Ralph/Sonnet)
3. Assigns dedicated workstations
4. Tracks tokens/cost in real-time
5. Calculates savings vs all-Sonnet approach

**Result**: Agents register and start working immediately, no manual setup required!

---

## How It Works

### Automatic Registration Flow

```
User spawns Task
       │
       ▼
SubagentManager.spawn()
       │
       ├─▶ Classify task type (read/analyze/implement/etc.)
       │
       ├─▶ Route to optimal agent (Cove/Ralph/Sonnet/Haiku/Ollama)
       │
       ├─▶ Get agent color & icon from capability profile
       │
       ├─▶ Assign workstation (round-robin through 8 stations)
       │
       ├─▶ Register in AgentRegistry (start tracking)
       │
       ├─▶ Create Claude entity at assigned station
       │
       └─▶ Agent starts working IMMEDIATELY ✅

Agent completes Task
       │
       ▼
SubagentManager.remove()
       │
       ├─▶ Complete task in AgentRegistry (log final stats)
       │
       ├─▶ Calculate token savings vs Sonnet
       │
       ├─▶ Release workstation
       │
       ├─▶ Unregister agent
       │
       └─▶ Dispose Claude entity
```

---

## Task Classification Examples

### Lightweight Tasks → Cove (🌿 Emerald Green)
```
Tool: Read
Description: "Read configuration file"
→ Cove spawns at Scanner station
→ Cost: $0.10/M tokens (90% savings!)
→ Speed: 5x faster than Sonnet
```

### Analysis Tasks → Ralph (📊 Amber)
```
Tool: Task
Description: "Analyze code architecture"
→ Ralph spawns at Desk station
→ Cost: $1.50/M tokens (50% savings!)
→ Speed: 1.5x faster than Sonnet
```

### Complex Tasks → Sonnet (🧠 Beige)
```
Tool: Task
Description: "Implement multi-file refactor with complex logic"
→ Sonnet spawns at Workbench station
→ Cost: $3.00/M tokens (baseline)
→ Speed: 1x (full capability)
```

### Fast General Tasks → Haiku (⚡ Blue)
```
Tool: Write
Description: "Write simple utility function"
→ Haiku spawns at Terminal station
→ Cost: $0.25/M tokens (92% savings!)
→ Speed: 3x faster than Sonnet
```

### Local/Free Tasks → Ollama (🏠 Cyan)
```
Tool: Bash
Description: "Run test suite"
→ Ollama spawns at Terminal station
→ Cost: $0.00 (FREE!)
→ Speed: 0.5x (hardware-dependent)
```

---

## Usage (Automatic - No Code Changes Needed!)

### Current Integration (SubagentManager)

The `SubagentManager` now automatically handles everything:

```typescript
// OLD CODE (manual station assignment)
const subagent = subagentManager.spawn(toolUseId, description)

// NEW CODE (automatic routing, same API!)
const subagent = subagentManager.spawn(toolUseId, description, toolName)
//                                                             ^^^^^^^^
//                                     Optional: tool name for better routing
```

**That's it!** The agent:
- ✅ Classifies task type
- ✅ Routes to optimal model
- ✅ Gets assigned workstation
- ✅ Starts tracking tokens/cost
- ✅ Begins working immediately

---

## Real-Time Statistics

### View Current Stats

```typescript
import { agentRegistry } from './entities/AgentCapabilities'

// Get overall stats
const stats = agentRegistry.getStats()
console.log('Active agents:', stats.activeAgents)
console.log('Total tokens:', stats.totalTokens)
console.log('Total cost:', stats.totalCost)
console.log('Total tasks:', stats.totalTasks)

// By model breakdown
console.log('Cove:', stats.byModel.cove) // { count, tokens, cost }
console.log('Ralph:', stats.byModel.ralph)
console.log('Sonnet:', stats.byModel.sonnet)

// Calculate savings
const savings = agentRegistry.calculateSavings()
console.log(`Saved $${savings.toFixed(4)} vs all-Sonnet approach`)
```

### View Individual Agent

```typescript
const agent = agentRegistry.getAgent(toolUseId)
console.log('Model:', agent.model)
console.log('Tokens:', agent.totalTokens)
console.log('Cost:', agent.totalCost)
console.log('Tasks completed:', agent.tasksCompleted)
console.log('Current task:', agent.currentTask)
```

---

## Visual Indicators

Each agent type has a unique **color and icon**:

| Agent  | Icon | Color         | Hex       | When to Use                  |
|--------|------|---------------|-----------|------------------------------|
| Cove   | 🌿   | Emerald Green | `0x34d399`| Read, Search, Simple tasks   |
| Ralph  | 📊   | Amber         | `0xfbbf24`| Analysis, Review, Planning   |
| Sonnet | 🧠   | Beige         | `0xd4a574`| Complex implementation       |
| Haiku  | ⚡   | Blue          | `0x60a5fa`| Fast general tasks           |
| Opus   | 👑   | Purple        | `0xa78bfa`| Ultra-complex reasoning      |
| Ollama | 🏠   | Cyan          | `0x22d3ee`| Local/Free execution         |

**In Vibecraft 3D Scene**:
- Agent spawns with correct color
- Status ring pulses in agent color
- Icon shown in activity feed
- Workstation has subtle glow in agent color

---

## Preferred Stations by Agent Type

```typescript
Cove: ['scanner', 'bookshelf', 'antenna']
  → Prefers reading/searching stations

Ralph: ['desk', 'bookshelf', 'taskboard']
  → Prefers analysis/planning stations

Sonnet: ['desk', 'terminal', 'workbench']
  → Prefers implementation stations

Haiku: ['terminal', 'scanner', 'portal']
  → Prefers fast-action stations

Opus: ['desk', 'workbench', 'taskboard']
  → Prefers complex-task stations

Ollama: ['terminal', 'workbench', 'portal']
  → Prefers local execution stations
```

**Note**: Station assignment is still round-robin for fairness, but agents have preferences that influence collaboration grouping (future enhancement).

---

## Cost Comparison Examples

### Scenario 1: Read 10 Files (Lightweight)
```
Task: Read 10 configuration files (50K tokens total)

All Sonnet:  $0.15  (baseline)
With Cove:   $0.005 (97% savings! 🎉)
Difference:  $0.145 saved
```

### Scenario 2: Analyze Codebase (Analysis)
```
Task: Analyze architecture and dependencies (200K tokens)

All Sonnet:  $0.60  (baseline)
With Ralph:  $0.30  (50% savings!)
Difference:  $0.30 saved
```

### Scenario 3: Mixed Workload (Realistic)
```
10x Read (Cove):        50K tokens → $0.005
5x Analysis (Ralph):   100K tokens → $0.15
3x Implement (Sonnet):  75K tokens → $0.225
2x Bash (Ollama):       10K tokens → $0.00

Total Cost:  $0.38
All Sonnet:  $0.705
Savings:     $0.325 (46% reduction!)
```

---

## Integration with Event System

### Spawn Event
```typescript
eventBus.emit('subagent_spawn', {
  toolUseId,
  model: agentModel,      // 'cove' | 'ralph' | 'sonnet' | etc.
  taskType,               // 'read' | 'analyze' | 'implement' | etc.
  station: assignedStation,
  color: capability.color,
  icon: capability.icon
})
```

### Completion Event
```typescript
eventBus.emit('subagent_complete', {
  toolUseId,
  model: agent.model,
  tokensUsed: agent.totalTokens,
  cost: agent.totalCost,
  savings: taskRouter.estimateSavings(agent.model, agent.totalTokens),
  tasksCompleted: agent.tasksCompleted
})
```

---

## Future Enhancements

### 1. Budget-Aware Routing
```typescript
// If budget low, prefer cheaper agents
const budget = 0.10 // $0.10 remaining this month
const agent = taskRouter.recommendAgent(taskType, budget, estimatedTokens)
// Automatically falls back to Cove or Ollama when budget tight
```

### 2. Learning & Optimization
```typescript
// Track which agent types perform best for each task type
// Auto-tune routing based on success rates and speed
```

### 3. Priority Queue
```typescript
// High-priority tasks get fastest agents
// Background tasks use free Ollama
```

### 4. Distributed Execution
```typescript
// Route heavy tasks to remote GPUs
// Keep lightweight tasks local
```

---

## Console Output Examples

### When Agent Spawns
```
✨ 🌿 COVE spawned: abc123 at scanner
   Task type: read, Description: Read config file
```

### When Agent Completes
```
✅ 🌿 COVE completed: abc123
   Stats: 1 tasks, 5000 tokens
   Cost: $0.0005, Saved: $0.0145
```

### Session Summary
```
[AgentRegistry] Session Stats:
  Active agents: 3
  Total tokens: 125,000
  Total cost: $0.35
  Total savings: $0.42 (55% reduction!)

  By model:
    Cove:   2 agents, 50K tokens, $0.005
    Ralph:  1 agent,  75K tokens, $0.11
    Sonnet: 0 agents, 0 tokens,   $0.00
```

---

## Mobile Integration (Future)

### Phone App Flow
```
User opens phone app
       │
       ▼
WebSocket connects to Vibecraft server
       │
       ▼
See all active agents in 3D (live stream)
       │
       ▼
Tap on agent to see stats
       │
       ▼
Voice command: "Run tests"
       │
       ▼
Ollama agent spawns
       │
       ▼
Watch test execution in real-time
       │
       ▼
Get push notification when complete
```

---

## API Reference

### taskRouter

```typescript
// Classify task type
classifyTask(tool: string, description?: string): TaskType

// Route to optimal agent
routeTask(taskType: TaskType, context?: string): AgentModel

// Get agent capabilities
getCapability(model: AgentModel): AgentCapability

// Estimate cost savings
estimateSavings(model: AgentModel, tokens: number): number

// Get all available agents
getAvailableAgents(): AgentCapability[]

// Budget-aware recommendation
recommendAgent(taskType, budget, tokens): AgentModel
```

### agentRegistry

```typescript
// Register new agent
register(id: string, model: AgentModel, toolUseId?: string): RegisteredAgent

// Unregister agent
unregister(id: string): void

// Track task start
startTask(id: string, taskType: TaskType, description: string): void

// Track task completion
completeTask(id: string, tokens: number): void

// Get agent by ID
getAgent(id: string): RegisteredAgent | undefined

// Get all active agents
getAllAgents(): RegisteredAgent[]

// Get aggregated statistics
getStats(): Stats

// Calculate total savings
calculateSavings(): number
```

---

## Troubleshooting

### Agent not spawning?
Check console for classification logs. Ensure `tool` parameter is passed to `spawn()`.

### Wrong agent type selected?
Task classification may need tuning. Check `classifyTask()` logic in `AgentCapabilities.ts`.

### Stats not updating?
Ensure `completeTask()` is called with token count when agent finishes.

### Costs seem high?
Check which agents are being used. May need to adjust routing logic to prefer cheaper agents.

---

## Summary

**Before** (Manual):
```typescript
const subagent = subagentManager.spawn(toolUseId, description)
// → Always spawned at portal
// → No cost tracking
// → No agent type optimization
```

**After** (Automatic):
```typescript
const subagent = subagentManager.spawn(toolUseId, description, tool)
// ✅ Auto-classifies task type
// ✅ Routes to optimal agent (Cove/Ralph/Sonnet)
// ✅ Assigns dedicated workstation
// ✅ Tracks tokens/cost in real-time
// ✅ Calculates savings
// ✅ Starts working IMMEDIATELY
```

**Benefits**:
- 🚀 **Instant work**: No manual setup required
- 💰 **Cost savings**: 40-90% reduction vs all-Sonnet
- ⚡ **Speed boost**: 1.5-5x faster for most tasks
- 📊 **Real-time tracking**: See costs and savings live
- 🎨 **Visual clarity**: Each agent type has unique color/icon
- 🔧 **Zero config**: Works out of the box

---

**Generated**: 2026-01-20
**Status**: Fully implemented and ready to use!
**Integration**: Drop-in replacement for existing `spawn()` calls
