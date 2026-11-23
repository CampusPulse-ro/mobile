/**
 * The Microsoft session of app versions up to 0.1.3, which sent UPT Entra tokens to our API. A
 * phone that updates still holds its Microsoft refresh token here; the session exchanges it once
 * for our own tokens (`session.ts`), then deletes it. Nothing new is ever stored here, except the
 * token Microsoft rotates during that exchange.
 *
 * The token is split into chunks because SecureStore values over 2 KB may be refused. Each save
 * writes the chunks under a new generation (`.g<n>.<i>`) and only then points `.current`
 * (`"<n>:<parts>"`) at it, so a crash half-way keeps the previous token. Tokens saved before
 * generations (`.count` + `.<i>`) are still read.
 */
import * as SecureStore from 'expo-secure-store'

const KEY = 'auth.refreshToken'
const CHUNK = 1800

async function readPointer(): Promise<{ gen: number; parts: number } | null> {
  const [gen, parts] = ((await SecureStore.getItemAsync(`${KEY}.current`)) ?? '')
    .split(':')
    .map(Number)
  return gen > 0 && parts > 0 ? { gen, parts } : null
}

async function readChunks(prefix: string, parts: number): Promise<string | null> {
  let value = ''
  for (let i = 0; i < parts; i++) {
    const part = await SecureStore.getItemAsync(`${prefix}.${i}`)
    if (part === null) return null
    value += part
  }
  return value
}

async function deleteChunks(prefix: string, parts: number) {
  for (let i = 0; i < parts; i++) await SecureStore.deleteItemAsync(`${prefix}.${i}`)
}

async function clearOldestFormat() {
  const count = Number(await SecureStore.getItemAsync(`${KEY}.count`)) || 0
  await SecureStore.deleteItemAsync(`${KEY}.count`)
  await deleteChunks(KEY, Math.max(count, 8))
}

/** The stored Microsoft refresh token, or null when this phone has none. */
export async function readMicrosoftRefreshToken(): Promise<string | null> {
  const pointer = await readPointer()
  if (pointer) return readChunks(`${KEY}.g${pointer.gen}`, pointer.parts)
  const legacy = Number(await SecureStore.getItemAsync(`${KEY}.count`))
  return legacy ? readChunks(KEY, legacy) : null
}

/** Keeps the token Microsoft rotated to, in case the exchange has to be tried again later. */
export async function saveMicrosoftRefreshToken(value: string): Promise<void> {
  const old = await readPointer()
  const gen = (old?.gen ?? 0) + 1
  const parts = Math.ceil(value.length / CHUNK)
  for (let i = 0; i < parts; i++) {
    await SecureStore.setItemAsync(`${KEY}.g${gen}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK))
  }
  await SecureStore.setItemAsync(`${KEY}.current`, `${gen}:${parts}`)
  // The new token is safe now; leftovers of the old one only cost space.
  try {
    if (old) await deleteChunks(`${KEY}.g${old.gen}`, old.parts)
    await clearOldestFormat()
  } catch {
    // Removed with the rest after the exchange, or on sign-out.
  }
}

/** Deletes the Microsoft session from this phone, in every format it was ever stored in. */
export async function clearMicrosoftRefreshToken(): Promise<void> {
  const pointer = await readPointer()
  await SecureStore.deleteItemAsync(`${KEY}.current`)
  if (pointer) await deleteChunks(`${KEY}.g${pointer.gen}`, pointer.parts)
  await clearOldestFormat()
}
