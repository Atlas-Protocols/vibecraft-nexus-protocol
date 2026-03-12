import { StationType } from '../../shared/types'

/**
 * Manages assignment of agents to specific workstations
 * Ensures each agent has a unique spot to work
 */
export class StationAssignmentManager {
    private availableStations: StationType[] = [
        'desk', 'terminal', 'scanner', 'bookshelf',
        'antenna', 'portal', 'taskboard', 'workbench'
    ]
    private assignments: Map<string, StationType> = new Map()

    /**
     * Assign a station to an agent (round-robin)
     */
    assignStation(agentId: string): StationType {
        // Check if already assigned
        if (this.assignments.has(agentId)) {
            return this.assignments.get(agentId)!
        }

        // Assign next available based on count
        // This gives a consistent mapping: Agent 1 -> desk, Agent 2 -> terminal, etc.
        // We use a simplified modulo approach based on the number of assignments
        const stationIndex = this.assignments.size % this.availableStations.length
        const station = this.availableStations[stationIndex]

        this.assignments.set(agentId, station)
        console.log(`[StationManager] Assigned ${agentId} to ${station}`)

        return station
    }

    /**
     * Get the assigned station for an agent
     */
    getStation(agentId: string): StationType | undefined {
        return this.assignments.get(agentId)
    }

    /**
     * Release a station (optional, if we want dynamic reallocation)
     */
    releaseStation(agentId: string): void {
        if (this.assignments.has(agentId)) {
            const station = this.assignments.get(agentId)
            this.assignments.delete(agentId)
            console.log(`[StationManager] Released ${station} from ${agentId}`)
        }
    }
}
