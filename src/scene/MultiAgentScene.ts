/**
 * MultiAgentScene - 3D visualization for multiple agents
 *
 * Creates distinct character bodies and zones for each agent
 * Displays real-time collaboration without OAuth conflicts
 */

import * as THREE from 'three'
import type { BaseAgent } from '../agents/BaseAgent'

export interface AgentCharacter {
  id: string
  name: string
  mesh: THREE.Group
  zone: THREE.Mesh
  position: THREE.Vector3
  color: number
  avatar: string
}

export class MultiAgentScene {
  private characters: Map<string, AgentCharacter> = new Map()
  private scene: THREE.Scene
  private zoneLayout: 'grid' | 'circle' | 'row' = 'grid'
  private zoneSize: number = 4
  private zoneSpacing: number = 1

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  /**
   * Create character body for an agent
   */
  createCharacter(agent: BaseAgent): AgentCharacter {
    const agentId = agent.getId()
    const color = parseInt(agent.getColor().replace('#', '0x'))

    // Create character group
    const group = new THREE.Group()

    // Body (simple capsule-like shape)
    const bodyGeometry = new THREE.CapsuleGeometry(0.3, 0.8, 8, 16)
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.2,
      roughness: 0.7,
      metalness: 0.3
    })
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
    body.position.y = 0.9
    body.castShadow = true
    group.add(body)

    // Head (sphere with avatar texture)
    const headGeometry = new THREE.SphereGeometry(0.4, 16, 16)
    const headMaterial = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.3,
      roughness: 0.5,
      metalness: 0.2
    })
    const head = new THREE.Mesh(headGeometry, headMaterial)
    head.position.y = 1.8
    head.castShadow = true
    group.add(head)

    // Avatar label (text sprite)
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const ctx = canvas.getContext('2d')!
    ctx.font = 'bold 100px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(agent.getAvatar(), 64, 64)

    const texture = new THREE.CanvasTexture(canvas)
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture })
    const sprite = new THREE.Sprite(spriteMaterial)
    sprite.position.y = 2.5
    sprite.scale.set(0.8, 0.8, 1)
    group.add(sprite)

    // Name label
    const nameCanvas = document.createElement('canvas')
    nameCanvas.width = 512
    nameCanvas.height = 128
    const nameCtx = nameCanvas.getContext('2d')!
    nameCtx.font = 'bold 48px Arial'
    nameCtx.fillStyle = '#ffffff'
    nameCtx.textAlign = 'center'
    nameCtx.textBaseline = 'middle'
    nameCtx.fillText(agent.getName(), 256, 64)

    const nameTexture = new THREE.CanvasTexture(nameCanvas)
    const nameSpriteMaterial = new THREE.SpriteMaterial({ map: nameTexture })
    const nameSprite = new THREE.Sprite(nameSpriteMaterial)
    nameSprite.position.y = 3.2
    nameSprite.scale.set(2, 0.5, 1)
    group.add(nameSprite)

    // Calculate zone position based on layout
    const position = this.calculateZonePosition(this.characters.size)

    // Create zone floor
    const zoneGeometry = new THREE.PlaneGeometry(this.zoneSize, this.zoneSize)
    const zoneMaterial = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.1,
      opacity: 0.3,
      transparent: true,
      side: THREE.DoubleSide
    })
    const zone = new THREE.Mesh(zoneGeometry, zoneMaterial)
    zone.rotation.x = -Math.PI / 2
    zone.position.copy(position)
    zone.receiveShadow = true

    // Position character in center of zone
    group.position.set(position.x, 0, position.z)

    // Add to scene
    this.scene.add(group)
    this.scene.add(zone)

    const character: AgentCharacter = {
      id: agentId,
      name: agent.getName(),
      mesh: group,
      zone,
      position,
      color,
      avatar: agent.getAvatar()
    }

    this.characters.set(agentId, character)
    return character
  }

  /**
   * Calculate zone position based on layout
   */
  private calculateZonePosition(index: number): THREE.Vector3 {
    const totalSize = this.zoneSize + this.zoneSpacing

    switch (this.zoneLayout) {
      case 'grid': {
        const cols = 2
        const row = Math.floor(index / cols)
        const col = index % cols
        return new THREE.Vector3(
          col * totalSize - (cols - 1) * totalSize / 2,
          0,
          row * totalSize
        )
      }

      case 'circle': {
        const angle = (index / 4) * Math.PI * 2
        const radius = 6
        return new THREE.Vector3(
          Math.cos(angle) * radius,
          0,
          Math.sin(angle) * radius
        )
      }

      case 'row': {
        return new THREE.Vector3(
          index * totalSize - (3 * totalSize) / 2,
          0,
          0
        )
      }

      default:
        return new THREE.Vector3(0, 0, 0)
    }
  }

  /**
   * Get character by agent ID
   */
  getCharacter(agentId: string): AgentCharacter | undefined {
    return this.characters.get(agentId)
  }

  /**
   * Update character animation based on activity
   */
  updateCharacter(agentId: string, activity: 'idle' | 'working' | 'thinking'): void {
    const character = this.characters.get(agentId)
    if (!character) return

    switch (activity) {
      case 'working': {
        // Pulse emissive intensity
        const body = character.mesh.children[0] as THREE.Mesh
        const mat = body.material as THREE.MeshStandardMaterial
        mat.emissiveIntensity = 0.5
        break
      }

      case 'thinking': {
        // Gentle bob animation
        const time = Date.now() * 0.001
        character.mesh.position.y = Math.sin(time * 2) * 0.1
        break
      }

      case 'idle':
      default: {
        const body = character.mesh.children[0] as THREE.Mesh
        const mat = body.material as THREE.MeshStandardMaterial
        mat.emissiveIntensity = 0.2
        character.mesh.position.y = 0
        break
      }
    }
  }

  /**
   * Pulse zone floor (e.g., on task completion)
   */
  pulseZone(agentId: string): void {
    const character = this.characters.get(agentId)
    if (!character) return

    const material = character.zone.material as THREE.MeshStandardMaterial
    const originalIntensity = material.emissiveIntensity

    material.emissiveIntensity = 0.8

    setTimeout(() => {
      material.emissiveIntensity = originalIntensity
    }, 500)
  }

  /**
   * Remove character from scene
   */
  removeCharacter(agentId: string): void {
    const character = this.characters.get(agentId)
    if (!character) return

    this.scene.remove(character.mesh)
    this.scene.remove(character.zone)

    // Dispose geometries and materials
    character.mesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose())
        } else {
          obj.material.dispose()
        }
      }
    })

    character.zone.geometry.dispose()
    if (Array.isArray(character.zone.material)) {
      character.zone.material.forEach(m => m.dispose())
    } else {
      character.zone.material.dispose()
    }

    this.characters.delete(agentId)
  }

  /**
   * Get all characters
   */
  getAllCharacters(): AgentCharacter[] {
    return Array.from(this.characters.values())
  }

  /**
   * Clean up all characters
   */
  dispose(): void {
    const agentIds = Array.from(this.characters.keys())
    agentIds.forEach(id => this.removeCharacter(id))
  }
}
