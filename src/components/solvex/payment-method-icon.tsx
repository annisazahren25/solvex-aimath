import { cn } from "@/lib/utils";

type Props = { method: string; className?: string };

/**
 * Branded payment-method "logo" tiles. We render text marks tinted with the
 * brand's recognizable color instead of pulling in external SVG assets, so it
 * looks polished without any network dependency.
 */
export function PaymentMethodIcon({ method, className }: Props) {
  const m = BRANDS[method] ?? BRANDS.card;
  return (
    <div
      className={cn(
        "grid h-12 w-12 place-items-center rounded-xl text-[10px] font-extrabold tracking-tight shadow-sm",
        className,
      )}
      style={{ background: m.bg, color: m.fg }}
    >
      {m.label}
    </div>
  );
}

const BRANDS: Record<string, { label: string; bg: string; fg: string }> = {
  gopay:     { label: "GoPay",  bg: "#00AED6", fg: "#FFFFFF" },
  ovo:       { label: "OVO",    bg: "#4C2A86", fg: "#FFFFFF" },
  dana:      { label: "DANA",   bg: "#118EEA", fg: "#FFFFFF" },
  shopeepay: { label: "Shopee", bg: "#EE4D2D", fg: "#FFFFFF" },
  qris:      { label: "QRIS",   bg: "#ED1C24", fg: "#FFFFFF" },
  bca:       { label: "BCA",    bg: "#005EB8", fg: "#FFFFFF" },
  mandiri:   { label: "Mandiri",bg: "#003D79", fg: "#FFD200" },
  bni:       { label: "BNI",    bg: "#F26522", fg: "#FFFFFF" },
  card:      { label: "CARD",   bg: "#0F172A", fg: "#FFFFFF" },
};
