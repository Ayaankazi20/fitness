import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

/** Circular progress ring with a big number in the middle. */
export function Ring({ value, max, size = 168, stroke = 14, color = '#16a34a', label, sub }: { value: number; max: number; size?: number; stroke?: number; color?: string; label: string; sub: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, pct = max > 0 ? Math.min(value / max, 1) : 0, over = max > 0 && value > max;
  return (
    <View style={{ width: size, height: size }} accessible accessibilityLabel={`${label} ${sub}`} className="items-center justify-center">
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke="#e2e8f0" strokeOpacity={0.6} strokeWidth={stroke} fill="none" />
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={over ? '#ef4444' : color} strokeWidth={stroke} strokeLinecap="round" fill="none" strokeDasharray={`${c * pct} ${c}`} />
        </G>
      </Svg>
      <View className="absolute items-center"><Text className="text-4xl font-extrabold text-slate-900 dark:text-white">{label}</Text><Text className="text-xs text-slate-500">{sub}</Text></View>
    </View>
  );
}

export function MacroBar({ name, value, target, color, unit = 'g' }: { name: string; value: number; target: number; color: string; unit?: string }) {
  const pct = target > 0 ? Math.min(value / target, 1) : 0;
  return (
    <View className="mb-3" accessible accessibilityLabel={`${name} ${Math.round(value)} of ${Math.round(target)} ${unit}`}>
      <View className="mb-1.5 flex-row justify-between"><Text className="text-sm font-semibold text-slate-700 dark:text-slate-200">{name}</Text><Text className="text-sm text-slate-500"><Text className="font-bold text-slate-900 dark:text-white">{Math.round(value)}</Text> / {Math.round(target)}{unit}</Text></View>
      <View className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><View style={{ width: `${pct * 100}%`, backgroundColor: color }} className="h-full rounded-full" /></View>
    </View>
  );
}

const W = 320, H = 150, P = { l: 34, r: 8, t: 10, b: 22 };
function scale(vals: number[], pad = 0.1) {
  let min = Math.min(...vals), max = Math.max(...vals); if (min === max) { min -= 1; max += 1; }
  const d = (max - min) * pad; return { min: min - d, max: max + d };
}
const short = (d: string) => d.slice(5).replace('-', '/');

export function LineChart({ points, color = '#16a34a', unit = 'kg' }: { points: { x: string; y: number }[]; color?: string; unit?: string }) {
  if (points.length < 2) return <Text className="py-6 text-center text-slate-500">Log at least two weights to see your trend.</Text>;
  const { min, max } = scale(points.map((p) => p.y));
  const X = (i: number) => P.l + (i / (points.length - 1)) * (W - P.l - P.r), Y = (v: number) => P.t + (1 - (v - min) / (max - min)) * (H - P.t - P.b);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
  return (
    <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={170} accessibilityLabel={`Line chart, latest ${points[points.length - 1]!.y} ${unit}`}>
      {[min, (min + max) / 2, max].map((v, i) => (<G key={i}><Line x1={P.l} x2={W - P.r} y1={Y(v)} y2={Y(v)} stroke="#94a3b8" strokeOpacity={0.25} /><SvgText x={P.l - 4} y={Y(v) + 3} fontSize={9} fill="#94a3b8" textAnchor="end">{v.toFixed(1)}</SvgText></G>))}
      <Path d={d} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => <Circle key={i} cx={X(i)} cy={Y(p.y)} r={3} fill={color} />)}
      <SvgText x={P.l} y={H - 6} fontSize={9} fill="#94a3b8">{short(points[0]!.x)}</SvgText>
      <SvgText x={W - P.r} y={H - 6} fontSize={9} fill="#94a3b8" textAnchor="end">{short(points[points.length - 1]!.x)}</SvgText>
    </Svg>
  );
}

export function BarChart({ data, target, color = '#16a34a', unit = '' }: { data: { x: string; y: number; hit?: boolean }[]; target?: number; color?: string; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.y), target ?? 0) * 1.1;
  const bw = (W - P.l - P.r) / data.length, Y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b);
  const step = Math.ceil(data.length / 7);
  return (
    <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={170} accessibilityLabel={`Bar chart${unit ? ' in ' + unit : ''}`}>
      {[0, max / 2, max].map((v, i) => (<G key={i}><Line x1={P.l} x2={W - P.r} y1={Y(v)} y2={Y(v)} stroke="#94a3b8" strokeOpacity={0.25} /><SvgText x={P.l - 4} y={Y(v) + 3} fontSize={9} fill="#94a3b8" textAnchor="end">{Math.round(v)}</SvgText></G>))}
      {data.map((d, i) => (<G key={d.x}><Rect x={P.l + i * bw + bw * 0.18} y={Y(d.y)} width={bw * 0.64} height={Math.max(0, H - P.b - Y(d.y))} rx={3} fill={d.hit ? color : '#94a3b8'} fillOpacity={d.y ? (d.hit ? 1 : 0.55) : 0.15} />
        {i % step === 0 ? <SvgText x={P.l + i * bw + bw / 2} y={H - 6} fontSize={9} fill="#94a3b8" textAnchor="middle">{short(d.x)}</SvgText> : null}</G>))}
      {target ? <Line x1={P.l} x2={W - P.r} y1={Y(target)} y2={Y(target)} stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1.5} /> : null}
    </Svg>
  );
}
