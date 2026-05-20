import { useMemo } from "react";

/** Deterministic pseudo-QR. Pure CSS grid, no external dep. */
export function FakeQR({ value, size = 200 }: { value: string; size?: number }) {
  const grid = 25;
  const cells = useMemo(() => {
    // Simple hash → bit pattern. Looks like a QR, not scannable on purpose.
    const out: boolean[] = [];
    let h = 2166136261 >>> 0;
    for (let i = 0; i < value.length; i++) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    for (let i = 0; i < grid * grid; i++) {
      h ^= h << 13; h >>>= 0;
      h ^= h >>> 17;
      h ^= h << 5;  h >>>= 0;
      out.push((h & 7) > 3);
    }
    // Force the 3 finder corners on
    const finder = (r: number, c: number) => {
      for (let dr = 0; dr < 7; dr++)
        for (let dc = 0; dc < 7; dc++) {
          const edge = dr === 0 || dr === 6 || dc === 0 || dc === 6;
          const inner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
          out[(r + dr) * grid + (c + dc)] = edge || inner;
        }
    };
    finder(0, 0); finder(0, grid - 7); finder(grid - 7, 0);
    return out;
  }, [value]);

  return (
    <div
      className="rounded-2xl bg-white p-3 shadow-soft ring-1 ring-border"
      style={{ width: size + 24, height: size + 24 }}
    >
      <div
        className="grid"
        style={{
          width: size,
          height: size,
          gridTemplateColumns: `repeat(${grid}, 1fr)`,
          gridTemplateRows: `repeat(${grid}, 1fr)`,
        }}
      >
        {cells.map((on, i) => (
          <div key={i} style={{ background: on ? "#0F172A" : "transparent" }} />
        ))}
      </div>
    </div>
  );
}
