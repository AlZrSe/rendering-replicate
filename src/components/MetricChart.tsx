import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtTime } from "@/lib/format";

export interface Series {
  key: string;
  label: string;
  color: string;
  unit?: string;
}

export function MetricChart({
  data,
  series,
  height = 220,
  domain,
}: {
  data: Array<Record<string, number | string>>;
  series: Series[];
  height?: number;
  domain?: [number, number];
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(v: string) => fmtTime(v)}
            stroke="var(--color-muted-foreground)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            minTickGap={32}
          />
          <YAxis
            domain={domain ?? ["auto", "auto"]}
            stroke="var(--color-muted-foreground)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-popover)",
              border: "1px solid var(--color-border)",
              borderRadius: "0.5rem",
              fontSize: 12,
              color: "var(--color-popover-foreground)",
            }}
            labelFormatter={(v) => fmtTime(String(v))}
            formatter={(value, name) => {
              const s = series.find((x) => x.label === name || x.key === name);
              return [`${value}${s?.unit ?? ""}`, s?.label ?? String(name)];
            }}
          />
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              fill={`url(#grad-${s.key})`}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
