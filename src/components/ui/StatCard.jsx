export default function StatCard({ icon: Icon, label, value, color = 'indigo', sub }) {
  const colors = {
    indigo: 'from-indigo-500 to-indigo-600',
    green: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600',
    red: 'from-rose-500 to-rose-600',
    blue: 'from-blue-500 to-blue-600',
  }

  return (
    <div className="card p-5 flex items-start gap-4 card-hover">
      <div
        className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors[color] || colors.indigo} flex items-center justify-center shrink-0`}
      >
        {Icon && <Icon size={20} className="text-white" />}
      </div>
      <div className="min-w-0">
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value}</p>
        {sub && <p className="text-xs text-text-secondary mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}
