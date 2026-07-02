import { clsx } from 'clsx'

export function cn(...inputs) {
  return clsx(inputs)
}

export function formatDuration(minutes) {
  if (!minutes && minutes !== 0) return '—'
  if (minutes < 1) return '< 1 min'
  if (minutes < 60) return `${Math.round(minutes)} min`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return `${h}h ${m}m`
}

export function getStatusBadgeColor(status) {
  switch (status) {
    case 'completed':
      return 'badge-success'
    case 'in-progress':
      return 'badge-warning'
    case 'pending':
      return 'badge-info'
    case 'pending_approval':
      return 'badge-warning'
    default:
      return 'badge-info'
  }
}

export function getDateRange(period, customStart, customEnd) {
  const now = new Date()
  const end = now.toISOString()

  let start
  switch (period) {
    case 'today': {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      start = today.toISOString()
      break
    }
    case 'week': {
      const weekAgo = new Date(now)
      weekAgo.setDate(weekAgo.getDate() - 7)
      start = weekAgo.toISOString()
      break
    }
    case 'month': {
      const monthAgo = new Date(now)
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      start = monthAgo.toISOString()
      break
    }
    case 'custom':
      start = customStart ? new Date(customStart).toISOString() : null
      return { start, end: customEnd ? new Date(customEnd).toISOString() : now.toISOString() }
    default:
      start = new Date(0).toISOString()
  }

  return { start, end }
}
