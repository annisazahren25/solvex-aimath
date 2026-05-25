import { motion } from "framer-motion";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "soft" | "vivid";

const MATH_SYMBOLS = [
  "∑", "π", "∫", "√", "∞", "θ", "λ", "Δ", "∂", "≈",
  "≠", "÷", "×", "α", "β", "γ", "φ", "ƒ(x)", "x²", "πr²",
  "e^x", "log", "sin", "cos", "∇",
];

/**
 * Premium animated background:
 * - 3 large blurred gradient orbs that drift slowly
 * - Subtle floating math symbols
 * - Soft grid overlay
 *
 * Place once per page as a fixed/absolute layer behind content.
 * Use `pointer-events-none` is already applied.
 */
export function AnimatedBackground({
  variant = "default",
  symbols = true,
  grid = true,
  className,
}: {
  variant?: Variant;
  symbols?: boolean;
  grid?: boolean;
  className?: string;
}) {
  // Deterministic pseudo-random so SSR and client render the same positions
  // (Math.random() would cause hydration mismatches).
  const floaters = useMemo(() => {
    const rand = (seed: number) => {
      const x = Math.sin(seed * 9301 + 49297) * 233280;
      return x - Math.floor(x);
    };
    return Array.from({ length: 14 }).map((_, i) => ({
      id: i,
      symbol: MATH_SYMBOLS[i % MATH_SYMBOLS.length],
      left: rand(i + 1) * 100,
      top: rand(i + 2) * 100,
      size: 14 + rand(i + 3) * 34,
      delay: rand(i + 4) * 6,
      duration: 14 + rand(i + 5) * 16,
      drift: 20 + rand(i + 6) * 40,
      rotate: (rand(i + 7) - 0.5) * 40,
    }));
  }, []);

  const orbOpacity = variant === "vivid" ? 0.55 : variant === "soft" ? 0.25 : 0.4;

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden",
        className,
      )}
    >
      {/* Base soft wash */}
      <div className="absolute inset-0 bg-gradient-soft" />

      {/* Orb 1 */}
      <motion.div
        className="absolute -top-32 -left-32 h-[520px] w-[520px] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, oklch(0.72 0.18 254 / 0.55), transparent 70%)",
          opacity: orbOpacity,
        }}
        animate={{ x: [0, 60, -20, 0], y: [0, 40, -10, 0], scale: [1, 1.08, 0.96, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Orb 2 */}
      <motion.div
        className="absolute top-1/3 -right-40 h-[560px] w-[560px] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 60% 40%, oklch(0.78 0.16 200 / 0.5), transparent 70%)",
          opacity: orbOpacity,
        }}
        animate={{ x: [0, -50, 30, 0], y: [0, -30, 40, 0], scale: [1, 0.95, 1.1, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Orb 3 */}
      <motion.div
        className="absolute -bottom-40 left-1/4 h-[600px] w-[600px] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, oklch(0.78 0.16 310 / 0.45), transparent 70%)",
          opacity: orbOpacity,
        }}
        animate={{ x: [0, 40, -40, 0], y: [0, -20, 20, 0], scale: [1, 1.05, 0.98, 1] }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Soft grid overlay */}
      {grid && (
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(to right, oklch(0.18 0.04 260) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.18 0.04 260) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage:
              "radial-gradient(ellipse at center, black 30%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          }}
        />
      )}

      {/* Floating math symbols */}
      {symbols &&
        floaters.map((f) => (
          <motion.span
            key={f.id}
            className="absolute select-none font-display font-semibold text-primary/25"
            style={{
              left: `${f.left}%`,
              top: `${f.top}%`,
              fontSize: f.size,
            }}
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 0.7, 0.7, 0],
              y: [0, -f.drift, 0],
              x: [0, f.drift / 2, 0],
              rotate: [0, f.rotate, 0],
            }}
            transition={{
              duration: f.duration,
              delay: f.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            {f.symbol}
          </motion.span>
        ))}
    </div>
  );
}
