import {
  BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

interface BarChartProps {
  data: Record<string, string | number>[]
  bars: { key: string; label: string; color: string }[]
  xKey: string
  height?: number
}

export function BarChart({ data, bars, xKey, height = 220 }: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReBarChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#373855" />
        <XAxis dataKey={xKey} tick={{ fill: '#8B8CA7', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#8B8CA7', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1E1D2E', border: '1px solid #373855', borderRadius: 8 }}
          labelStyle={{ color: '#fff' }}
          itemStyle={{ color: '#8B8CA7' }}
        />
        {bars.length > 1 && <Legend />}
        {bars.map(({ key, label, color }) => (
          <Bar key={key} dataKey={key} name={label} fill={color} radius={[4, 4, 0, 0]} />
        ))}
      </ReBarChart>
    </ResponsiveContainer>
  )
}
