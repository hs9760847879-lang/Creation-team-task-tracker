import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

const COLORS = {
  completed: '#22c55e',
  'in-progress': '#f59e0b',
  pending: '#6366f1',
  not_started: '#94a3b8',
  need_help: '#ef4444',
  waiting_on_kam: '#f97316',
  pending_approval: '#a855f7',
}

const LABELS = {
  completed: 'Completed',
  'in-progress': 'In Progress',
  pending: 'Pending',
  not_started: 'Not Started',
  need_help: 'Need Help',
  waiting_on_kam: 'Waiting on KAM',
  pending_approval: 'Pending Approval',
}

export default function StatusPieChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary text-sm">
        No data available
      </div>
    )
  }

  const chartData = data.map((d) => ({
    name: LABELS[d.status] || d.status,
    value: d.count,
    color: COLORS[d.status] || '#94a3b8',
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={3}
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        />
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          formatter={(value) => (
            <span className="text-sm text-text">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
