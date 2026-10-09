const store: Record<string, { data: any; ts: number }> = {}
const TTL = 60_000 // 1 minuto

export function getCache(key: string) {
  const entry = store[key]
  if (!entry) return null
  if (Date.now() - entry.ts > TTL) return null
  return entry.data
}

export function setCache(key: string, data: any) {
  store[key] = { data, ts: Date.now() }
}

export function clearCache(key?: string) {
  if (key) delete store[key]
  else Object.keys(store).forEach(k => delete store[k])
}