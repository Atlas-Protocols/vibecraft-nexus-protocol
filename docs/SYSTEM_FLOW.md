# Vibecraft System Flow - Master Architecture

## Vision Statement

**Vibecraft is a collaborative 3D workspace where AI agents work together in real-time, visualizing their tasks, sharing CPU resources across a distributed network, and building a community-powered research platform.**

**Current State**: Solo visualization tool for Claude Code activity
**Future State**: Multi-user, multi-agent, distributed computation platform

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      VIBECRAFT ECOSYSTEM                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐   │
│  │   Client     │     │   Server     │     │  Agent Pool  │   │
│  │ (Frontend)   │────▶│  (Backend)   │────▶│  (Workers)   │   │
│  │  Port 4002   │     │  Port 4003   │     │  Distributed │   │
│  └──────────────┘     └──────────────┘     └──────────────┘   │
│         │                     │                     │           │
│         │                     │                     │           │
│  ┌──────▼──────┐      ┌──────▼──────┐      ┌──────▼──────┐   │
│  │  3D Scene   │      │  EventBus   │      │ Task Queue  │   │
│  │  Rendering  │      │  WebSocket  │      │  Scheduler  │   │
│  └─────────────┘      └─────────────┘      └─────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Flow Diagram

### 1. Client Layer (Frontend - Port 4002)

```
┌───────────────────────────────────────────────────────────┐
│                    CLIENT APPLICATION                      │
├───────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │              WorkshopScene (3D World)             │   │
│  ├──────────────────────────────────────────────────┤   │
│  │                                                    │   │
│  │  • Zones (Multi-session workspaces)              │   │
│  │    ├─ Zone 1 (8 stations)                        │   │
│  │    ├─ Zone 2 (8 stations)                        │   │
│  │    └─ Zone N...                                   │   │
│  │                                                    │   │
│  │  • Stations (per zone):                          │   │
│  │    1. Center      - Home/idle                     │   │
│  │    2. Desk        - Writing, planning            │   │
│  │    3. Terminal    - Bash commands                │   │
│  │    4. Scanner     - Reading files                │   │
│  │    5. Bookshelf   - Searching code               │   │
│  │    6. Antenna     - Web fetch                    │   │
│  │    7. Portal      - Task spawning                │   │
│  │    8. Taskboard   - Todo management              │   │
│  │    9. Workbench   - Building/compiling           │   │
│  │                                                    │   │
│  │  • Characters (Agents):                          │   │
│  │    - Main Claude (user's primary agent)          │   │
│  │    - Subagents (spawned for tasks)               │   │
│  │                                                    │   │
│  └──────────────────────────────────────────────────┘   │
│                          │                                │
│                          ▼                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │           Entity Management Layer                 │   │
│  ├──────────────────────────────────────────────────┤   │
│  │                                                    │   │
│  │  Claude.ts              - Character entity        │   │
│  │  SubagentManager.ts     - Spawn/remove subagents │   │
│  │  StationAssignmentMgr   - Assign workstations    │   │
│  │  CollaborationManager   - Team coordination      │   │
│  │  MovementChoreographer  - Walking animations     │   │
│  │  AgentCapabilities.ts   - Task routing          │   │
│  │  AgentRegistry          - Track active agents    │   │
│  │                                                    │   │
│  └──────────────────────────────────────────────────┘   │
│                          │                                │
│                          ▼                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Event System Layer                   │   │
│  ├──────────────────────────────────────────────────┤   │
│  │                                                    │   │
│  │  EventBus.ts            - Central event hub       │   │
│  │  EventClient.ts         - Server communication    │   │
│  │                                                    │   │
│  │  Event Handlers:                                  │   │
│  │  • animationHandlers    - Agent movement         │   │
│  │  • feedHandlers         - Activity feed          │   │
│  │  • notificationHandlers - User alerts            │   │
│  │  • soundHandlers        - Audio cues             │   │
│  │  • subagentHandlers     - Subagent lifecycle     │   │
│  │  • zoneHandlers         - Zone management        │   │
│  │                                                    │   │
│  └──────────────────────────────────────────────────┘   │
│                          │                                │
│                          ▼                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │               UI Components Layer                 │   │
│  ├──────────────────────────────────────────────────┤   │
│  │                                                    │   │
│  │  • TimelineManager      - Event timeline         │   │
│  │  • Toast                - Notifications          │   │
│  │  • PermissionModal      - User approvals         │   │
│  │  • QuestionModal        - User questions         │   │
│  │  • ZoneInfoModal        - Zone details           │   │
│  │  • KeyboardShortcuts    - Hotkeys                │   │
│  │  • VoiceControl         - Voice commands         │   │
│  │  • ContextMenu          - Right-click actions    │   │
│  │                                                    │   │
│  └──────────────────────────────────────────────────┘   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 2. Server Layer (Backend - Port 4003)

```
┌───────────────────────────────────────────────────────────┐
│                    SERVER APPLICATION                      │
├───────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │           WebSocket Server (EventBus)             │   │
│  ├──────────────────────────────────────────────────┤   │
│  │                                                    │   │
│  │  • Client connections                             │   │
│  │  • Event broadcasting                             │   │
│  │  • Session management                             │   │
│  │                                                    │   │
│  └──────────────────────────────────────────────────┘   │
│                          │                                │
│                          ▼                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │          Claude Code Integration                  │   │
│  ├──────────────────────────────────────────────────┤   │
│  │                                                    │   │
│  │  • Hook system (reads ~/.claude/hooks.json)      │   │
│  │  • Tool event capture (Read, Write, Bash, etc.)  │   │
│  │  • Activity streaming                             │   │
│  │  • Session tracking                               │   │
│  │                                                    │   │
│  └──────────────────────────────────────────────────┘   │
│                          │                                │
│                          ▼                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │            Project Management                     │   │
│  ├──────────────────────────────────────────────────┤   │
│  │                                                    │   │
│  │  ProjectsManager.ts     - Multi-project support  │   │
│  │  GitStatusManager.ts    - Git integration        │   │
│  │                                                    │   │
│  └──────────────────────────────────────────────────┘   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Event Flow (Real-Time Communication)

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  Claude     │         │  Vibecraft  │         │  Vibecraft  │
│  Code CLI   │         │   Server    │         │   Client    │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │  1. Tool executed     │                       │
       │  (hook triggered)     │                       │
       ├──────────────────────▶│                       │
       │                       │                       │
       │                       │  2. Event broadcast   │
       │                       │  (WebSocket)          │
       │                       ├──────────────────────▶│
       │                       │                       │
       │                       │                       │  3. Event handled
       │                       │                       │  (update scene)
       │                       │                       ├─────┐
       │                       │                       │     │
       │                       │                       │◀────┘
       │                       │                       │
       │                       │                       │  4. Visual update
       │                       │                       │  (agent moves)
       │                       │                       ├─────┐
       │                       │                       │     │
       │                       │                       │◀────┘
       │                       │                       │
```

### Event Types

**Tool Events**:
- `tool_use_start` - Tool begins execution
- `tool_use_end` - Tool completes
- `tool_use_error` - Tool fails

**Agent Events**:
- `subagent_spawn` - New subagent created
- `subagent_remove` - Subagent completes
- `agent_move` - Agent changes station
- `agent_state_change` - idle/walking/working/thinking

**Zone Events**:
- `zone_create` - New workspace zone
- `zone_update` - Zone state change
- `zone_delete` - Zone removed
- `zone_focus` - Camera focuses on zone

**Collaboration Events**:
- `team_form` - Agents group for task
- `team_disband` - Team completes
- `handoff` - Work transferred between agents

---

## Agent Lifecycle Flow

```
┌────────────────────────────────────────────────────────────┐
│                   AGENT LIFECYCLE                          │
└────────────────────────────────────────────────────────────┘

1. REGISTRATION
   ┌───────────────┐
   │ Task spawned  │
   └───────┬───────┘
           │
           ▼
   ┌────────────────────────┐
   │ AgentRegistry.register │
   │  - Assign ID           │
   │  - Classify task       │
   │  - Select model        │
   └───────┬────────────────┘
           │
           ▼
   ┌────────────────────────┐
   │ StationAssignment      │
   │  - Round-robin assign  │
   │  - Get workstation     │
   └───────┬────────────────┘
           │
           ▼
   ┌────────────────────────┐
   │ SubagentManager.spawn  │
   │  - Create Claude       │
   │  - Set color/icon      │
   │  - Position at station │
   └───────┬────────────────┘
           │
           ▼

2. EXECUTION
   ┌────────────────────────┐
   │ Agent working          │
   │  - Animate movement    │
   │  - Update status ring  │
   │  - Show thought bubbles│
   └───────┬────────────────┘
           │
           ▼
   ┌────────────────────────┐
   │ Track tokens/cost      │
   │  - Count usage         │
   │  - Update registry     │
   └───────┬────────────────┘
           │
           ▼

3. COLLABORATION (Optional)
   ┌────────────────────────┐
   │ Detect parent task     │
   │  - Same toolUseId?     │
   └───────┬────────────────┘
           │ Yes
           ▼
   ┌────────────────────────┐
   │ CollaborationManager   │
   │  - Form team           │
   │  - Group at station    │
   │  - Coordinate movement │
   └───────┬────────────────┘
           │
           ▼

4. COMPLETION
   ┌────────────────────────┐
   │ Task completes         │
   └───────┬────────────────┘
           │
           ▼
   ┌────────────────────────┐
   │ AgentRegistry.complete │
   │  - Log final stats     │
   │  - Calculate savings   │
   └───────┬────────────────┘
           │
           ▼
   ┌────────────────────────┐
   │ StationAssignment      │
   │  - Release station     │
   └───────┬────────────────┘
           │
           ▼
   ┌────────────────────────┐
   │ SubagentManager.remove │
   │  - Dispose Claude      │
   │  - Cleanup resources   │
   └───────┬────────────────┘
           │
           ▼
   ┌────────────────────────┐
   │ Agent removed          │
   └────────────────────────┘
```

---

## Task Routing Logic (Cove/Ralph/Sonnet)

```
┌────────────────────────────────────────────────────────────┐
│                    TASK CLASSIFICATION                     │
└────────────────────────────────────────────────────────────┘

Tool Event Received
        │
        ▼
┌─────────────────┐
│ Analyze tool    │
│  - Tool name    │
│  - Description  │
│  - Context      │
└────────┬────────┘
         │
         ▼
    ┌────────┐
    │ Read?  │──Yes──▶ COVE (ultra-cheap, fast)
    └───┬────┘
        │ No
        ▼
    ┌────────┐
    │ Grep?  │──Yes──▶ COVE (search specialist)
    └───┬────┘
        │ No
        ▼
    ┌──────────┐
    │ Analyze? │──Yes──▶ RALPH (analysis specialist)
    └───┬──────┘
        │ No
        ▼
    ┌──────────┐
    │ Review?  │──Yes──▶ RALPH (code reviewer)
    └───┬──────┘
        │ No
        ▼
    ┌──────────┐
    │ Complex? │──Yes──▶ SONNET (full capability)
    └───┬──────┘
        │ No
        ▼
    ┌──────────┐
    │ Default  │────────▶ HAIKU (fast, cheap general)
    └──────────┘

Cost Comparison (per 1M tokens):
  COVE:   $0.10  (100x cheaper than Sonnet)
  RALPH:  $1.50  (2x cheaper than Sonnet)
  HAIKU:  $0.25  (12x cheaper than Sonnet)
  SONNET: $3.00  (baseline)
  OLLAMA: $0.00  (free, local)

Speed Comparison (vs Sonnet):
  COVE:   5x faster
  RALPH:  1.5x faster
  HAIKU:  3x faster
  SONNET: 1x (baseline)
  OLLAMA: 0.5x (hardware-dependent)
```

---

## Multi-User Distributed Architecture (Future)

```
┌────────────────────────────────────────────────────────────┐
│              DISTRIBUTED VIBECRAFT NETWORK                 │
└────────────────────────────────────────────────────────────┘

User 1 (Desktop)          User 2 (Phone)          User 3 (Laptop)
     │                         │                         │
     │                         │                         │
     ├────────────────────┬────┼────────┬────────────────┤
     │                    │    │        │                │
     ▼                    ▼    ▼        ▼                ▼
┌─────────┐          ┌──────────────────────┐      ┌─────────┐
│ Vibraft │          │   Central Broker     │      │ Vibraft │
│ Client  │◀────────▶│   (Load Balancer)    │◀────▶│ Client  │
└─────────┘          └──────────────────────┘      └─────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │   Task Queue    │
                     │   Scheduler     │
                     └────────┬────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
                ▼             ▼             ▼
         ┌──────────┐  ┌──────────┐  ┌──────────┐
         │ Worker 1 │  │ Worker 2 │  │ Worker N │
         │ (GPU)    │  │ (CPU)    │  │ (Cloud)  │
         └──────────┘  └──────────┘  └──────────┘

**Features**:
- CPU/GPU sharing across users
- Distributed task execution
- Real-time collaboration
- Community research pool
- Token cost sharing
- Reputation system

**Use Cases**:
1. Solo developer monitors agents on phone while coding
2. Team members see each other's agents working
3. Community pools resources for large analysis tasks
4. Research projects distributed across volunteer compute
```

---

## Integration Points

### 1. Solo-Mode-MVP Integration
```
Vibecraft                    Solo-Mode-MVP
   │                              │
   │  GET /api/god/stats         │
   ├─────────────────────────────▶│
   │                              │
   │  { at_balance, xp, ... }    │
   │◀─────────────────────────────┤
   │                              │
   │  Display in Pip-Boy UI       │
   │                              │
```

### 2. Ralph Analysis Integration
```
Agent needs analysis
   │
   ▼
Route to Ralph agent
   │
   ▼
Ralph analyzes code
   │
   ▼
Return flowchart/insights
   │
   ▼
Display in 3D scene
```

### 3. Mobile App Integration (Future)
```
Phone App                    Vibecraft Server
   │                              │
   │  WebSocket connect           │
   ├─────────────────────────────▶│
   │                              │
   │  Stream agent activity       │
   │◀─────────────────────────────┤
   │                              │
   │  Send voice command          │
   ├─────────────────────────────▶│
   │                              │
   │  Agent spawns in 3D          │
   │◀─────────────────────────────┤
   │                              │
```

---

## File Structure Map

```
vibecraft/
├── src/
│   ├── entities/               # Agent entities
│   │   ├── Claude.ts          # Base character
│   │   ├── SubagentManager.ts # Spawn/remove
│   │   ├── StationAssignmentManager.ts  # Workstation assignment ✅
│   │   ├── CollaborationManager.ts      # Team coordination (TODO)
│   │   ├── MovementChoreographer.ts     # Walking animations (TODO)
│   │   ├── AgentCapabilities.ts         # Task routing ✅
│   │   └── ICharacter.ts      # Interface
│   │
│   ├── scene/                  # 3D world
│   │   ├── WorkshopScene.ts   # Main scene
│   │   ├── StationPanels.ts   # Station UI
│   │   ├── ZoneNotifications.ts # Alerts
│   │   └── stations/          # 8 station types
│   │
│   ├── events/                 # Event system
│   │   ├── EventBus.ts        # Central hub
│   │   ├── EventClient.ts     # Server comms
│   │   └── handlers/          # Event handlers
│   │
│   ├── ui/                     # User interface
│   │   ├── TimelineManager.ts
│   │   ├── Toast.ts
│   │   ├── VoiceControl.ts
│   │   └── ...
│   │
│   ├── audio/                  # Sound system
│   │   ├── SoundManager.ts
│   │   ├── SpatialAudioContext.ts
│   │   └── VoiceInput.ts
│   │
│   ├── systems/                # Game systems
│   │   └── AttentionSystem.ts
│   │
│   └── utils/                  # Utilities
│       ├── HexGrid.ts
│       └── ToolUtils.ts
│
├── server/                     # Backend
│   ├── GitStatusManager.ts
│   └── ProjectsManager.ts
│
├── docs/                       # Documentation
│   ├── MULTI_AGENT_ARCHITECTURE.md  ✅
│   └── SYSTEM_FLOW.md              ✅
│
└── agents/                     # Agent configs
    └── config.json
```

---

## Quick Integration Guide

### Adding a New Agent Type

1. **Define capability** in `AgentCapabilities.ts`:
```typescript
myagent: {
  model: 'myagent',
  specialization: 'my-specialty',
  costPerToken: 1.0,
  speedMultiplier: 2.0,
  color: 0xff00ff,
  icon: '🤖',
  preferredStations: ['desk', 'terminal']
}
```

2. **Register on spawn** in your integration:
```typescript
const agent = agentRegistry.register(id, 'myagent', toolUseId)
```

3. **Track task execution**:
```typescript
agentRegistry.startTask(id, 'implement', 'Build feature X')
// ... do work ...
agentRegistry.completeTask(id, tokensUsed)
```

4. **Cleanup on completion**:
```typescript
agentRegistry.unregister(id)
```

### Viewing Stats in Real-Time

```typescript
const stats = agentRegistry.getStats()
console.log('Active agents:', stats.activeAgents)
console.log('Total cost:', stats.totalCost)
console.log('Savings:', agentRegistry.calculateSavings())
```

---

## Roadmap

### Phase 1: Enhanced Solo Mode (Current)
- ✅ Station assignment system
- ✅ Agent capabilities & routing
- ⏳ Collaboration manager
- ⏳ Movement choreography
- ⏳ Cost tracking UI

### Phase 2: Multi-User Local
- Shared workspace zones
- Real-time collaboration
- Team chat integration
- Shared agent pool

### Phase 3: Mobile Integration
- Phone app (React Native)
- Real-time monitoring
- Voice command control
- Push notifications

### Phase 4: Distributed Network
- Central broker service
- Load balancing
- CPU/GPU sharing
- Community research pool
- Token cost sharing
- Reputation system

---

## Performance Optimization Notes

**Current Bottlenecks**:
1. WebSocket event frequency (rate limiting needed)
2. 3D rendering with many agents (LOD system)
3. Event handler overhead (debouncing)

**Solutions**:
1. Batch events (send max 60/sec)
2. Reduce poly count for distant agents
3. Throttle non-critical updates

**Metrics to Track**:
- FPS (target: 60)
- Event latency (target: <50ms)
- Memory usage (target: <500MB)
- WebSocket message size (target: <1KB avg)

---

**Generated**: 2026-01-20
**Purpose**: Master system flow for Vibecraft engineering and integration
**Status**: Core architecture complete, collaboration/choreography pending
