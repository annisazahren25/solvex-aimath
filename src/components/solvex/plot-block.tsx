import { useEffect, useMemo, useRef, useState } from "react";
import { TrendingUp } from "lucide-react";

/* ---------------------------------------------------------------- */
/* Expression compiler                                               */
/* ---------------------------------------------------------------- */

const MATH_FNS = [
  "sin", "cos", "tan", "asin", "acos", "atan",
  "sinh", "cosh", "tanh", "sqrt", "exp", "abs",
  "floor", "ceil", "round", "min", "max",
];

function compileExpr(src: string): (x: number) => number {
  let s = src.trim();
  s = s.replace(/\^/g, "**");
  s = s.replace(/(\d|\))\s*([a-zA-Z(])/g, "$1*$2");
  s = s.replace(/([a-zA-Z_]\w*)\s*\(/g, (_, name) => {
    if (MATH_FNS.includes(name) || name === "ln" || name === "log") return `${name}(`;
    return `${name}*(`;
  });
  s = s.replace(/\bln\s*\(/g, "Math.log(");
  s = s.replace(/\blog\s*\(/g, "Math.log10(");
  for (const fn of MATH_FNS) {
    s = s.replace(new RegExp(`\\b${fn}\\s*\\(`, "g"), `Math.${fn}(`);
  }
  s = s.replace(/\bpi\b/gi, "Math.PI");
  s = s.replace(/(?<![a-zA-Z_])e(?![a-zA-Z_0-9])/g, "Math.E");
  // eslint-disable-next-line no-new-func
  return new Function(
    "x",
    `try { const v = (${s}); return typeof v === "number" ? v : NaN; } catch (e) { return NaN; }`
  ) as (x: number) => number;
}

/* ---------------------------------------------------------------- */
/* Parser                                                            */
/* ---------------------------------------------------------------- */

type ParsedFn = { label: string; raw: string; fn: (x: number) => number };
type ManualPoint = { x: number; y: number; label?: string; color?: string };
type Parsed = {
  xmin: number;
  xmax: number;
  fns: ParsedFn[];
  points: ManualPoint[];
};

function parsePlot(src: string): Parsed {
  let xmin = -10;
  let xmax = 10;
  const fns: ParsedFn[] = [];
  const points: ManualPoint[] = [];

  for (const raw of src.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;

    const range = line.match(/^x\s*[:=]\s*(-?\d+(?:\.\d+)?)\s*(?:\.\.|,|to)\s*(-?\d+(?:\.\d+)?)/i);
    if (range) {
      xmin = parseFloat(range[1]);
      xmax = parseFloat(range[2]);
      continue;
    }

    // point: (x, y) "label"
    const pt = line.match(/^point\s*[:=]?\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)\s*(?:"([^"]*)")?/i);
    if (pt) {
      points.push({
        x: parseFloat(pt[1]),
        y: parseFloat(pt[2]),
        label: pt[3],
      });
      continue;
    }

    const m = line.match(/^(?:y\s*=|f\(x\)\s*=|[a-zA-Z_]\w*\s*\(\s*x\s*\)\s*=|[a-zA-Z_]\w*\s*=)?\s*(.+)$/);
    const expr = m ? m[1] : line;
    try {
      const fn = compileExpr(expr);
      const test = fn(0);
      if (typeof test !== "number") continue;
      fns.push({ label: `y = ${expr}`, raw: expr, fn });
    } catch {
      // ignore
    }
  }
  if (xmax <= xmin) {
    xmin = -10;
    xmax = 10;
  }
  return { xmin, xmax, fns, points };
}

/* ---------------------------------------------------------------- */
/* Helpers                                                           */
/* ---------------------------------------------------------------- */

function unitTicks(min: number, max: number, forceUnit = false): number[] {
  const span = max - min;
  let step = 1;
  if (!forceUnit) {
    if (span > 60) step = Math.ceil(span / 40);
    else if (span > 30) step = 2;
  }
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + 1e-9; v += step) {
    out.push(Number(v.toFixed(6)));
  }
  return out;
}

function findRoots(f: (x: number) => number, xmin: number, xmax: number): number[] {
  const N = 400;
  const dx = (xmax - xmin) / N;
  const roots: number[] = [];
  let prev = f(xmin);
  for (let i = 1; i <= N; i++) {
    const x = xmin + i * dx;
    const cur = f(x);
    if (
      Number.isFinite(prev) &&
      Number.isFinite(cur) &&
      prev * cur < 0
    ) {
      // bisection refine
      let lo = x - dx;
      let hi = x;
      let flo = prev;
      for (let k = 0; k < 50; k++) {
        const mid = (lo + hi) / 2;
        const fm = f(mid);
        if (!Number.isFinite(fm)) break;
        if (flo * fm < 0) {
          hi = mid;
        } else {
          lo = mid;
          flo = fm;
        }
        if (Math.abs(hi - lo) < 1e-7) break;
      }
      const root = (lo + hi) / 2;
      if (!roots.some((r) => Math.abs(r - root) < 1e-4)) roots.push(root);
    }
    prev = cur;
  }
  return roots;
}

function findIntersections(
  f: (x: number) => number,
  g: (x: number) => number,
  xmin: number,
  xmax: number
): Array<{ x: number; y: number }> {
  const diff = (x: number) => f(x) - g(x);
  const roots = findRoots(diff, xmin, xmax);
  return roots.map((x) => ({ x, y: f(x) }));
}

/** Find local extrema (min/max) by scanning sign changes of numerical derivative. */
function findExtrema(
  f: (x: number) => number,
  xmin: number,
  xmax: number
): Array<{ x: number; y: number; kind: "min" | "max" }> {
  const h = (xmax - xmin) / 4000;
  const df = (x: number) => (f(x + h) - f(x - h)) / (2 * h);
  const roots = findRoots(df, xmin + h, xmax - h);
  const out: Array<{ x: number; y: number; kind: "min" | "max" }> = [];
  for (const r of roots) {
    const y = f(r);
    if (!Number.isFinite(y)) continue;
    // second derivative test
    const d2 = (f(r + h) - 2 * f(r) + f(r - h)) / (h * h);
    if (!Number.isFinite(d2) || Math.abs(d2) < 1e-6) continue;
    out.push({ x: r, y, kind: d2 > 0 ? "min" : "max" });
  }
  return out;
}

function fmt(n: number): string {
  if (Math.abs(n) < 1e-6) return "0";
  if (Math.abs(n - Math.round(n)) < 1e-3) return String(Math.round(n));
  return n.toFixed(2).replace(/\.?0+$/, "");
}

/* ---------------------------------------------------------------- */
/* Colors                                                            */
/* ---------------------------------------------------------------- */

const COLORS = [
  { stroke: "#2563eb", glow: "#3b82f6", soft: "#dbeafe" }, // blue
  { stroke: "#dc2626", glow: "#ef4444", soft: "#fee2e2" }, // red
  { stroke: "#059669", glow: "#10b981", soft: "#d1fae5" }, // emerald
  { stroke: "#d97706", glow: "#f59e0b", soft: "#fef3c7" }, // amber
  { stroke: "#7c3aed", glow: "#8b5cf6", soft: "#ede9fe" }, // violet
];

/* ---------------------------------------------------------------- */
/* Component                                                         */
/* ---------------------------------------------------------------- */

export function PlotBlock({ source }: { source: string }) {
  const { xmin: srcXmin, xmax: srcXmax, fns, points: manualPoints } = useMemo(
    () => parsePlot(source),
    [source]
  );

  /* Compute initial y-range from samples (only when source changes) */
  const initialView = useMemo(() => {
    const N = 400;
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i <= N; i++) {
      const x = srcXmin + ((srcXmax - srcXmin) * i) / N;
      for (const f of fns) {
        const y = f.fn(x);
        if (Number.isFinite(y) && Math.abs(y) < 1e6) {
          if (y < lo) lo = y;
          if (y > hi) hi = y;
        }
      }
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) { lo = -10; hi = 10; }
    if (lo === hi) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.15;
    return {
      xmin: srcXmin,
      xmax: srcXmax,
      ymin: Math.floor(lo - pad),
      ymax: Math.ceil(hi + pad),
    };
  }, [srcXmin, srcXmax, fns]);

  /* Interactive view (pannable) */
  const [view, setView] = useState(initialView);
  useEffect(() => { setView(initialView); }, [initialView]);
  const { xmin, xmax, ymin, ymax } = view;

  /* Sample paths over current view */
  const paths = useMemo(() => {
    const N = 600;
    const samples: Array<Array<{ x: number; y: number | null }>> = fns.map(() => []);
    for (let i = 0; i <= N; i++) {
      const x = xmin + ((xmax - xmin) * i) / N;
      fns.forEach((f, fi) => {
        const y = f.fn(x);
        if (Number.isFinite(y) && Math.abs(y) < 1e6) samples[fi].push({ x, y });
        else samples[fi].push({ x, y: null });
      });
    }
    return samples;
  }, [xmin, xmax, fns]);

  /* Notable points: roots, y-intercepts, intersections, manual */
  const autoPoints = useMemo(() => {
    const list: Array<{
      x: number;
      y: number;
      label: string;
      color: string;
      kind: "akar" | "potong-y" | "puncak" | "lembah" | "perpotongan" | "manual";
      fnLabel?: string;
    }> = [];
    fns.forEach((f, i) => {
      const c = COLORS[i % COLORS.length].stroke;
      // x-intercepts
      for (const r of findRoots(f.fn, xmin, xmax)) {
        list.push({
          x: r,
          y: 0,
          label: `(${fmt(r)}, 0)`,
          color: c,
          kind: "akar",
          fnLabel: f.label,
        });
      }
      // y-intercept
      if (xmin <= 0 && xmax >= 0) {
        const y0 = f.fn(0);
        if (Number.isFinite(y0)) {
          list.push({
            x: 0,
            y: y0,
            label: `(0, ${fmt(y0)})`,
            color: c,
            kind: "potong-y",
            fnLabel: f.label,
          });
        }
      }
      // local extrema (vertex / peaks / troughs)
      for (const e of findExtrema(f.fn, xmin, xmax)) {
        list.push({
          x: e.x,
          y: e.y,
          label: `(${fmt(e.x)}, ${fmt(e.y)})`,
          color: c,
          kind: e.kind === "max" ? "puncak" : "lembah",
          fnLabel: f.label,
        });
      }
    });
    // intersections between curves
    for (let i = 0; i < fns.length; i++) {
      for (let j = i + 1; j < fns.length; j++) {
        for (const p of findIntersections(fns[i].fn, fns[j].fn, xmin, xmax)) {
          list.push({
            x: p.x,
            y: p.y,
            label: `(${fmt(p.x)}, ${fmt(p.y)})`,
            color: "#111827",
            kind: "perpotongan",
            fnLabel: `${fns[i].label}  ∩  ${fns[j].label}`,
          });
        }
      }
    }
    return list;
  }, [fns, xmin, xmax]);

  const points = useMemo(() => {
    const fromManual = manualPoints.map((p) => ({
      x: p.x,
      y: p.y,
      label: p.label ?? `(${fmt(p.x)}, ${fmt(p.y)})`,
      color: p.color ?? "#111827",
      kind: "manual" as const,
      fnLabel: undefined as string | undefined,
    }));
    const all = [...autoPoints, ...fromManual];
    // de-dupe close points
    const out: typeof all = [];
    for (const p of all) {
      if (!out.some((q) => Math.abs(q.x - p.x) < 1e-3 && Math.abs(q.y - p.y) < 1e-3 && q.label === p.label)) {
        out.push(p);
      }
    }
    return out;
  }, [autoPoints, manualPoints]);

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    view: { xmin: number; xmax: number; ymin: number; ymax: number };
  }>({ active: false, startX: 0, startY: 0, view: initialView });


  const KIND_LABEL: Record<string, string> = {
    "akar": "Akar / titik potong sumbu x",
    "potong-y": "Titik potong sumbu y",
    "puncak": "Titik puncak (maksimum)",
    "lembah": "Titik lembah (minimum)",
    "perpotongan": "Perpotongan dua kurva",
    "manual": "Titik penting",
  };

  if (fns.length === 0) {
    return (
      <div className="not-prose my-3 rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        Tidak bisa membaca fungsi grafik.
      </div>
    );
  }

  /* ---------- SVG viewport (compact, square cells) ---------- */
  const M = { top: 18, right: 22, bottom: 20, left: 28 };
  const MAX_INNER_W = 340;
  const MAX_INNER_H = 240;
  // Choose a unit (px per 1 unit) so both axes fit within max bounds.
  const xSpan = xmax - xmin;
  const ySpan = ymax - ymin;
  const unit = Math.min(MAX_INNER_W / xSpan, MAX_INNER_H / ySpan);
  const innerW = unit * xSpan;
  const innerH = unit * ySpan;
  const W = innerW + M.left + M.right;
  const H = innerH + M.top + M.bottom;

  const sx = (x: number) => M.left + ((x - xmin) / (xmax - xmin)) * innerW;
  const sy = (y: number) => M.top + ((ymax - y) / (ymax - ymin)) * innerH;

  const xTicks = unitTicks(xmin, xmax);
  const yTicks = unitTicks(ymin, ymax, true);

  // Axis y position for x-axis label (clamp axis to inside if 0 outside range)
  const axisY = sy(Math.min(Math.max(0, ymin), ymax));
  const axisX = sx(Math.min(Math.max(0, xmin), xmax));

  /* Build path strings, splitting on null gaps */
  const buildPath = (samples: Array<{ x: number; y: number | null }>) => {
    let d = "";
    let pen = false;
    for (const p of samples) {
      if (p.y === null) {
        pen = false;
        continue;
      }
      const px = sx(p.x);
      const py = sy(p.y);
      // clip to inner area vertically
      if (py < M.top - 4 || py > M.top + innerH + 4) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${px.toFixed(2)},${py.toFixed(2)}`;
      pen = true;
    }
    return d;
  };

  /* Function curve labels placed near a sample at ~85% along x */
  const curveLabels = fns.map((f, i) => {
    const samples = paths[i];
    const want = Math.floor(samples.length * 0.86);
    let idx = want;
    while (idx < samples.length && samples[idx].y === null) idx++;
    if (idx >= samples.length) {
      idx = samples.findIndex((p) => p.y !== null);
    }
    const s = samples[idx];
    if (!s || s.y === null) return null;
    return {
      x: sx(s.x),
      y: sy(s.y) - 8,
      label: f.label,
      color: COLORS[i % COLORS.length].stroke,
    };
  });

  return (
    <div className="not-prose my-4 inline-block max-w-full overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-accent/30 shadow-soft ring-1 ring-black/[0.02]" style={{ width: Math.min(W + 24, 420) }}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-gradient-to-r from-primary/8 via-primary/5 to-transparent px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-primary text-primary-foreground shadow-sm">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div className="text-sm font-semibold tracking-tight text-foreground">
            Grafik Fungsi
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setView(initialView)}
            className="rounded-full border border-border/60 bg-background/80 px-2 py-0.5 font-mono text-[10.5px] text-muted-foreground transition hover:bg-background hover:text-foreground"
          >
            reset
          </button>
          <div className="rounded-full border border-border/60 bg-background/80 px-2 py-0.5 font-mono text-[10.5px] text-muted-foreground">
            x∈[{fmt(xmin)},{fmt(xmax)}]
          </div>
        </div>
      </div>

      {/* Function chips */}
      <div className="flex flex-wrap gap-1.5 px-4 pt-3">
        {fns.map((f, i) => {
          const c = COLORS[i % COLORS.length];
          return (
            <div
              key={f.label}
              className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-2.5 py-1 font-mono text-[11.5px] text-foreground/90 shadow-sm"
            >
              <span className="h-2 w-2 rounded-full" style={{ background: c.stroke }} />
              {f.label}
            </div>
          );
        })}
      </div>

      {/* SVG plot */}
      <div className="relative w-full p-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full select-none"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Grafik fungsi"
        >
          <defs>
            <marker
              id="arrow-axis"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="#1f2937" />
            </marker>
            {fns.map((_, i) => (
              <linearGradient
                key={i}
                id={`plot-stroke-${i}`}
                x1="0"
                x2="1"
                y1="0"
                y2="0"
              >
                <stop offset="0%" stopColor={COLORS[i % COLORS.length].stroke} />
                <stop offset="100%" stopColor={COLORS[i % COLORS.length].glow} />
              </linearGradient>
            ))}
          </defs>

          {/* Background */}
          <rect
            x={M.left}
            y={M.top}
            width={innerW}
            height={innerH}
            fill="#ffffff"
            stroke="#e5e7eb"
            rx={10}
          />

          {/* Mouse capture for crosshair + drag-to-pan */}
          <rect
            x={M.left}
            y={M.top}
            width={innerW}
            height={innerH}
            fill="transparent"
            style={{ cursor: dragRef.current.active ? "grabbing" : "crosshair" }}
            onMouseDown={(e) => {
              dragRef.current = {
                active: true,
                startX: e.clientX,
                startY: e.clientY,
                view: { xmin, xmax, ymin, ymax },
              };
              setHoverX(null);
            }}
            onMouseMove={(e) => {
              const svg = (e.currentTarget.ownerSVGElement ?? e.currentTarget) as SVGSVGElement;
              const rect = svg.getBoundingClientRect();
              if (dragRef.current.active) {
                const pxPerUnitX = (rect.width / W) * (innerW / (dragRef.current.view.xmax - dragRef.current.view.xmin));
                const pxPerUnitY = (rect.height / H) * (innerH / (dragRef.current.view.ymax - dragRef.current.view.ymin));
                const dx = (e.clientX - dragRef.current.startX) / pxPerUnitX;
                const dy = (e.clientY - dragRef.current.startY) / pxPerUnitY;
                const v = dragRef.current.view;
                setView({
                  xmin: v.xmin - dx, xmax: v.xmax - dx,
                  ymin: v.ymin + dy, ymax: v.ymax + dy,
                });
                return;
              }
              const vbX = ((e.clientX - rect.left) / rect.width) * W;
              const dx = xmin + ((vbX - M.left) / innerW) * (xmax - xmin);
              if (dx >= xmin && dx <= xmax) setHoverX(dx);
            }}
            onMouseUp={() => { dragRef.current.active = false; }}
            onMouseLeave={() => { dragRef.current.active = false; setHoverX(null); }}
          />


          {/* Dotted square grid (unit) */}
          <g stroke="#cbd5e1" strokeWidth={0.7} strokeDasharray="1,3" strokeLinecap="round">
            {xTicks.map((t) => (
              <line
                key={`gx-${t}`}
                x1={sx(t)}
                x2={sx(t)}
                y1={M.top}
                y2={M.top + innerH}
              />
            ))}
            {yTicks.map((t) => (
              <line
                key={`gy-${t}`}
                x1={M.left}
                x2={M.left + innerW}
                y1={sy(t)}
                y2={sy(t)}
              />
            ))}
          </g>

          {/* Axes with arrowheads */}
          <g stroke="#1f2937" strokeWidth={1.4} fill="none">
            {/* x-axis */}
            <line
              x1={M.left}
              x2={M.left + innerW}
              y1={axisY}
              y2={axisY}
              markerEnd="url(#arrow-axis)"
            />
            {/* y-axis */}
            <line
              x1={axisX}
              x2={axisX}
              y1={M.top + innerH}
              y2={M.top}
              markerEnd="url(#arrow-axis)"
            />
          </g>

          {/* Axis labels x, y */}
          <text
            x={M.left + innerW + 4}
            y={axisY + 4}
            fontSize={13}
            fontStyle="italic"
            fill="#1f2937"
          >
            x
          </text>
          <text
            x={axisX + 6}
            y={M.top - 6}
            fontSize={13}
            fontStyle="italic"
            fill="#1f2937"
          >
            y
          </text>

          {/* Tick marks + numbers on x-axis */}
          <g fontSize={10} fill="#475569" fontFamily="ui-sans-serif, system-ui">
            {xTicks.map((t) => {
              if (Math.abs(t) < 1e-9) return null;
              const x = sx(t);
              return (
                <g key={`tx-${t}`}>
                  <line
                    x1={x}
                    x2={x}
                    y1={axisY - 3}
                    y2={axisY + 3}
                    stroke="#1f2937"
                    strokeWidth={1.2}
                  />
                  <text x={x} y={axisY + 14} textAnchor="middle">
                    {fmt(t)}
                  </text>
                </g>
              );
            })}
            {/* origin label */}
            {xmin <= 0 && xmax >= 0 && ymin <= 0 && ymax >= 0 && (
              <text x={axisX - 6} y={axisY + 14} textAnchor="end">
                0
              </text>
            )}
          </g>

          {/* Tick marks + numbers on y-axis */}
          <g fontSize={10} fill="#475569" fontFamily="ui-sans-serif, system-ui">
            {yTicks.map((t) => {
              if (Math.abs(t) < 1e-9) return null;
              const y = sy(t);
              return (
                <g key={`ty-${t}`}>
                  <line
                    x1={axisX - 3}
                    x2={axisX + 3}
                    y1={y}
                    y2={y}
                    stroke="#1f2937"
                    strokeWidth={1.2}
                  />
                  <text x={axisX - 6} y={y + 3} textAnchor="end">
                    {fmt(t)}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Clip curves to plot area */}
          <clipPath id="plot-clip">
            <rect
              x={M.left}
              y={M.top}
              width={innerW}
              height={innerH}
              rx={10}
            />
          </clipPath>

          {/* Function curves */}
          <g clipPath="url(#plot-clip)" fill="none" strokeLinecap="round" strokeLinejoin="round">
            {fns.map((_, i) => (
              <path
                key={`curve-${i}`}
                d={buildPath(paths[i])}
                stroke={COLORS[i % COLORS.length].stroke}
                strokeWidth={2.2}
              />
            ))}
          </g>

          {/* Curve labels */}
          <g fontSize={12} fontFamily="ui-sans-serif, system-ui" fontWeight={600}>
            {curveLabels.map((lbl, i) =>
              lbl ? (
                <g key={`lbl-${i}`}>
                  <text
                    x={lbl.x}
                    y={lbl.y}
                    fill="#ffffff"
                    stroke="#ffffff"
                    strokeWidth={4}
                    paintOrder="stroke"
                    textAnchor="middle"
                  >
                    {lbl.label}
                  </text>
                  <text
                    x={lbl.x}
                    y={lbl.y}
                    fill={lbl.color}
                    textAnchor="middle"
                  >
                    {lbl.label}
                  </text>
                </g>
              ) : null
            )}
          </g>

          {/* Crosshair: vertical line + dot on each curve at hovered x */}
          {hoverX !== null && (
            <g pointerEvents="none">
              <line
                x1={sx(hoverX)}
                x2={sx(hoverX)}
                y1={M.top}
                y2={M.top + innerH}
                stroke="#64748b"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              {fns.map((f, i) => {
                const y = f.fn(hoverX);
                if (!Number.isFinite(y)) return null;
                const cy = sy(y);
                if (cy < M.top - 2 || cy > M.top + innerH + 2) return null;
                const c = COLORS[i % COLORS.length];
                return (
                  <g key={`xh-${i}`}>
                    <circle
                      cx={sx(hoverX)}
                      cy={cy}
                      r={8}
                      fill={c.stroke}
                      opacity={0.16}
                    />
                    <circle
                      cx={sx(hoverX)}
                      cy={cy}
                      r={4}
                      fill={c.stroke}
                      stroke="#ffffff"
                      strokeWidth={1.6}
                    />
                  </g>
                );
              })}
            </g>
          )}

          {/* Notable points + labels */}
          <g fontSize={10.5} fontFamily="ui-sans-serif, system-ui">
            {points.map((p, i) => {
              const px = sx(p.x);
              const py = sy(p.y);
              if (
                px < M.left - 2 ||
                px > M.left + innerW + 2 ||
                py < M.top - 2 ||
                py > M.top + innerH + 2
              )
                return null;
              // place label offset away from axes
              const offX = p.x >= 0 ? 6 : -6;
              const offY = p.y >= 0 ? -8 : 14;
              const anchor = p.x >= 0 ? "start" : "end";
              const isHover = hoverIdx === i;
              return (
                <g key={`pt-${i}`}>
                  {isHover && (
                    <circle
                      cx={px}
                      cy={py}
                      r={9}
                      fill={p.color}
                      opacity={0.18}
                    />
                  )}
                  <circle
                    cx={px}
                    cy={py}
                    r={isHover ? 5 : 3.6}
                    fill={p.color}
                    stroke="#ffffff"
                    strokeWidth={1.6}
                  />
                  {/* invisible larger hit area */}
                  <circle
                    cx={px}
                    cy={py}
                    r={12}
                    fill="transparent"
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => setHoverIdx(i)}
                    onMouseLeave={() =>
                      setHoverIdx((cur) => (cur === i ? null : cur))
                    }
                  />
                  <text
                    x={px + offX}
                    y={py + offY}
                    fill="#ffffff"
                    stroke="#ffffff"
                    strokeWidth={3.5}
                    paintOrder="stroke"
                    textAnchor={anchor}
                    fontWeight={600}
                    pointerEvents="none"
                  >
                    {p.label}
                  </text>
                  <text
                    x={px + offX}
                    y={py + offY}
                    fill={p.color}
                    textAnchor={anchor}
                    fontWeight={600}
                    pointerEvents="none"
                  >
                    {p.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Crosshair coordinate tooltip: lists y for every function */}
        {hoverX !== null && hoverIdx === null && (() => {
          const px = sx(hoverX);
          const leftPct = (px / W) * 100;
          const flipX = leftPct > 65;
          return (
            <div
              className="pointer-events-none absolute z-10 min-w-[11rem] rounded-xl border border-border/70 bg-white/95 px-3 py-2 text-[11.5px] shadow-lg backdrop-blur"
              style={{
                left: `calc(${leftPct}% + ${flipX ? "-12px" : "12px"})`,
                top: `12px`,
                transform: flipX ? "translateX(-100%)" : "none",
              }}
            >
              <div className="font-mono font-semibold text-foreground">
                x = {fmt(hoverX)}
              </div>
              <div className="mt-1 space-y-0.5">
                {fns.map((f, i) => {
                  const y = f.fn(hoverX);
                  const c = COLORS[i % COLORS.length].stroke;
                  return (
                    <div key={i} className="flex items-center gap-1.5 font-mono">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: c }}
                      />
                      <span className="text-muted-foreground">{f.label}:</span>
                      <span style={{ color: c }} className="font-semibold">
                        ({fmt(hoverX)}, {Number.isFinite(y) ? fmt(y) : "—"})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Hover tooltip overlay (HTML, positioned via percentages) */}
        {hoverIdx !== null && points[hoverIdx] && (() => {
          const p = points[hoverIdx];
          const px = sx(p.x);
          const py = sy(p.y);
          const leftPct = (px / W) * 100;
          const topPct = (py / H) * 100;
          const flipX = leftPct > 65;
          const flipY = topPct < 22;
          return (
            <div
              className="pointer-events-none absolute z-10 min-w-[10rem] rounded-xl border border-border/70 bg-white/95 px-3 py-2 text-[11.5px] shadow-lg backdrop-blur"
              style={{
                left: `calc(${leftPct}% + ${flipX ? "-12px" : "12px"})`,
                top: `calc(${topPct}% + ${flipY ? "12px" : "-12px"})`,
                transform: `translate(${flipX ? "-100%" : "0"}, ${flipY ? "0" : "-100%"})`,
              }}
            >
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: p.color }}
                />
                {KIND_LABEL[p.kind] ?? "Titik penting"}
              </div>
              <div className="mt-1 font-mono text-foreground/90">
                koordinat: <span style={{ color: p.color }}>{p.label}</span>
              </div>
              {p.fnLabel && (
                <div className="mt-0.5 font-mono text-[10.5px] text-muted-foreground">
                  {p.fnLabel}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}