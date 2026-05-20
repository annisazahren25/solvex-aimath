import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Upload, Sparkles, Zap, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/solvex/logo";
import { AnimatedBackground } from "@/components/solvex/animated-background";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <AnimatedBackground variant="default" />
      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-12">
        <Logo />
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" className="rounded-full"><Link to="/login">Sign in</Link></Button>
          <Button asChild className="rounded-full bg-gradient-primary text-primary-foreground shadow-soft hover:opacity-90">
            <Link to="/register">Get started</Link>
          </Button>
        </nav>
      </header>

      <main className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 pt-16 text-center md:pt-28">
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary"
        >
          <Sparkles className="h-3.5 w-3.5" /> AI-powered math tutor
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-6 font-display text-5xl font-bold tracking-tight md:text-7xl"
        >
          Solve Any Math Problem<br />
          <span className="bg-gradient-primary bg-clip-text text-transparent">Instantly.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 max-w-2xl text-lg text-muted-foreground"
        >
          Upload questions, scan equations, and learn step-by-step with AI.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-10 flex flex-col items-center gap-3 sm:flex-row"
        >
          <Button asChild size="lg" className="h-12 rounded-full bg-gradient-primary px-7 text-primary-foreground shadow-glow hover:opacity-90">
            <Link to="/register">Start Solving <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 rounded-full border-border bg-card px-7">
            <Link to="/register"><Upload className="mr-2 h-4 w-4" /> Upload Question</Link>
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-24 grid w-full max-w-4xl grid-cols-1 gap-5 sm:grid-cols-3"
        >
          {[
            { icon: Zap, title: "Instant answers", desc: "Stream step-by-step solutions in real time." },
            { icon: BookOpen, title: "Learn by doing", desc: "Every step explained in plain English." },
            { icon: Upload, title: "Scan & solve", desc: "Snap a photo of your equation, we'll handle the rest." },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.5, ease: "easeOut" }}
              whileHover={{ y: -6, transition: { duration: 0.25 } }}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card/80 p-6 text-left shadow-soft backdrop-blur-sm transition-shadow hover:shadow-glow"
            >
              <div className="pointer-events-none absolute inset-0 -z-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <motion.div
                whileHover={{ rotate: -6, scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300, damping: 18 }}
                className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow"
              >
                <f.icon className="h-5 w-5" />
              </motion.div>
              <h3 className="mt-4 font-display font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </main>
      <div className="h-24" />
    </div>
  );
}
