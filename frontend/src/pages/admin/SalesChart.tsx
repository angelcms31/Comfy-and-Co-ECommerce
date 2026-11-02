import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatPeso } from '@/lib/pricing';
import type { DashboardSummary } from '@/types/admin';

const FOREST = '#1f4d40';
const MINT = '#bfe3d0';

type Point = DashboardSummary['chart'][number];

const shortPeso = (n: number) => (n >= 1000 ? `₱${Math.round(n / 1000)}k` : `₱${n}`);

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const { label, total, forecast } = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-md">
      <p className="text-muted">
        {label}
        {forecast && ' (forecast)'}
      </p>
      <p className="mt-0.5 font-semibold text-ink">{formatPeso(total)}</p>
    </div>
  );
}

export function ChartLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-muted">
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-sm bg-forest" /> Actual Sales
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-sm bg-mint" /> Forecasted Sales
      </span>
    </div>
  );
}

// dark bars are real sales, the last light bar is the forecast.
// data can be missing when an older backend answers (before it restarts), so it falls back to an empty chart
export default function SalesChart({ data = [] }: { data?: Point[] }) {
  const top = Math.max(1000, ...data.map((d) => d.total));
  const yMax = Math.ceil((top * 1.2) / 1000) * 1000;

  return (
    <div className="h-64 w-full" role="img" aria-label={`Sales: ${data.map((d) => `${d.label}${d.forecast ? ' forecast' : ''} ${formatPeso(d.total)}`).join(', ')}`}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 24, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#ece6dc" />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#e6ddd0' }} tick={{ fontSize: 12, fill: '#5c6b65' }} />
          <YAxis domain={[0, yMax]} tickFormatter={shortPeso} tickLine={false} axisLine={false} width={48} tick={{ fontSize: 11, fill: '#5c6b65' }} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f7f0e6' }} />
          <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={44} animationDuration={500}>
            {data.map((d) => (
              <Cell key={d.label + d.forecast} fill={d.forecast ? MINT : FOREST} />
            ))}
            <LabelList
              dataKey="total"
              position="top"
              formatter={(v) => (Number(v) ? formatPeso(Number(v)) : '')}
              style={{ fontSize: 11, fill: '#1d2b26' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
