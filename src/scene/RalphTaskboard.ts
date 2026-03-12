/**
 * RalphTaskboard - 3D visualization of PRD stories on taskboard station
 *
 * Shows sticky notes for each story with color coding:
 * - Gray: Pending (passes: false, not started)
 * - Blue: In Progress (current story being worked on)
 * - Green: Completed (passes: true)
 */

import * as THREE from 'three'

interface Story {
  id: string
  title: string
  passes: boolean
}

interface StickyNote {
  mesh: THREE.Mesh
  story: Story
  status: 'pending' | 'working' | 'passed'
}

export class RalphTaskboard {
  private notes: Map<string, StickyNote> = new Map()
  private group: THREE.Group
  private basePosition: THREE.Vector3

  // Colors
  private readonly COLOR_PENDING = 0x94a3b8  // Gray
  private readonly COLOR_WORKING = 0x3b82f6  // Blue
  private readonly COLOR_PASSED = 0x22c55e   // Green

  constructor(position: THREE.Vector3) {
    this.group = new THREE.Group()
    this.basePosition = position.clone()
    this.group.position.copy(position)
  }

  /**
   * Update taskboard with stories from PRD
   */
  updateStories(stories: Story[], currentStoryId?: string): void {
    // Clear existing notes
    this.clearNotes()

    // Create notes in a grid layout
    const cols = 3
    const noteWidth = 0.3
    const noteHeight = 0.4
    const spacing = 0.1

    stories.forEach((story, index) => {
      const row = Math.floor(index / cols)
      const col = index % cols

      const x = col * (noteWidth + spacing) - (cols - 1) * (noteWidth + spacing) / 2
      const y = -row * (noteHeight + spacing)

      // Determine status
      let status: 'pending' | 'working' | 'passed' = 'pending'
      if (story.passes) {
        status = 'passed'
      } else if (currentStoryId && story.id === currentStoryId) {
        status = 'working'
      }

      const note = this.createStickyNote(story, x, y, status)
      this.notes.set(story.id, note)
      this.group.add(note.mesh)
    })
  }

  /**
   * Create a single sticky note mesh
   */
  private createStickyNote(
    story: Story,
    x: number,
    y: number,
    status: 'pending' | 'working' | 'passed'
  ): StickyNote {
    // Create note geometry (flat square)
    const geometry = new THREE.PlaneGeometry(0.28, 0.38)

    // Color based on status
    let color: number
    switch (status) {
      case 'passed':
        color = this.COLOR_PASSED
        break
      case 'working':
        color = this.COLOR_WORKING
        break
      default:
        color = this.COLOR_PENDING
    }

    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: status === 'working' ? 0.3 : 0.1,
      roughness: 0.8,
      metalness: 0.1,
      side: THREE.DoubleSide
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, y, 0.01) // Slight offset from board

    // Add to user data for interaction
    mesh.userData = {
      type: 'ralphStory',
      storyId: story.id,
      story
    }

    // Animate in
    mesh.scale.set(0, 0, 1)
    const targetScale = 1
    const animDuration = 300 + Math.random() * 200
    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / animDuration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // Ease out

      mesh.scale.x = eased * targetScale
      mesh.scale.y = eased * targetScale

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }
    animate()

    return { mesh, story, status }
  }

  /**
   * Update a specific story's status
   */
  updateStoryStatus(storyId: string, passes: boolean, isCurrent: boolean = false): void {
    const note = this.notes.get(storyId)
    if (!note) return

    const newStatus: 'pending' | 'working' | 'passed' = passes ? 'passed' : isCurrent ? 'working' : 'pending'

    if (note.status === newStatus) return

    note.status = newStatus

    // Update color
    let color: number
    switch (newStatus) {
      case 'passed':
        color = this.COLOR_PASSED
        break
      case 'working':
        color = this.COLOR_WORKING
        break
      default:
        color = this.COLOR_PENDING
    }

    const material = note.mesh.material as THREE.MeshStandardMaterial
    material.color.setHex(color)
    material.emissive.setHex(color)
    material.emissiveIntensity = newStatus === 'working' ? 0.3 : 0.1

    // Pulse animation when status changes
    const originalScale = note.mesh.scale.clone()
    const pulseScale = 1.2
    const pulseDuration = 300

    const startTime = Date.now()
    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = elapsed / pulseDuration

      if (progress < 0.5) {
        // Grow
        const t = progress * 2
        note.mesh.scale.setScalar(THREE.MathUtils.lerp(1, pulseScale, t))
      } else if (progress < 1) {
        // Shrink back
        const t = (progress - 0.5) * 2
        note.mesh.scale.setScalar(THREE.MathUtils.lerp(pulseScale, 1, t))
      }

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        note.mesh.scale.copy(originalScale)
      }
    }
    animate()
  }

  /**
   * Clear all notes
   */
  private clearNotes(): void {
    this.notes.forEach(note => {
      this.group.remove(note.mesh)
      note.mesh.geometry.dispose()
      if (Array.isArray(note.mesh.material)) {
        note.mesh.material.forEach(m => m.dispose())
      } else {
        note.mesh.material.dispose()
      }
    })
    this.notes.clear()
  }

  /**
   * Get the Three.js group
   */
  getGroup(): THREE.Group {
    return this.group
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.clearNotes()
  }
}
