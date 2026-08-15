// ─────────────────────────────────────────────────────────────────────────────
// Push notifications (Android only). Registers the device with FCM via
// Capacitor, saves the token to the player's profile so the server can target
// it, and routes taps into a single in-app action handler. No-ops gracefully on
// web or when permissions are denied.
// ─────────────────────────────────────────────────────────────────────────────
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { ensureIdentity, savePushToken } from './sync'

export type PushActionData = Record<string, string>

let pushActionHandler: ((data: PushActionData) => void) | null = null

/**
 * Registers a callback for when the user taps a push notification. App.tsx
 * uses it to deep-link (e.g. a friend-request push opens the Friends tab).
 */
export const setPushActionHandler = (h: (data: PushActionData) => void): void => {
  pushActionHandler = h
}

/**
 * Registers the device for Firebase push notifications (Android only — the web
 * build no-ops). The FCM token is stored in Supabase `push_tokens`; the
 * notify-update / notify-user edge functions use it to reach this phone even
 * when the app is fully closed, so releases, friend requests and challenges
 * arrive as real system notifications.
 *
 * Safe to call on every launch: registration is idempotent and the token is
 * upserted, so the stored token always matches the device.
 */
export async function initPushNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return
  try {
    let status = (await PushNotifications.checkPermissions()).receive
    if (status === 'prompt' || status === 'prompt-with-rationale') {
      status = (await PushNotifications.requestPermissions()).receive
    }
    if (status !== 'granted') return

    // Listeners MUST be attached before register(): FCM can deliver the token
    // the moment register() resolves, and a listener attached after would miss
    // it — leaving the device registered but the app never storing the token.
    PushNotifications.addListener('registration', async (token) => {
      if (!token.value) return
      const uid = await ensureIdentity()
      if (uid) await savePushToken(uid, token.value)
    })

    PushNotifications.addListener('registrationError', (err) => {
      // e.g. google-services.json not added yet — the app works, just no pushes.
      console.warn('[push] FCM registration failed', err.error)
    })

    await PushNotifications.register()

    // Tapping a notification opens the app. Updates surface via the in-app
    // banner (it re-checks GitHub on launch/resume); friend requests and
    // challenges deep-link to the Friends tab via the action handler.
    PushNotifications.addListener('pushNotificationActionPerformed', (res) => {
      const data = (res.notification?.data ?? {}) as PushActionData
      pushActionHandler?.(data)
    })
  } catch (e) {
    console.warn('[push] init failed', (e as Error).message)
  }
}
