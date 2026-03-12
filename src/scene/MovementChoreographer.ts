/**
 * MovementChoreographer - Routes agents to optimal stations based on tool usage
 * 
 * Manages spatial intelligence for multi-agent coordination:
 * - Maps tools to appropriate stations (e.g., bash → terminal, view_code → desk)
 * - Prevents station conflicts (e.g., two agents editing same file)
 * - Dynamically updates agent positions in Vibecraft 3D scene
 */

import type { StationType } from '../../shared/types';

export interface ToolToStationMapping {
    [toolName: string]: StationType;
}

export interface StationOccupancy {
    station: StationType;
    agentId: string | null;
    lockedUntil?: number; // Timestamp when station will be free
}

export class MovementChoreographer {
    // Tool → Station mapping
    private toolStationMap: ToolToStationMapping = {
        // Code tools
        'view_file': 'desk',
        'view_code_item': 'desk',
        'view_file_outline': 'desk',
        'replace_file_content': 'desk',
        'multi_replace_file_content': 'desk',
        'write_to_file': 'desk',

        // Terminal tools
        'run_command': 'terminal',
        'send_command_input': 'terminal',
        'command_status': 'terminal',

        // Search tools
        'grep_search': 'bookshelf',
        'find_by_name': 'bookshelf',
        'list_dir': 'bookshelf',

        // Planning tools
        'task_boundary': 'taskboard',

        // Web tools
        'search_web': 'antenna',
        'read_url_content': 'antenna',

        // AI tools (default to portal for now)
        'mcp_antigravity-workspace_ask_user': 'portal',
    };

    // Track station occupancy per session/zone
    private stationOccupancy = new Map<string, Map<StationType, StationOccupancy>>();

    // Callback for position updates
    private onPositionUpdate?: (agentId: string, station: StationType) => void;

    /**
     * Register callback for position updates
     */
    onUpdate(callback: (agentId: string, station: StationType) => void): void {
        this.onPositionUpdate = callback;
    }

    /**
     * Route agent to optimal station based on tool
     */
    routeToStation(agentId: string, sessionId: string, toolName: string): StationType {
        const station = this.toolStationMap[toolName] || 'desk'; // Default to desk

        // Update occupancy
        this.occupy(sessionId, station, agentId);

        // Emit position update
        if (this.onPositionUpdate) {
            this.onPositionUpdate(agentId, station);
        }

        console.log(`[Movement] ${agentId} → ${station} (tool: ${toolName})`);
        return station;
    }

    /**
     * Mark station as occupied by an agent
     */
    private occupy(sessionId: string, station: StationType, agentId: string, duration: number = 5000): void {
        if (!this.stationOccupancy.has(sessionId)) {
            this.stationOccupancy.set(sessionId, new Map());
        }

        const sessionMap = this.stationOccupancy.get(sessionId)!;
        sessionMap.set(station, {
            station,
            agentId,
            lockedUntil: Date.now() + duration,
        });

        // Auto-release after duration
        setTimeout(() => {
            const current = sessionMap.get(station);
            if (current?.agentId === agentId && current.lockedUntil && Date.now() >= current.lockedUntil) {
                sessionMap.set(station, { station, agentId: null });
            }
        }, duration);
    }

    /**
     * Check if a station is available
     */
    isAvailable(sessionId: string, station: StationType): boolean {
        const sessionMap = this.stationOccupancy.get(sessionId);
        if (!sessionMap) return true;

        const occupancy = sessionMap.get(station);
        if (!occupancy || !occupancy.agentId) return true;

        // Check if lock expired
        if (occupancy.lockedUntil && Date.now() >= occupancy.lockedUntil) {
            return true;
        }

        return false;
    }

    /**
     * Get current occupant of a station
     */
    getOccupant(sessionId: string, station: StationType): string | null {
        const sessionMap = this.stationOccupancy.get(sessionId);
        if (!sessionMap) return null;

        const occupancy = sessionMap.get(station);
        if (!occupancy) return null;

        // Check expiry
        if (occupancy.lockedUntil && Date.now() >= occupancy.lockedUntil) {
            return null;
        }

        return occupancy.agentId;
    }

    /**
     * Add a custom tool → station mapping
     */
    registerToolMapping(toolName: string, station: StationType): void {
        this.toolStationMap[toolName] = station;
        console.log(`[Movement] Registered: ${toolName} → ${station}`);
    }
}

// Global instance
export const movementChoreographer = new MovementChoreographer();
