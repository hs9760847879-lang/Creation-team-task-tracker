import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getDateRange } from '../../lib/utils'
import { TrendingUp, Mail, Building2, Receipt } from 'lucide-react'
import StatCard from '../../components/ui/StatCard'
import DateFilter from '../../components/ui/DateFilter'

const METRICS = [
  {
    slug: 'commission-updated',
    label: 'Commission Updated',
    column: 'total_commission_updated',
    icon: TrendingUp,
    color: 'indigo',
  },
  {
    slug: 'commission-created',
    label: 'Commission Created',
    column: 'total_commission_created',
    icon: Receipt,
    color: 'green',
  },
  {
    slug: 'mails-assigned',
    label: 'Mails Assigned',
    column: 'number_of_mails_assigned',
    icon: Mail,
    color: 'blue',
  },
  {
    slug: 'properties-created',
    label: 'Properties Created',
    column: 'number_of_properties_created',
    icon: Building2,
    color: 'amber',
  },
]

export default function AdminStats() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState('week')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [totals, setTotals] = useState({})
  const [loading, setLoading] = useState(true)

  const fetchTotals = useCallback(async () => {
    setLoading(true)
    const { start, end } = getDateRange(period, customStart, customEnd)

    let query = supabase.from('daily_stats').select('*')
    if (start) query = query.gte('date', start)
    if (end) query = query.lte('date', end)

    const { data } = await query.order('date', { ascending: false })

    if (data) {
      const sums = {}
      METRICS.forEach((m) => {
        sums[m.slug] = data.reduce((s, r) => s + (r[m.column] || 0), 0)
      })
      setTotals(sums)
    }
    setLoading(false)
  }, [period, customStart, customEnd])

  useEffect(() => { fetchTotals() }, [fetchTotals])

  function handlePeriodChange(newPeriod, start, end) {
    setPeriod(newPeriod)
    if (start !== undefined) setCustomStart(start)
    if (end !== undefined) setCustomEnd(end)
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team Stats</h1>
          <p className="text-sm text-text-secondary mt-1">Daily team performance overview</p>
        </div>
        <DateFilter
          period={period}
          onChange={handlePeriodChange}
          customStart={customStart}
          customEnd={customEnd}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {METRICS.map((m) => (
            <button
              key={m.slug}
              onClick={() => navigate(`/admin/stats/${m.slug}?period=${period}${customStart ? `&start=${customStart}` : ''}${customEnd ? `&end=${customEnd}` : ''}`)}
              className="text-left cursor-pointer transition-transform hover:scale-[1.02]"
            >
              <StatCard
                icon={m.icon}
                label={m.label}
                value={(totals[m.slug] || 0).toLocaleString()}
                color={m.color}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
