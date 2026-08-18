import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { ensureIdentity, savePushToken } from './sync'

export type PushActionData = Record<string, string>

let pushActionHandler: ((data: PushActionData) => void) | null = null

export const setPushActionHandler = (h: (data: PushActionData) => void): void => {
  pushActionHandler = h
}

/**
 * Registers the device for FCM pushes (Android only; no-ops on web) and saves the
 * token to the player's profile so the edge functions can reach this phone even
 * when the app is closed. Safe to call on every launch - registration is
 * idempotent and the token is upserted. Taps route to the in-app action handler.
 */
export async function initPushNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return
  try {
    let status = (await PushNotifications.checkPermissions()).receive
    if (status === 'prompt' || status === 'prompt-with-rationale') {
      status = (await PushNotifications.requestPermissions()).receive
    }
    if (status !== 'granted') return

    // Ensure the notification channel exists (Android 8+). FCM targets it via the
    // manifest meta-data default_notification_channel_id.
    await PushNotifications.createChannel({
      id: 'sidequest_notifications',
      name: 'SideQuest notifications',
      importance: 4,
      vibration: true,
    }).catch(() => {})

    // Listeners must be attached before register(): the token can arrive the moment
    // register() resolves, and a listener attached after would miss it.
    PushNotifications.addListener('registration', async (token) => {
      if (!token.value) return
      const uid = await ensureIdentity()
      if (uid) await savePushToken(uid, token.value)
    })
    PushNotifications.addListener('registrationError', (err) => {
      console.warn('[push] FCM registration failed', err.error)
    })
    await PushNotifications.register()

    PushNotifications.addListener('pushNotificationActionPerformed', (res) => {
      pushActionHandler?.((res.notification?.data ?? {}) as PushActionData)
    })
  } catch (e) {
    console.warn('[push] init failed', (e as Error).message)
  }
}