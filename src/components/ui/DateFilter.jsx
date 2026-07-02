import { Calendar } from 'lucide-react'

const periods = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'custom', label: 'Custom' },
]

export default function DateFilter({ period, onChange, customStart, customEnd }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {periods.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`btn text-sm ${
            period === p.value ? 'btn-primary' : 'btn-outline'
          }`}
        >
          {p.value === 'custom' && <Calendar size={14} />}
          {p.label}
        </button>
      ))}
      {period === 'custom' && (
        <div className="flex items-center gap-2 ml-1">
          <input
            type="date"
            value={customStart || ''}
            onChange={(e) => onChange('custom', e.target.value, customEnd)}
            className="input text-sm w-auto"
          />
          <span className="text-text-secondary text-sm">to</span>
          <input
            type="date"
            value={customEnd || ''}
            onChange={(e) => onChange('custom', customStart, e.target.value)}
            className="input text-sm w-auto"
          />
        </div>
      )}
    </div>
  )
}
