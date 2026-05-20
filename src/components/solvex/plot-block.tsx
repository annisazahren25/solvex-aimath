import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minus, Plus, RotateCcw, TrendingUp, X } from "lucide-react";

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
    `try { const v = (${s}); return typeof v === "number" ? v : NaN; } catch (e) { return NaN; }`,
  ) as (x: number) => number;
}

/* ---------------------------------------------------------------- */
/* Parser                                                            */
/* ---------------------------------------------------------------- */

type ParsedFn = { label: string; raw: string; fn: (x: number) => number };
type ManualPoint = { x: number; y: number; label?: string };
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

    const pt = line.match(/^point\s*[:=]?\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)\s*(?:"([^"]*)")?/i);
    if (pt) {
      points.push({ x: parseFloat(pt[1]), y: parseFloat(pt[2]), label: pt[3] });
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
/* Math helpers                                                      */
/* ---------------------------------------------------------------- */

function niceStep(span: number, targetTicks = 10): number {
  const raw = span / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  let nice: number;
  if (norm < 1.5) nice = 1;
  else if (norm < 3) nice = 2;
  else if (norm < 7) nice = 5;
  else nice = 10;
  return nice * mag;
}

function gridTicks(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  const start = Math.ceil(min / step) * step;
  for (let v = start; v <= max + step * 0.001; v += step) {
    out.push(Number(v.toFixed(10)));
  }
  return out;
}

function findRoots(f: (x: number) => number, xmin: number, xmax: number): number[] {
  const N = 500;
  const dx = (xmax - xmin) / N;
  const roots: number[] = [];
  let prev = f(xmin);
  for (let i = 1; i <= N; i++) {
    const x = xmin + i * dx;
    const cur = f(x);
    if (Number.isFinite(prev) && Number.isFinite(cur) && prev * cur < 0) {
      let lo = x - dx;
      let hi = x;
      let flo = prev;
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2;
        const fm = f(mid);
        if (!Number.isFinite(fm)) break;
        if (flo * fm < 0) hi = mid;
        else {
          lo = mid;
          flo = fm;
        }
        if (Math.abs(hi - lo) < 1e-8) break;
      }
      const root = (lo + hi) / 2;
      if (!roots.some((r) => Math.abs(r - root) < 1e-4)) roots.push(root);
    }
    prev = cur;
  }
  return roots;
}

function findExtrema(f: (x: number) => number, xmin: number, xmax: number) {
  const h = (xmax - xmin) / 5000;
  const df = (x: number) => (f(x + h) - f(x - h)) / (2 * h);
  const roots = findRoots(df, xmin + h, xmax - h);
  const out: Array<{ x: number; y: number; kind: "min" | "max" }> = [];
  for (const r of roots) {
    const y = f(r);
    if (!Number.isFinite(y)) continue;
    const d2 = (f(r + h) - 2 * f(r) + f(r - h)) / (h * h);
    if (!Number.isFinite(d2) || Math.abs(d2) < 1e-6) continue;
    out.push({ x: r, y, kind: d2 > 0 ? "min" : "max" });
  }
  return out;
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) < 1e-6) return "0";
  if (Math.abs(n - Math.round(n)) < 1e-3) return String(Math.round(n));
  if (Math.abs(n) >= 1000) return n.toFixed(0);
  return n.toFixed(2).replace(/\.?0+$/, "");
}

/* ---------------------------------------------------------------- */
/* Colors                                                            */
/* ---------------------------------------------------------------- */

const COLORS = [
  "#3B82F6", // primary blue
  "#EF4444", // red
  "#10B981", // emerald
  "#F59E0B", // amber
  "#8B5CF6", // violet
];

/* ---------------------------------------------------------------- */
/* Inner Plot Surface (the real interactive canvas)                 */
/* ---------------------------------------------------------------- */

type View = { xmin: number; xmax: number; ymin: number; ymax: number };

function PlotSurface({
  fns,
  manualPoints,
  view,
  setView,
  initialView,
  height,
}: {
  fns: ParsedFn[];
  manualPoints: ManualPoint[];
  view: View;
  setView: (v: View | ((prev: View) => View)) => void;
  initialView: View;
  height: number;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 600, h: height });

  // Observe container width
  useEffect(() => {
    if (!wrapperRef.current) return;
    const el = wrapperRef.current;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setSize({ w: Math.max(280, rect.width), h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [height]);

  const W = size.w;
  const H = size.h;
  const M = { top: 16, right: 16, bottom: 28, left: 38 };
  const innerW = Math.max(50, W - M.left - M.right);
  const innerH = Math.max(50, H - M.top - M.bottom);

  const { xmin, xmax, ymin, ymax } = view;
  const xSpan = xmax - xmin;
  const ySpan = ymax - ymin;

  const sx = useCallback((x: number) => M.left + ((x - xmin) / xSpan) * innerW, [M.left, innerW, xmin, xSpan]);
  const sy = useCallback((y: number) => M.top + ((ymax - y) / ySpan) * innerH, [M.top, innerH, ymax, ySpan]);
  const invX = (px: number) => xmin + ((px - M.left) / innerW) * xSpan;
  const invY = (py: number) => ymax - ((py - M.top) / innerH) * ySpan;

  /* Tick steps */
  const xStep = niceStep(xSpan, Math.max(6, Math.floor(innerW / 80)));
  const yStep = niceStep(ySpan, Math.max(5, Math.floor(innerH / 60)));
  const xMinor = xStep / 5;
  const yMinor = yStep / 5;

  const xTicks = useMemo(() => gridTicks(xmin, xmax, xStep), [xmin, xmax, xStep]);
  const yTicks = useMemo(() => gridTicks(ymin, ymax, yStep), [ymin, ymax, yStep]);
  const xTicksMinor = useMemo(() => gridTicks(xmin, xmax, xMinor), [xmin, xmax, xMinor]);
  const yTicksMinor = useMemo(() => gridTicks(ymin, ymax, yMinor), [ymin, ymax, yMinor]);

  /* Sample curves over current view, generating SVG path strings */
  const curvePaths = useMemo(() => {
    const N = Math.min(1200, Math.max(400, Math.floor(innerW * 1.5)));
    return fns.map((f) => {
      let d = "";
      let pen = false;
      let prevY: number | null = null;
      for (let i = 0; i <= N; i++) {
        const x = xmin + (xSpan * i) / N;
        const y = f.fn(x);
        if (!Number.isFinite(y) || Math.abs(y) > 1e8) {
          pen = false;
          prevY = null;
          continue;
        }
        // break path on huge jumps (asymptotes)
        if (prevY !== null && Math.abs(y - prevY) > ySpan * 4) {
          pen = false;
        }
        const px = sx(x);
        const py = sy(y);
        // soft clip far outside vertical
        if (py < M.top - 200 || py > M.top + innerH + 200) {
          pen = false;
          prevY = y;
          continue;
        }
        d += `${pen ? "L" : "M"}${px.toFixed(2)},${py.toFixed(2)}`;
        pen = true;
        prevY = y;
      }
      return d;
    });
  }, [fns, xmin, xSpan, ySpan, sx, sy, innerW, M.top, innerH]);

  /* Auto-detected notable points within view */
  const autoPoints = useMemo(() => {
    const list: Array<{ x: number; y: number; color: string; kind: string }> = [];
    fns.forEach((f, i) => {
      const c = COLORS[i % COLORS.length];
      for (const r of findRoots(f.fn, xmin, xmax)) {
        list.push({ x: r, y: 0, color: c, kind: "akar" });
      }
      if (xmin <= 0 && xmax >= 0) {
        const y0 = f.fn(0);
        if (Number.isFinite(y0)) list.push({ x: 0, y: y0, color: c, kind: "potong-y" });
      }
      for (const e of findExtrema(f.fn, xmin, xmax)) {
        list.push({ x: e.x, y: e.y, color: c, kind: e.kind === "max" ? "puncak" : "lembah" });
      }
    });
    return list;
  }, [fns, xmin, xmax]);

  /* ----- Pan + Zoom interactions ----- */
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const dragStart = useRef<{ x: number; y: number; view: View } | null>(null);
  const pinchStart = useRef<{ dist: number; mid: { x: number; y: number }; view: View } | null>(null);

  const zoomAt = useCallback(
    (factor: number, cx?: number, cy?: number) => {
      setView((v) => {
        const xs = v.xmax - v.xmin;
        const ys = v.ymax - v.ymin;
        const ax = cx ?? (v.xmin + v.xmax) / 2;
        const ay = cy ?? (v.ymin + v.ymax) / 2;
        const nxs = xs * factor;
        const nys = ys * factor;
        // clamp zoom
        if (nxs < 1e-4 || nxs > 1e7) return v;
        return {
          xmin: ax - (ax - v.xmin) * factor,
          xmax: ax + (v.xmax - ax) * factor,
          ymin: ay - (ay - v.ymin) * factor,
          ymax: ay + (v.ymax - ay) * factor,
        };
      });
    },
    [setView],
  );

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      dragStart.current = { x: e.clientX, y: e.clientY, view: { ...view } };
    } else if (pointers.current.size === 2) {
      const pts = Array.from(pointers.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      pinchStart.current = {
        dist: Math.hypot(dx, dy),
        mid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
        view: { ...view },
      };
      dragStart.current = null;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();

    if (pointers.current.size === 2 && pinchStart.current) {
      const pts = Array.from(pointers.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy);
      const factor = pinchStart.current.dist / dist;
      const v0 = pinchStart.current.view;
      const cxClient = pinchStart.current.mid.x - rect.left;
      const cyClient = pinchStart.current.mid.y - rect.top;
      // map client px to data using ORIGINAL view
      const ratioX = cxClient / rect.width;
      const ratioY = cyClient / rect.height;
      const px = M.left + ratioX * innerW * (W / rect.width === 0 ? 1 : 1); // unused
      // simpler: compute data coord with v0
      const ax = v0.xmin + ((cxClient - M.left * (rect.width / W)) / (innerW * (rect.width / W))) * (v0.xmax - v0.xmin);
      const ay = v0.ymax - ((cyClient - M.top * (rect.height / H)) / (innerH * (rect.height / H))) * (v0.ymax - v0.ymin);
      const nxs = (v0.xmax - v0.xmin) * factor;
      if (nxs < 1e-4 || nxs > 1e7) return;
      setView({
        xmin: ax - (ax - v0.xmin) * factor,
        xmax: ax + (v0.xmax - ax) * factor,
        ymin: ay - (ay - v0.ymin) * factor,
        ymax: ay + (v0.ymax - ay) * factor,
      });
      void px;
      void ratioY;
      return;
    }

    if (dragStart.current) {
      const ds = dragStart.current;
      const scaleX = rect.width / W;
      const scaleY = rect.height / H;
      const dxPx = (e.clientX - ds.x) / scaleX;
      const dyPx = (e.clientY - ds.y) / scaleY;
      const dux = (dxPx / innerW) * (ds.view.xmax - ds.view.xmin);
      const duy = (dyPx / innerH) * (ds.view.ymax - ds.view.ymin);
      setView({
        xmin: ds.view.xmin - dux,
        xmax: ds.view.xmax - dux,
        ymin: ds.view.ymin + duy,
        ymax: ds.view.ymax + duy,
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) dragStart.current = null;
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const cxPx = e.clientX - rect.left;
    const cyPx = e.clientY - rect.top;
    const scaleX = rect.width / W;
    const scaleY = rect.height / H;
    const cx = invX(cxPx / scaleX);
    const cy = invY(cyPx / scaleY);
    const factor = e.deltaY > 0 ? 1.12 : 1 / 1.12;
    zoomAt(factor, cx, cy);
  };

  // axis line positions (clamped)
  const axisY = sy(Math.min(Math.max(0, ymin), ymax));
  const axisX = sx(Math.min(Math.max(0, xmin), xmax));
  const showXAxis = ymin <= 0 && ymax >= 0;
  const showYAxis = xmin <= 0 && xmax >= 0;

  return (
    <div ref={wrapperRef} className="relative w-full" style={{ height: H }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        className="block touch-none select-none rounded-2xl bg-white"
        style={{ cursor: dragStart.current ? "grabbing" : "grab" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
        role="img"
        aria-label="Grafik fungsi interaktif"
      >
        {/* outer frame */}
        <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={16} fill="#ffffff" stroke="#EEF2F7" />

        {/* minor grid */}
        <g stroke="#F1F5F9" strokeWidth={1}>
          {xTicksMinor.map((t) => (
            <line key={`mx${t}`} x1={sx(t)} x2={sx(t)} y1={M.top} y2={M.top + innerH} />
          ))}
          {yTicksMinor.map((t) => (
            <line key={`my${t}`} x1={M.left} x2={M.left + innerW} y1={sy(t)} y2={sy(t)} />
          ))}
        </g>

        {/* major grid */}
        <g stroke="#E2E8F0" strokeWidth={1}>
          {xTicks.map((t) => (
            <line key={`gx${t}`} x1={sx(t)} x2={sx(t)} y1={M.top} y2={M.top + innerH} />
          ))}
          {yTicks.map((t) => (
            <line key={`gy${t}`} x1={M.left} x2={M.left + innerW} y1={sy(t)} y2={sy(t)} />
          ))}
        </g>

        {/* axes */}
        <g stroke="#94A3B8" strokeWidth={1.4}>
          {showXAxis && <line x1={M.left} x2={M.left + innerW} y1={axisY} y2={axisY} />}
          {showYAxis && <line x1={axisX} x2={axisX} y1={M.top} y2={M.top + innerH} />}
        </g>

        {/* tick labels */}
        <g fontSize={11} fill="#64748B" fontFamily="ui-sans-serif, system-ui">
          {xTicks.map((t) => {
            if (Math.abs(t) < 1e-9 && showYAxis) return null;
            return (
              <text key={`tx${t}`} x={sx(t)} y={M.top + innerH + 14} textAnchor="middle">
                {fmt(t)}
              </text>
            );
          })}
          {yTicks.map((t) => {
            if (Math.abs(t) < 1e-9 && showXAxis) return null;
            return (
              <text key={`ty${t}`} x={M.left - 6} y={sy(t) + 4} textAnchor="end">
                {fmt(t)}
              </text>
            );
          })}
        </g>

        {/* clip for curves */}
        <clipPath id="plot-clip">
          <rect x={M.left} y={M.top} width={innerW} height={innerH} rx={8} />
        </clipPath>

        {/* curves */}
        <g clipPath="url(#plot-clip)" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {fns.map((_, i) => (
            <path
              key={i}
              d={curvePaths[i]}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2.4}
              opacity={0.95}
            />
          ))}
        </g>

        {/* notable points */}
        <g clipPath="url(#plot-clip)">
          {autoPoints.map((p, i) => (
            <g key={i}>
              <circle cx={sx(p.x)} cy={sy(p.y)} r={4.5} fill="#ffffff" stroke={p.color} strokeWidth={2} />
            </g>
          ))}
          {manualPoints.map((p, i) => (
            <g key={`m${i}`}>
              <circle cx={sx(p.x)} cy={sy(p.y)} r={4.5} fill="#3B82F6" stroke="#ffffff" strokeWidth={2} />
            </g>
          ))}
        </g>
      </svg>

      {/* Floating controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 rounded-2xl border border-slate-200/80 bg-white/80 p-1.5 shadow-lg shadow-slate-900/5 backdrop-blur-md">
        <button
          type="button"
          onClick={() => zoomAt(1 / 1.25)}
          className="grid h-8 w-8 place-items-center rounded-xl text-slate-600 transition hover:bg-blue-50 hover:text-blue-600 active:scale-95"
          aria-label="Zoom in"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => zoomAt(1.25)}
          className="grid h-8 w-8 place-items-center rounded-xl text-slate-600 transition hover:bg-blue-50 hover:text-blue-600 active:scale-95"
          aria-label="Zoom out"
        >
          <Minus className="h-4 w-4" />
        </button>
        <div className="mx-1.5 h-px bg-slate-200" />
        <button
          type="button"
          onClick={() => setView(initialView)}
          className="grid h-8 w-8 place-items-center rounded-xl text-slate-600 transition hover:bg-blue-50 hover:text-blue-600 active:scale-95"
          aria-label="Reset"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Public component                                                  */
/* ---------------------------------------------------------------- */

export function PlotBlock({ source }: { source: string }) {
  const { xmin: srcXmin, xmax: srcXmax, fns, points: manualPoints } = useMemo(
    () => parsePlot(source),
    [source],
  );

  const initialView = useMemo<View>(() => {
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
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
      lo = -10;
      hi = 10;
    }
    if (lo === hi) {
      lo -= 1;
      hi += 1;
    }
    const pad = (hi - lo) * 0.2;
    return {
      xmin: srcXmin,
      xmax: srcXmax,
      ymin: Math.floor(lo - pad),
      ymax: Math.ceil(hi + pad),
    };
  }, [srcXmin, srcXmax, fns]);

  const [view, setView] = useState<View>(initialView);
  useEffect(() => setView(initialView), [initialView]);

  const [fullscreen, setFullscreen] = useState(false);

  // ESC to exit fullscreen + lock body scroll
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

  /* Info panel data (computed on initial view so it represents the function fully) */
  const info = useMemo(() => {
    return fns.map((f, i) => {
      const xmin = srcXmin;
      const xmax = srcXmax;
      const roots = findRoots(f.fn, xmin, xmax);
      const yInt = xmin <= 0 && xmax >= 0 ? f.fn(0) : NaN;
      const extrema = findExtrema(f.fn, xmin, xmax);
      // sample range
      let lo = Infinity;
      let hi = -Infinity;
      for (let k = 0; k <= 400; k++) {
        const x = xmin + ((xmax - xmin) * k) / 400;
        const y = f.fn(x);
        if (Number.isFinite(y) && Math.abs(y) < 1e8) {
          if (y < lo) lo = y;
          if (y > hi) hi = y;
        }
      }
      return {
        label: f.label,
        color: COLORS[i % COLORS.length],
        domain: `[${fmt(xmin)}, ${fmt(xmax)}]`,
        range: Number.isFinite(lo) ? `[${fmt(lo)}, ${fmt(hi)}]` : "—",
        roots,
        yInt,
        extrema,
      };
    });
  }, [fns, srcXmin, srcXmax]);

  if (fns.length === 0) {
    return (
      <div className="not-prose my-3 rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        Tidak bisa membaca fungsi grafik.
      </div>
    );
  }

  const Card = (
    <div className="not-prose flex w-full flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06),0_12px_40px_-12px_rgba(15,23,42,0.12)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-blue-50/60 via-white to-white px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm shadow-blue-500/30">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold tracking-tight text-slate-900">Grafik Fungsi</div>
            <div className="truncate font-mono text-[11px] text-slate-500">
              {fns.map((f) => f.label).join("  ·  ")}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setFullscreen((v) => !v)}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-blue-50 hover:text-blue-600 active:scale-95"
          aria-label={fullscreen ? "Tutup fullscreen" : "Fullscreen"}
        >
          {fullscreen ? <X className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Body: graph + info panel */}
      <div className={fullscreen ? "flex h-full min-h-0 flex-1 flex-col lg:flex-row" : "flex flex-col lg:flex-row"}>
        <div className={fullscreen ? "flex-1 min-h-0 p-3" : "flex-1 p-3"}>
          <PlotSurface
            fns={fns}
            manualPoints={manualPoints}
            view={view}
            setView={setView}
            initialView={initialView}
            height={fullscreen ? Math.max(420, window.innerHeight - 220) : 380}
          />
        </div>

        {/* Info panel */}
        <div className="border-t border-slate-100 bg-slate-50/40 p-3 lg:w-72 lg:border-l lg:border-t-0">
          <div className="space-y-2.5">
            {info.map((it, i) => (
              <div
                key={i}
                className="animate-fade-in rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: it.color }} />
                  <span className="truncate font-mono text-[12px] font-semibold text-slate-900">
                    {it.label}
                  </span>
                </div>
                <dl className="mt-2 space-y-1 text-[11.5px]">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Domain</dt>
                    <dd className="font-mono text-slate-800">{it.domain}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Range</dt>
                    <dd className="font-mono text-slate-800">{it.range}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Potong-y</dt>
                    <dd className="font-mono text-slate-800">
                      {Number.isFinite(it.yInt) ? `(0, ${fmt(it.yInt)})` : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Akar</dt>
                    <dd className="font-mono text-right text-slate-800">
                      {it.roots.length
                        ? it.roots.slice(0, 3).map((r) => `(${fmt(r)}, 0)`).join(", ")
                        : "—"}
                    </dd>
                  </div>
                  {it.extrema.length > 0 && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Titik balik</dt>
                      <dd className="font-mono text-right text-slate-800">
                        {it.extrema
                          .slice(0, 2)
                          .map((e) => `${e.kind === "max" ? "↑" : "↓"} (${fmt(e.x)}, ${fmt(e.y)})`)
                          .join(", ")}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            ))}
            <p className="px-1 text-[10.5px] leading-relaxed text-slate-400">
              Geser untuk menggeser · scroll / pinch untuk zoom · tombol reset untuk kembali.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <>
        <div className="not-prose my-4 rounded-3xl border border-dashed border-blue-200 bg-blue-50/30 px-4 py-6 text-center text-sm text-blue-600">
          Grafik ditampilkan dalam mode fullscreen
        </div>
        <div className="fixed inset-0 z-[100] flex animate-fade-in items-center justify-center bg-slate-900/40 p-3 backdrop-blur-sm sm:p-6">
          <div className="flex h-full max-h-[96vh] w-full max-w-6xl animate-scale-in">
            {Card}
          </div>
        </div>
      </>
    );
  }

  return <div className="not-prose my-4 animate-fade-in">{Card}</div>;
}
