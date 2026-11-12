import React from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DaySummaryItem } from '../../types/wellness';
import {
  formatDayNumber,
  formatReadableDate,
  formatShortDayLabel,
} from '../../lib/dateUtils';

interface WeeklyTrendChartProps {
  sevenDayWindow: DaySummaryItem[];
  averageEnergyScore: number | null;
  energyCount: number;
  completedSessionsInLast7: number;
  effectiveReducedMotion: boolean;
}

interface TrendChartDatum extends DaySummaryItem {
  shortLabel: string;
  readableDate: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: TrendChartDatum }>;
}

function TrendTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const datum = payload[0]?.payload;
  if (!datum) return null;

  return (
    <div className="rounded-xl border border-[#E6E4DD] bg-white px-3.5 py-2.5 text-xs shadow-sm">
      <p className="font-medium text-[#1E2421]">{datum.readableDate}</p>
      <div className="mt-1.5 space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-[#4A5550]">
            <span
              className="h-2 w-2 rounded-full bg-[#2F5D50]"
              aria-hidden="true"
            />
            Daily energy
          </span>
          <span className="font-mono font-medium text-[#1E2421] tabular-nums">
            {datum.energyScore !== null ? `${datum.energyScore} / 100` : 'Not recorded'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-[#4A5550]">
            <span
              className="h-2 w-2 rounded-xs bg-[#8DB5A6]"
              aria-hidden="true"
            />
            Mindfulness sessions
          </span>
          <span className="font-mono font-medium text-[#1E2421] tabular-nums">
            {datum.completedSessionsCount}
          </span>
        </div>
      </div>
    </div>
  );
}

export function WeeklyTrendChart({
  sevenDayWindow,
  averageEnergyScore,
  energyCount,
  completedSessionsInLast7,
  effectiveReducedMotion,
}: WeeklyTrendChartProps) {
  const chartData: TrendChartDatum[] = sevenDayWindow.map((day) => ({
    ...day,
    shortLabel: `${formatShortDayLabel(day.date).slice(0, 2)} ${formatDayNumber(day.date)}`,
    readableDate: formatReadableDate(day.date),
  }));

  const maxSessionCount = chartData.reduce(
    (max, item) => Math.max(max, item.completedSessionsCount),
    0
  );
  const maxSessionsAxis = Math.max(2, maxSessionCount + 1);

  return (
    <div className="space-y-3" data-testid="weekly-trend-chart">
      {/* Compact Legend & Stats Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#4A5550]">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#2F5D50]" aria-hidden="true" />
            <span>
              Energy (0–100)
              {averageEnergyScore !== null && (
                <span className="ml-1 font-mono text-[#5C6762] tabular-nums">
                  · Avg {averageEnergyScore} (n={energyCount})
                </span>
              )}
            </span>
          </span>

          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-[#8DB5A6]" aria-hidden="true" />
            <span>
              Sessions{' '}
              <span className="font-mono text-[#5C6762] tabular-nums">
                ({completedSessionsInLast7} total)
              </span>
            </span>
          </span>
        </div>
      </div>

      {/* Recharts Dual-Axis Trend Visualization */}
      <div
        className="w-full h-56 min-w-0"
        role="img"
        aria-label="Seven-day trend chart of self-reported daily energy and completed mindfulness sessions"
      >
        <ResponsiveContainer width="100%" height={224} minWidth={0}>
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 4, left: -12, bottom: 0 }}
          >
            <CartesianGrid stroke="#ECEAE3" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="shortLabel"
              tick={{ fill: '#5C6762', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#E6E4DD' }}
              dy={4}
            />
            <YAxis
              yAxisId="energy"
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tick={{ fill: '#5C6762', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={38}
            />
            <YAxis
              yAxisId="sessions"
              orientation="right"
              allowDecimals={false}
              domain={[0, maxSessionsAxis]}
              tick={{ fill: '#5C6762', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={26}
            />
            <Tooltip
              cursor={{ fill: '#FAF9F6', opacity: 0.75 }}
              content={<TrendTooltip />}
            />
            <Bar
              yAxisId="sessions"
              dataKey="completedSessionsCount"
              name="Completed sessions"
              fill="#B9D2C8"
              stroke="#8DB5A6"
              strokeWidth={1}
              radius={[6, 6, 0, 0]}
              maxBarSize={24}
              isAnimationActive={!effectiveReducedMotion}
            />
            <Line
              yAxisId="energy"
              type="monotone"
              dataKey="energyScore"
              name="Daily energy"
              stroke="#2F5D50"
              strokeWidth={2.5}
              connectNulls={false}
              dot={{ r: 4, fill: '#2F5D50', stroke: '#FFFFFF', strokeWidth: 2 }}
              activeDot={{ r: 5.5, fill: '#2F5D50', stroke: '#FFFFFF', strokeWidth: 2 }}
              isAnimationActive={!effectiveReducedMotion}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
