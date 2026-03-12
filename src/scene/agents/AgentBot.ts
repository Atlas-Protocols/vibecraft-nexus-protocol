import * as THREE from 'three';
import { Bot, Zap, Brain, Cpu } from 'lucide-react';

export type AgentType = 'antigravity' | 'jules' | 'ollama' | 'ralph' | 'iron-claw' | 'tiny-claw' | 'pico-claw' | 'claude-agent';

export class AgentBot {
    public mesh: THREE.Group;
    public type: AgentType;
    private color: number;
    private floatTime: number = 0;
    private targetPosition: THREE.Vector3 = new THREE.Vector3();
    private currentStatus: string = 'idle';

    constructor(type: AgentType) {
        this.type = type;
        this.mesh = new THREE.Group();
        this.color = this.getAgentColor(type);
        this.createMesh();
    }

    private getAgentColor(type: AgentType): number {
        switch (type) {
            case 'antigravity': return 0xa78bfa; // Purple
            case 'jules': return 0x22d3ee;       // Cyan
            case 'ollama': return 0xfbbf24;      // Amber
            case 'ralph': return 0x4ade80;       // Green
            case 'iron-claw': return 0xef4444;    // Red
            case 'tiny-claw': return 0xec4899;    // Pink
            case 'pico-claw': return 0x8b5cf6;    // Violet
            case 'claude-agent': return 0x6366f1; // Indigo
            default: return 0xffffff;
        }
    }

    private createMesh() {
        // Base Glow
        const baseGlowGeom = new THREE.SphereGeometry(0.4, 16, 16);
        const baseGlowMat = new THREE.MeshBasicMaterial({
            color: this.color,
            transparent: true,
            opacity: 0.2
        });
        const glow = new THREE.Mesh(baseGlowGeom, baseGlowMat);
        this.mesh.add(glow);

        // Central Core
        const coreGeom = new THREE.IcosahedronGeometry(0.2, 0);
        const coreMat = new THREE.MeshStandardMaterial({
            color: this.color,
            emissive: this.color,
            emissiveIntensity: 2,
            roughness: 0,
            metalness: 1
        });
        const core = new THREE.Mesh(coreGeom, coreMat);
        core.name = "core";
        this.mesh.add(core);

        // Orbiting Rings
        for (let i = 0; i < 2; i++) {
            const ringGeom = new THREE.TorusGeometry(0.35, 0.02, 8, 32);
            const ringMat = new THREE.MeshBasicMaterial({ color: this.color, transparent: true, opacity: 0.4 });
            const ring = new THREE.Mesh(ringGeom, ringMat);
            ring.rotation.x = Math.PI / 2;
            ring.rotation.y = (Math.PI / 4) * i;
            ring.name = `ring_${i}`;
            this.mesh.add(ring);
        }

        // Floating Status Label (Sprite)
        this.updateStatusLabel('IDLE');
    }

    public updateStatusLabel(status: string) {
        this.currentStatus = status;
        // Logic for canvas sprite update would go here
    }

    public update(delta: number) {
        this.floatTime += delta;

        // Floating animation
        this.mesh.position.y += Math.sin(this.floatTime * 2) * 0.002;

        // Core rotation
        const core = this.mesh.getObjectByName("core");
        if (core) core.rotation.y += delta * 1.5;

        // Ring movement
        const r0 = this.mesh.getObjectByName("ring_0");
        const r1 = this.mesh.getObjectByName("ring_1");
        if (r0) r0.rotation.z += delta * 0.5;
        if (r1) r1.rotation.x += delta * 0.8;

        // Smooth move to target
        this.mesh.position.lerp(this.targetPosition, delta * 2);
    }

    public moveTo(pos: THREE.Vector3) {
        this.targetPosition.copy(pos);
        this.targetPosition.y += 1.5; // Hover height
    }
}
