# Multi-Agent Workspace Architecture

## Current Status (Analyzed 2026-01-20)

### Existing Implementation
- **SubagentManager** (`src/entities/SubagentManager.ts`): Manages subagent spawning/removal
- **Claude Entity** (`src/entities/Claude.ts`): Character with body, head, arms, animations
- **WorkshopScene** (`src/scene/WorkshopScene.ts`): Multi-zone support with 8 stations per zone
- **Issue**: 5 bodies spawn at portal with small offsets, stand idle, no station assignments

### Stations Available (8 total per zone)
1. `center` - Home/idle position
2. `desk` - Writing, planning
3. `terminal` - Bash commands
4. `scanner` - Reading files
5. `bookshelf` - Searching code
6. `antenna` - Web fetch
7. `portal` - Task spawning
8. `taskboard` - Todo management
9. `workbench` - Building/compiling

## Vision: One Bot Per Workstation

### Goals
- ✅ One bot assigned to one workstation (no overlap/confusion)
- ✅ Bots collaborate when working on same task (walk/work together)
- ✅ Hardcoded coordination (no resource conflicts)
- ✅ Standard duplicatable bot template (already exists in Claude.ts)
- ✅ Token optimization via Cove (lightweight) and Ralph (analysis)

### Proposed Architecture

#### 1. Station Assignment Queue
```typescript
class StationAssignmentManager {
  private availableStations: StationType[] = [
    'desk', 'terminal', 'scanner', 'bookshelf',
    'antenna', 'portal', 'taskboard', 'workbench'
  ]
  private assignments: Map<string, StationType> = new Map()

  assignStation(agentId: string): StationType {
    // Round-robin assignment
    // Agents get dedicated workstations
  }

  releaseStation(agentId: string): void {
    // Free up station when agent completes
  }
}
```

#### 2. Collaborative Teams
When multiple agents work on related tasks:
```typescript
class CollaborationManager {
  // Track which agents are on same task
  private teams: Map<string, Set<string>> = new Map()

  formTeam(taskId: string, agentIds: string[]): void {
    // Agents assigned to same task gather at shared station
    // Or form ring around station
  }

  coordinated Movement(team: Set<Claude>): void {
    // Agents walk together to destination
    // Formation movement (leader-follower or side-by-side)
  }
}
```

#### 3. Bot Template (Already Exists!)
The `Claude` class is already perfect for duplication:
```typescript
// In SubagentManager.spawn()
const claude = new Claude(this.scene, {
  scale: 0.6,           // Subagents are smaller
  color: 0x60a5fa,      // Unique color per agent
  statusColor: 0x60a5fa,
  startStation: assignedStation  // From StationAssignmentManager
})
```

**Key Change**: Replace hardcoded `startStation: 'portal'` with dynamic assignment.

#### 4. Movement Choreography
```typescript
class MovementChoreographer {
  moveAgentsTogether(agents: Claude[], destination: StationType): void {
    // Calculate formation positions around station
    // Stagger timing for natural movement
    // Face each other when collaborating
  }

  returnToStations(agents: Claude[]): void {
    // Send each agent back to assigned station
  }
}
```

#### 5. Token Optimization Integration

**Cove** (Lightweight tasks):
- File reads
- Simple searches
- Status checks
- Quick edits

**Ralph** (Analysis tasks):
- Code flow analysis
- Architecture review
- Dependency mapping
- Complexity analysis

```typescript
interface AgentCapability {
  id: string
  model: 'sonnet' | 'haiku' | 'cove' | 'ralph'
  specialization: 'general' | 'lightweight' | 'analysis'
  costPerToken: number
}

class TaskRouter {
  routeTaskToAgent(task: Task): AgentCapability {
    if (task.type === 'read' || task.type === 'simple-search') {
      return { model: 'cove', specialization: 'lightweight' }
    } else if (task.type === 'analyze' || task.type === 'architecture') {
      return { model: 'ralph', specialization: 'analysis' }
    } else {
      return { model: 'sonnet', specialization: 'general' }
    }
  }
}
```

## Implementation Plan

### Phase 1: Station Assignment System
**File**: `vibecraft/src/entities/StationAssignmentManager.ts`

- Create round-robin station assignment
- Track station → agent mapping
- Release stations when agents complete
- Update `SubagentManager.spawn()` to use assigned stations

### Phase 2: Collaborative Movement
**File**: `vibecraft/src/entities/CollaborationManager.ts`

- Detect when agents work on same task
- Form teams around shared stations
- Implement formation movement patterns
- Add "handoff" animations when transferring work

### Phase 3: Movement Choreography
**File**: `vibecraft/src/entities/MovementChoreographer.ts`

- Calculate formation positions (circle, line, pair)
- Stagger movement timing (0.1s delays for natural flow)
- Face agents toward each other during collaboration
- Return to assigned stations when idle

### Phase 4: Agent Capabilities & Routing
**Files**:
- `vibecraft/src/entities/AgentCapabilities.ts`
- `vibecraft/agents/config.json` (update)

- Define agent types: Sonnet (general), Haiku (fast), Cove (lightweight), Ralph (analysis)
- Route tasks based on complexity
- Track token usage per agent
- Display agent specialization in UI

### Phase 5: Visual Indicators
- Different colors per agent type
- Badges/icons for specialization
- Connection lines between collaborating agents
- Station ownership indicators (subtle glow)

## Technical Details

### Workspace Options

**Option A: Isolated Zones** (RECOMMENDED)
- Each zone (session) gets 8 dedicated stations
- Agents never leave their zone
- Clean separation between sessions
- Easier to manage

**Option B: Shared Global Stations**
- All agents across all zones share 8 stations
- More complex coordination needed
- Risk of conflicts
- Better for visualizing cross-session collaboration

**Recommendation**: Option A (isolated zones) for v1, Option B as future enhancement.

### Station Positions (Per Zone)
Already defined in `WorkshopScene.ts`:
```typescript
const stations = new Map<StationType, Station>([
  ['center', { position: new Vector3(0, 0, 0), ... }],
  ['desk', { position: new Vector3(2.5, 0, 0), ... }],
  ['terminal', { position: new Vector3(-2.5, 0, 0), ... }],
  // ... etc
])
```

Each zone has its own station instances, so isolation is already built-in!

### Collaboration Detection
```typescript
// In EventBus handler for tool events
if (event.type === 'tool_use' && event.tool === 'Task') {
  const parentTaskId = event.parentTaskId
  if (parentTaskId) {
    // This is a sub-task - form collaboration
    collaborationManager.formTeam(parentTaskId, [parentAgentId, currentAgentId])
  }
}
```

## Benefits

1. **Clear Ownership**: Each bot has a dedicated workstation
2. **Natural Collaboration**: Bots visibly gather when working together
3. **Hardcoded Coordination**: No AI-based conflicts over resources
4. **Scalable**: Easy to add more stations or zones
5. **Visual Clarity**: User can see who's doing what at a glance
6. **Token Efficient**: Route simple tasks to lightweight models

## Next Steps

1. Implement `StationAssignmentManager`
2. Update `SubagentManager` to use assignments
3. Test with 3-4 subagents spawning simultaneously
4. Add collaboration detection
5. Implement movement choreography
6. Integrate Cove/Ralph routing

## Questions for User

1. **Zone Model**: Isolated zones (Option A) or shared stations (Option B)?
2. **Max Agents**: Limit subagents to 8 (one per station) or allow overflow?
3. **Collaboration Visual**: Ring around station, line formation, or free-form gathering?
4. **Agent Colors**: Keep random colors or assign by specialization?
5. **Station Recycling**: When agent finishes, reassign station to new agent or keep it reserved?

---

**Author**: Claude Sonnet 4.5
**Date**: 2026-01-20
**Purpose**: Architecture document for multi-agent workspace improvements
