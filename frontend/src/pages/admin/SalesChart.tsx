import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatPeso } from '@/lib/pricing';
import type { DashboardSummary } from '@/types/admin';

const FOREST = '#1f4d40';
const MINT = '#bfe3d0';

type Point = DashboardSummary['chart'][number];

const shortPeso = (n: number) =>
  n >= 1_000_000 ? `₱${+(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `₱${Math.round(n / 1000)}k` : `₱${n}`;

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const { label, total, forecast, partial, orders } = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-md">
      <p className="text-muted">
        {label}
        {forecast && ' (forecast)'}
        {partial && ' (so far)'}
      </p>
      <p className="mt-0.5 font-semibold text-ink">{formatPeso(total)}</p>
      {forecast && <p className="mt-0.5 text-muted">From {orders ?? 0} pending {orders === 1 ? 'order' : 'orders'} not shipped yet</p>}
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
        <span className="size-3 rounded-sm bg-mint" /> Forecasted Sales (pending orders)
      </span>
    </div>
  );
}

// dark bars are real sales, the light bars after them are the forecast.
// with many bars (monthly ranges) the value labels are left out and the tooltip shows the amounts.
// data can be missing when an older backend answers (before it restarts), so it falls back to an empty chart
export default function SalesChart({ data = [] }: { data?: Point[] }) {
  const top = Math.max(1000, ...data.map((d) => d.total));
  const yMax = Math.ceil((top * 1.2) / 1000) * 1000;
  const showValues = data.length <= 12;

  return (
    <div className="h-64 w-full" role="img" aria-label={`Sales: ${data.map((d) => `${d.label}${d.forecast ? ' forecast' : ''} ${formatPeso(d.total)}`).join(', ')}`}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: showValues ? 24 : 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#ece6dc" />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#e6ddd0' }} tick={{ fontSize: 12, fill: '#5c6b65' }} />
          <YAxis domain={[0, yMax]} tickFormatter={shortPeso} tickLine={false} axisLine={false} width={52} tick={{ fontSize: 11, fill: '#5c6b65' }} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f7f0e6' }} />
          <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={44} animationDuration={500}>
            {data.map((d) => (
              <Cell key={d.label + d.forecast} fill={d.forecast ? MINT : FOREST} />
            ))}
            {showValues && (
              <LabelList
                dataKey="total"
                position="top"
                formatter={(v) => (Number(v) ? formatPeso(Number(v)) : '')}
                style={{ fontSize: 11, fill: '#1d2b26' }}
              />
            )}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const UNIT: Record<string, [string, string]> = { day: ['day', 'days'], week: ['week', 'weeks'], month: ['month', 'months'] };

// one line under the chart: the forecast (all Pending orders) next to the last finished stretch of actual sales
export function ForecastSummary({ data = [], unit }: { data?: Point[]; unit: 'day' | 'week' | 'month' }) {
  const ahead = data.find((d) => d.forecast);
  // the running month isn't finished, so it's left out of the comparison
  const last = data.filter((d) => !d.forecast && !d.partial).at(-1);
  if (!ahead) return null;

  const change = last?.total ? ((ahead.total - last.total) / last.total) * 100 : null;
  const [one] = UNIT[unit];
  const orders = ahead.orders ?? 0;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-cream px-3 py-2 text-sm">
      <span className="text-muted">
        Forecast for the next {one}: <span className="font-semibold text-forest">{formatPeso(ahead.total)}</span>
      </span>
      {change !== null && (
        <span className={change >= 0 ? 'font-medium text-forest' : 'font-medium text-coral-dark'}>
          {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(0)}% vs the last {one}
        </span>
      )}
      <span className="text-xs text-muted">
        The total of {orders} pending {orders === 1 ? 'order' : 'orders'} not shipped yet. Actual sales count shipped and delivered orders.
      </span>
    </div>
  );
}
