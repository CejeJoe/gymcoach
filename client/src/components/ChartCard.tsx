import React from 'react';
import { GlassCard } from './ui/glass-card';

interface ChartCardProps {
  title: string;
  data: { date: string; value: number }[];
  unit: string;
  color: string;
}

export function ChartCard({ title, data, unit, color }: ChartCardProps) {
  return (
    <GlassCard className="p-4">
      <h3 className="font-semibold mb-2">{title}</h3>
      {data.length === 0 ? (
        <div className="h-32 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
          <div className="text-center">
            <p className="text-muted-foreground mb-2">No entries yet</p>
            <p className="text-xs text-muted-foreground">Ask your coach to track your progress</p>
          </div>
        </div>
      ) : (
        <div className="h-40">
          {(() => {
            const w = 600; // viewbox width
            const h = 160; // viewbox height
            const padding = 12;
            const vals = data.map((d) => d.value);
            const min = Math.min(...vals);
            const max = Math.max(...vals);
            const range = max - min || 1;
            const n = data.length;
            const stepX = n > 1 ? (w - padding * 2) / (n - 1) : 0;
            const points = data.map((d, i) => {
              const x = padding + i * stepX;
              const y = padding + (h - padding * 2) * (1 - (d.value - min) / range);
              return [x, y] as const;
            });
            const path = points
              .map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`))
              .join(" ");
            return (
              <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full">
                <rect x="0" y="0" width={w} height={h} rx="10" ry="10" fill="none" />
                <path d={path} fill="none" stroke={color} strokeWidth={3} />
                {points.map(([x, y], idx) => (
                  <circle key={idx} cx={x} cy={y} r={3} fill={color} />
                ))}
              </svg>
            );
          })()}
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>{data[0]?.date}</span>
            <span>{data[data.length - 1]?.date}</span>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
