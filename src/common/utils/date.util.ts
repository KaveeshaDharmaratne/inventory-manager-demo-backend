import { format, parseISO } from 'date-fns'

const OFFSET_MS = 5.5 * 60 * 60 * 1000 // +5:30

export function toLocalDateString(input?: string): string {
  const dt = input ? parseISO(input) : new Date()
  const adj = new Date(dt.getTime() + OFFSET_MS)
  return format(adj, 'yyyy-MM-dd')
}

export function toLocalTimeString(input?: string): string | undefined {
  if (!input) return undefined
  try {
    const dt = parseISO(input)
    const adj = new Date(dt.getTime() + OFFSET_MS)
    return format(adj, 'HH:mm:ss')
  } catch {
    return undefined
  }
}
