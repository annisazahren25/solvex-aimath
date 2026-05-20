import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Play, X, Sparkles, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

// Rotating pool of royalty-free dummy ad clips (Google's public sample bucket).
const DUMMY_ADS = [
  {
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    sponsor: "BunnyCo",
    tagline: "Hop into something delightful.",
  },
  {
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    sponsor: "DreamLabs",
    tagline: "Imagination, rendered.",
  },
  {
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    sponsor: "Joyride+",
    tagline: "Bigger thrills, every day.",
  },
  {
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    sponsor: "FunWorks",
    tagline: "More fun in every frame.",
  },
];

const AD_SECONDS = 8;

export function AdModal({
  open,
  onClose,
  onComplete,
  title = "Watch a short ad to unlock",
  subtitle = "Your reward will appear right after this preview.",
}: {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  title?: string;
  subtitle?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [seconds, setSeconds] = useState(AD_SECONDS);
  const [muted, setMuted] = useState(true);
  const [ad, setAd] = useState(DUMMY_ADS[0]);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (open) {
      setAd(DUMMY_ADS[Math.floor(Math.random() * DUMMY_ADS.length)]);
    } else {
      setPlaying(false);
      setSeconds(AD_SECONDS);
      setMuted(true);
    }
  }, [open]);

  useEffect(() => {
    if (!playing) return;
    if (seconds <= 0) {
      onComplete();
      return;
    }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [playing, seconds, onComplete]);

  const startAd = () => {
    setPlaying(true);
    // Kick off playback explicitly so iOS/Safari honors the user gesture.
    requestAnimationFrame(() => {
      videoRef.current?.play().catch(() => {});
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 px-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-glow"
          >
            {!playing && (
              <button
                onClick={onClose}
                className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            <div className="text-center">
              <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
                <Sparkles className="h-7 w-7" />
              </div>
              <h3 className="font-display text-xl font-bold tracking-tight">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            </div>

            <div className="relative mt-6 aspect-video overflow-hidden rounded-2xl bg-black">
              <video
                ref={videoRef}
                src={ad.src}
                muted={muted}
                playsInline
                preload="metadata"
                className={
                  "h-full w-full object-cover transition-opacity " +
                  (playing ? "opacity-100" : "opacity-40")
                }
                onEnded={() => onComplete()}
              />
              {!playing && (
                <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-primary/30 via-black/40 to-black/60">
                  <Button
                    onClick={startAd}
                    className="gap-2 rounded-full bg-gradient-primary px-6 text-primary-foreground shadow-glow hover:opacity-90"
                  >
                    <Play className="h-4 w-4 fill-current" /> Watch ad ({AD_SECONDS}s)
                  </Button>
                </div>
              )}
              {playing && (
                <>
                  <div className="absolute left-3 top-3 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground backdrop-blur">
                    {ad.sponsor}
                  </div>
                  <div className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-background/70 text-foreground backdrop-blur">
                    <CountdownRing seconds={seconds} total={AD_SECONDS} small />
                  </div>
                  <button
                    type="button"
                    onClick={() => setMuted((m) => !m)}
                    className="absolute bottom-3 left-3 grid h-8 w-8 place-items-center rounded-full bg-background/70 text-foreground backdrop-blur transition hover:bg-background"
                    aria-label={muted ? "Unmute" : "Mute"}
                  >
                    {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </button>
                  <div className="absolute bottom-3 right-3 max-w-[60%] truncate rounded-full bg-background/70 px-2 py-0.5 text-right text-[10px] font-medium text-muted-foreground backdrop-blur">
                    {ad.tagline}
                  </div>
                </>
              )}
              <div className="pointer-events-none absolute bottom-1 right-1 rounded bg-background/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                Ad
              </div>
            </div>

            <div className="mt-5 text-center">
              <p className="text-xs text-muted-foreground">
                No ads with SolveX Pro.{" "}
                <Link to="/pricing" className="font-semibold text-primary hover:underline">
                  Upgrade →
                </Link>
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CountdownRing({
  seconds,
  total,
  small = false,
}: {
  seconds: number;
  total: number;
  small?: boolean;
}) {
  const radius = small ? 12 : 28;
  const circ = 2 * Math.PI * radius;
  const progress = ((total - seconds) / total) * circ;
  const size = small ? "h-7 w-7" : "h-20 w-20";
  const viewBox = small ? "0 0 30 30" : "0 0 64 64";
  const cx = small ? 15 : 32;
  const cy = small ? 15 : 32;
  const textCls = small
    ? "text-[10px] font-bold text-foreground"
    : "font-display text-2xl font-bold text-primary";
  return (
    <div className={`relative grid ${size} place-items-center`}>
      <svg className="absolute inset-0 -rotate-90" viewBox={viewBox}>
        <circle cx={cx} cy={cy} r={radius} stroke="currentColor" strokeWidth={small ? 2 : 4} className="text-muted opacity-30" fill="none" />
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke="currentColor"
          strokeWidth={small ? 2 : 4}
          strokeLinecap="round"
          className="text-primary"
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={circ - progress}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <span className={textCls}>{seconds}</span>
    </div>
  );
}
