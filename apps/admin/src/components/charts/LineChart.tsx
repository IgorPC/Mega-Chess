import {
  LineChart as ReLineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

interface LineChartProps {
  data: Record<string, string | number>[]
  lines: { key: string; label: string; color: string }[]
  xKey: string
  height?: number
}

export function LineChart({ data, lines, xKey, height = 220 }: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReLineChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#373855" />
        <XAxis dataKey={xKey} tick={{ fill: '#8B8CA7', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#8B8CA7', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1E1D2E', border: '1px solid #373855', borderRadius: 8 }}
          labelStyle={{ color: '#fff' }}
          itemStyle={{ color: '#8B8CA7' }}
        />
        {lines.length > 1 && <Legend />}
        {lines.map(({ key, label, color }) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            name={label}
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </ReLineChart>
    </ResponsiveContainer>
  )
}
