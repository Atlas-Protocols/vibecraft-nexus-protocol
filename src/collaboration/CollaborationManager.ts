/**
 * CollaborationManager - Orchestrates multi-agent task coordination
 * 
 * Enables agents to:
 * - Request collaboration from other agents
 * - Accept/reject collaboration requests
 * - Track active multi-agent workflows
 */

export interface CollaborationRequest {
    id: string;
    fromAgent: string;
    toAgent: string;
    task: string;
    status: 'pending' | 'accepted' | 'rejected' | 'completed';
    createdAt: number;
    acceptedAt?: number;
    completedAt?: number;
}

export interface ActiveCollaboration {
    requestId: string;
    agents: string[];
    task: string;
    startedAt: number;
}

export class CollaborationManager {
    private requests: Map<string, CollaborationRequest> = new Map();
    private activeCollaborations: Map<string, ActiveCollaboration> = new Map();
    private eventCallback?: (event: any) => void;

    /**
     * Register callback for collaboration events
     */
    onEvent(callback: (event: any) => void): void {
        this.eventCallback = callback;
    }

    /**
     * Request collaboration from another agent
     */
    requestCollaboration(fromAgent: string, toAgent: string, task: string): CollaborationRequest {
        const request: CollaborationRequest = {
            id: `collab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            fromAgent,
            toAgent,
            task,
            status: 'pending',
            createdAt: Date.now(),
        };

        this.requests.set(request.id, request);

        // Emit event
        this.emitEvent({
            type: 'collaboration_request',
            requestId: request.id,
            fromAgent,
            toAgent,
            task,
            timestamp: Date.now(),
        });

        console.log(`[Collaboration] ${fromAgent} requested help from ${toAgent}: "${task}"`);
        return request;
    }

    /**
     * Accept a collaboration request
     */
    acceptCollaboration(requestId: string): boolean {
        const request = this.requests.get(requestId);
        if (!request || request.status !== 'pending') {
            console.warn(`[Collaboration] Cannot accept request ${requestId}`);
            return false;
        }

        request.status = 'accepted';
        request.acceptedAt = Date.now();

        // Create active collaboration
        const collaboration: ActiveCollaboration = {
            requestId,
            agents: [request.fromAgent, request.toAgent],
            task: request.task,
            startedAt: Date.now(),
        };
        this.activeCollaborations.set(requestId, collaboration);

        // Emit event
        this.emitEvent({
            type: 'collaboration_accepted',
            requestId,
            agents: collaboration.agents,
            task: request.task,
            timestamp: Date.now(),
        });

        console.log(`[Collaboration] ${request.toAgent} accepted collaboration on "${request.task}"`);
        return true;
    }

    /**
     * Reject a collaboration request
     */
    rejectCollaboration(requestId: string, reason?: string): boolean {
        const request = this.requests.get(requestId);
        if (!request || request.status !== 'pending') {
            return false;
        }

        request.status = 'rejected';

        this.emitEvent({
            type: 'collaboration_rejected',
            requestId,
            reason,
            timestamp: Date.now(),
        });

        console.log(`[Collaboration] Request ${requestId} rejected${reason ? `: ${reason}` : ''}`);
        return true;
    }

    /**
     * Mark collaboration as completed
     */
    completeCollaboration(requestId: string): boolean {
        const request = this.requests.get(requestId);
        const collaboration = this.activeCollaborations.get(requestId);

        if (!request || !collaboration) {
            return false;
        }

        request.status = 'completed';
        request.completedAt = Date.now();
        this.activeCollaborations.delete(requestId);

        this.emitEvent({
            type: 'collaboration_completed',
            requestId,
            agents: collaboration.agents,
            duration: Date.now() - collaboration.startedAt,
            timestamp: Date.now(),
        });

        console.log(`[Collaboration] Completed: ${collaboration.task}`);
        return true;
    }

    /**
     * Get all active collaborations
     */
    getActiveCollaborations(): ActiveCollaboration[] {
        return Array.from(this.activeCollaborations.values());
    }

    /**
     * Get pending requests for an agent
     */
    getPendingRequests(agentId: string): CollaborationRequest[] {
        return Array.from(this.requests.values()).filter(
            r => r.toAgent === agentId && r.status === 'pending'
        );
    }

    /**
     * Get collaboration history for an agent
     */
    getHistory(agentId: string): CollaborationRequest[] {
        return Array.from(this.requests.values()).filter(
            r => r.fromAgent === agentId || r.toAgent === agentId
        );
    }

    /**
     * Store memory for an agent (persistent via backend)
     * Harvested from: AI Hub agent-with-mcp-memory
     */
    async storeMemory(agentId: string, key: string, value: any): Promise<boolean> {
        try {
            const response = await fetch(`${this.apiUrl}/agent/memory/store`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agent_id: agentId, key, value })
            });
            return response.ok;
        } catch (error) {
            console.error('[Memory] Store failed:', error);
            return false;
        }
    }

    /**
     * Retrieve memory for an agent
     */
    async retrieveMemory(agentId: string, key: string): Promise<any> {
        try {
            const response = await fetch(`${this.apiUrl}/agent/memory/${agentId}/${key}`);
            if (!response.ok) return null;
            const data = await response.json() as { value: any };
            return data.value;
        } catch (error) {
            console.error('[Memory] Retrieve failed:', error);
            return null;
        }
    }

    /**
     * Get shared context across multiple collaborating agents
     */
    async getSharedContext(agentIds: string[]): Promise<Record<string, any>> {
        try {
            const response = await fetch(`${this.apiUrl}/agent/memory/shared`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agent_ids: agentIds })
            });
            if (!response.ok) return {};
            const data = await response.json() as { context: Record<string, any> };
            return data.context;
        } catch (error) {
            console.error('[Memory] Shared context failed:', error);
            return {};
        }
    }

    /**
     * Emit collaboration event
     */
    private emitEvent(event: any): void {
        if (this.eventCallback) {
            this.eventCallback(event);
        }
    }

    private apiUrl: string = 'http://localhost:8080/api';

    // ============ EventBus Integration for Autonomous Reactions ============

    private processedEventIds: Set<number> = new Set();

    /** Subscribe to agent events - enables autonomous reactions */
    subscribeToAgentEvents(onEvent: (event: any) => void): void {
        setInterval(async () => {
            try {
                const agents = ['antigravity', 'jules', 'ralph', 'cove', 'ollama'];
                for (const agentId of agents) {
                    const response = await fetch(`${this.apiUrl}/events/history/${agentId}?limit=5`);
                    if (response.ok) {
                        const data = await response.json() as { events?: any[] };
                        (data.events || []).forEach((event: any) => {
                            if (!this.processedEventIds.has(event.id)) {
                                this.processedEventIds.add(event.id);
                                onEvent(event);
                            }
                        });
                    }
                }
            } catch (error) {
                console.error('[EventBus] Poll failed:', error);
            }
        }, 2000);
    }

    /** Emit agent action event to backend EventBus */
    async emitAgentEvent(agentId: string, eventType: string, data: any): Promise<boolean> {
        try {
            const response = await fetch(`${this.apiUrl}/events/emit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event_type: eventType, agent_id: agentId, data })
            });
            return response.ok;
        } catch (error) {
            console.error('[EventBus] Emit failed:', error);
            return false;
        }
    }

}

// Global instance
export const collaborationManager = new CollaborationManager();

