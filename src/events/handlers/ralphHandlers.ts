/**
 * Ralph Event Handlers
 *
 * Handles Ralph-specific events like story completions and celebrations
 */

import { eventBus } from '../EventBus'
import type { NotificationEvent } from '../../../shared/types'

/**
 * Register Ralph-specific event handlers
 */
export function registerRalphHandlers(): void {
  // Handle Ralph story completion notifications
  eventBus.on('notification', (event, ctx) => {
    // Type guard to ensure this is a NotificationEvent
    if (event.type !== 'notification') return

    const notifEvent = event as NotificationEvent

    // Only handle Ralph session events
    if (!notifEvent.sessionId || !notifEvent.sessionId.startsWith('ralph-')) {
      return
    }

    // Check if this is a story completion notification
    if (notifEvent.message && notifEvent.message.includes('Story completed:')) {
      handleStoryCompletion(notifEvent, ctx)
    }
  })
}

/**
 * Handle Ralph story completion - trigger celebration!
 */
function handleStoryCompletion(event: NotificationEvent, ctx: any): void {
  const { scene, soundEnabled, session } = ctx

  if (!scene || !session) return

  // Extract story title from message
  const storyTitle = event.message.replace('Story completed: ', '')

  // 1. Play victory dance animation
  const claude = session.claude
  if (claude && typeof claude.forcePlay === 'function') {
    claude.forcePlay('victoryDance')
  }

  // 2. Pulse zone floor green
  if (scene.pulseZone) {
    scene.pulseZone(event.sessionId)

    // Flash the zone floor green temporarily
    const zone = scene.zones?.get(event.sessionId)
    if (zone && zone.floor) {
      const originalColor = zone.floor.material.color.getHex()
      zone.floor.material.color.setHex(0x22c55e) // Green
      zone.floor.material.emissive.setHex(0x22c55e)
      zone.floor.material.emissiveIntensity = 0.5

      // Fade back to original after 2 seconds
      setTimeout(() => {
        zone.floor.material.color.setHex(originalColor)
        zone.floor.material.emissive.setHex(0x000000)
        zone.floor.material.emissiveIntensity = 0
      }, 2000)
    }
  }

  // 3. Show floating notification
  if (scene.notifications && scene.notifications.show) {
    scene.notifications.show(event.sessionId, {
      text: storyTitle,
      icon: '🎉',
      style: 'success',
      duration: 4
    })
  }

  // 4. Play success sound
  if (soundEnabled && ctx.soundManager) {
    // Use existing sound system
    // The soundHandlers already handle this via the notification event
  }

  console.log(`🎉 Ralph story completed: ${storyTitle}`)
}
