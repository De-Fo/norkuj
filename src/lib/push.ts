import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

/** Push is available when the site ships a VAPID key and the browser supports it. */
export function pushSupported(): boolean {
  return typeof VAPID_PUBLIC_KEY === 'string' && VAPID_PUBLIC_KEY.length > 0 &&
    typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
}

/** Register the service worker (safe to call repeatedly). */
export async function registerPushWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  try {
    await navigator.serviceWorker.register('/sw.js')
  } catch {
    /* non-fatal */
  }
}

/** Ensure the SW is registered, then return its registration (null if unsupported). */
async function ensureRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  let reg = await navigator.serviceWorker.getRegistration('/sw.js')
  if (!reg) {
    await navigator.serviceWorker.register('/sw.js')
    reg = await navigator.serviceWorker.getRegistration('/sw.js')
  }
  return reg ?? null
}

/** Current active subscription, if any (no browser permission prompt). */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  const reg = await ensureRegistration()
  if (!reg) return null
  return reg.pushManager.getSubscription()
}

async function subscribeInternal(): Promise<PushSubscription | null> {
  const reg = await ensureRegistration()
  if (!reg) return null
  const subscribe = () => reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
  })

  try {
    return await subscribe()
  } catch (e) {
    // Stale sub bound to a rotated applicationServerKey blocks fresh subscribe → drop it & retry once.
    const msg = (e as Error)?.message || ''
    const name = (e as DOMException)?.name
    const staleKey = name === 'InvalidStateError' || /different applicationServerKey|already exists/i.test(msg)
    if (staleKey) {
      const existing = await reg.pushManager.getSubscription().catch(() => null)
      if (existing) await existing.unsubscribe().catch(() => {})
      try {
        return await subscribe()
      } catch (e2) {
        console.error('[push] subscribe retry failed', e2)
        throw e2
      }
    }
    console.error('[push] subscribe failed', e)
    throw e
  }
}

async function saveSubscription(sub: PushSubscription): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { error } = await (supabase.from('push_subscriptions') as any).upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      keys: sub.toJSON().keys,
      push_enabled: true,
    },
    { onConflict: 'endpoint' }
  )
  if (error) {
    // Log in prod too — a silent save failure is exactly why a device "enables" push but never gets it.
    console.error('[push] save subscription failed', (error as any)?.code ?? (error as any)?.message)
    return false
  }
  return true
}

async function deleteSubscription(sub: PushSubscription): Promise<void> {
  // Remove locally and in DB (matches the OnConflict on endpoint).
  await sub.unsubscribe().catch(() => {})
  const { error } = await (supabase.from('push_subscriptions') as any)
    .delete()
    .eq('endpoint', sub.endpoint)
  if (error && import.meta.env.DEV) console.error('[push] delete', error)
}

/** Request permission + subscribe. Returns true only if the sub was persisted. */
export async function enablePush(): Promise<boolean> {
  if (!pushSupported()) return false
  const existing = await getPushSubscription()
  const sub = existing ?? (await subscribeInternal())
  if (!sub) return false
  return saveSubscription(sub)
}

/** Unsubscribe everywhere. Returns true on success. */
export async function disablePush(): Promise<boolean> {
  const sub = await getPushSubscription()
  if (sub) await deleteSubscription(sub)
  return true
}

/** Current subscription state as a boolean (for the UI toggle). */
export async function isPushActive(): Promise<boolean> {
  const sub = await getPushSubscription()
  return Boolean(sub)
}

/** Helper: convert a base64url VAPID public key into a Uint8Array for subscribe(). */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}