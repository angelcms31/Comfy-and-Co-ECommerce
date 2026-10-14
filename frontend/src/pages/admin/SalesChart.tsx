import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DAILY_SALES_TARGET } from '@/lib/constants';
import { formatPeso } from '@/lib/pricing';

const FOREST = '#1f4d40';
const MINT = '#bfe3d0';

const weekday = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-PH', { weekday: 'short', timeZone: 'UTC' });
const shortPeso = (n: number) => (n >= 1000 ? `₱${Math.round(n / 1000)}k` : `₱${n}`);

interface Props {
  days: { day: string; total: number }[];
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: { day: string; total: number } }[] }) {
  if (!active || !payload?.length) return null;
  const { day, total } = payload[0].payload;
  const date = new Date(`${day}T00:00:00Z`).toLocaleDateString('en-PH', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-md">
      <p className="text-muted">{date}</p>
      <p className="mt-0.5 font-semibold text-ink">{formatPeso(total)}</p>
      <p className="text-muted">{total >= DAILY_SALES_TARGET ? 'Target reached' : `${formatPeso(DAILY_SALES_TARGET - total)} below target`}</p>
    </div>
  );
}

export default function SalesChart({ days }: Props) {
  const data = days.map((d, i) => ({ ...d, label: i === days.length - 1 ? 'Today' : weekday(d.day) }));
  const top = Math.max(DAILY_SALES_TARGET, ...days.map((d) => d.total));
  const yMax = Math.ceil((top * 1.15) / 10000) * 10000;

  return (
    <div className="h-64 w-full" role="img" aria-label={`Sales for the last 7 days: ${data.map((d) => `${d.label} ${formatPeso(d.total)}`).join(', ')}`}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 24, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#ece6dc" />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#e6ddd0' }} tick={{ fontSize: 12, fill: '#5c6b65' }} />
          <YAxis
            domain={[0, yMax]}
            tickFormatter={shortPeso}
            tickLine={false}
            axisLine={false}
            width={48}
            tick={{ fontSize: 11, fill: '#5c6b65' }}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f7f0e6' }} />
          <ReferenceLine y={DAILY_SALES_TARGET} stroke="#c4502f" strokeDasharray="5 4" strokeWidth={1.5} />
          <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={44} animationDuration={500}>
            {data.map((d, i) => (
              <Cell key={d.day} fill={i === data.length - 1 ? MINT : FOREST} />
            ))}
            <LabelList dataKey="total" position="top" formatter={(v) => formatPeso(Number(v))} style={{ fontSize: 11, fill: '#1d2b26' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
