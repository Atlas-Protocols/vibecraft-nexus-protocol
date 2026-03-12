import * as THREE from 'three';
import { AgentBot, AgentType } from './AgentBot';

export type ZoneType = 'CODING' | 'DEPLOY' | 'REST';

export class AgentManager {
    private agents: Map<string, AgentBot> = new Map();
    private scene: THREE.Scene;

    // Hexagonal ring definitions
    private readonly CODING_POS = new THREE.Vector3(0, 0, 0);
    private deployPositions: THREE.Vector3[] = [];
    private restPositions: THREE.Vector3[] = [];

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.generateHexRings();
        this.spawnInitialAgents();
    }

    private generateHexRings() {
        // Ring 1: Deployment (R=7)
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            this.deployPositions.push(new THREE.Vector3(Math.cos(angle) * 7, 0, Math.sin(angle) * 7));
        }
        // Ring 2: Resting (R=14)
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            this.restPositions.push(new THREE.Vector3(Math.cos(angle) * 14, 0, Math.sin(angle) * 14));
        }
    }

    private spawnInitialAgents() {
        const types: AgentType[] = ['antigravity', 'jules', 'ollama', 'ralph'];
        types.forEach((type, i) => {
            const agent = new AgentBot(type);
            // Agents start in Resting Zone
            agent.mesh.position.copy(this.restPositions[i]);
            agent.moveTo(this.restPositions[i]);
            this.agents.set(type, agent);
            this.scene.add(agent.mesh);
        });
    }

    public updateAgentStatus(agentId: string, status: string, taskType?: string) {
        const agent = this.agents.get(agentId);
        if (!agent) return;

        agent.updateStatusLabel(status);

        // Logical Zone Mapping
        if (status === 'IDLE') {
            const idx = Array.from(this.agents.keys()).indexOf(agentId);
            agent.moveTo(this.restPositions[idx]);
        } else if (taskType === 'deployment' || status === 'DEPLOYING') {
            const idx = Array.from(this.agents.keys()).indexOf(agentId);
            agent.moveTo(this.deployPositions[idx]);
        } else if (taskType === 'implementation' || taskType === 'code_review' || status === 'WORKING') {
            // Main Coding Hex
            agent.moveTo(this.CODING_POS);
        }
    }

    public update(delta: number) {
        this.agents.forEach(agent => agent.update(delta));
    }
}
