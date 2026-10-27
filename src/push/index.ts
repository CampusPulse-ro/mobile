/**
 * Push notifications: the phone's Expo push token, registered with our API (`POST /me/devices`), and
 * the test send. The API's README, "Push notifications", says when clients register: on every launch
 * once allowed, after `POST /me`, and when the token changes; and to unregister on sign-out.
 */
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

import { api, unwrap } from '@/api/client'

// Show a notification that arrives while the app is open, too (the test one, a reminder).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

export type PushPermission = 'granted' | 'denied' | 'undetermined'

export async function getPushPermission(): Promise<PushPermission> {
  const { status } = await Notifications.getPermissionsAsync()
  return status
}

let registeredToken: string | null = null

async function expoPushToken(): Promise<string> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Class reminders',
      importance: Notifications.AndroidImportance.HIGH,
    })
  }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId })
  return data
}

/** Registers this phone with our API; asks for permission first when `ask` is set. */
export async function registerForPush({ ask }: { ask: boolean }): Promise<PushPermission> {
  if (!Device.isDevice || (Platform.OS !== 'android' && Platform.OS !== 'ios')) return 'denied'
  let permission = await getPushPermission()
  if (permission !== 'granted' && ask) {
    permission = (await Notifications.requestPermissionsAsync()).status
  }
  if (permission !== 'granted') return permission
  const token = await expoPushToken()
  unwrap(await api.POST('/me/devices', { body: { token, platform: Platform.OS } }))
  registeredToken = token
  return permission
}

/** Forgets this phone at our API (on sign-out, before the token goes). Never throws. */
export async function unregisterPush(): Promise<void> {
  try {
    const token =
      registeredToken ?? ((await getPushPermission()) === 'granted' ? await expoPushToken() : null)
    if (token) await api.DELETE('/me/devices', { body: { token } })
  } catch {
    // Signing out must work offline too; the API drops dead devices on its own.
  }
  registeredToken = null
}

/** `POST /me/notifications/test`: how many devices the push service accepted it for. */
export async function sendTestNotification(): Promise<number> {
  return unwrap(await api.POST('/me/notifications/test')).sent
}
