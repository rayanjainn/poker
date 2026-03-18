"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Spade, Heart, Diamond, Club, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function HomePage() {
  const router = useRouter();
  const { user, guestLogin, isLoading } = useAuth();

  useEffect(() => {
    if (user) {
      router.push("/lobby");
      return;
    }
    if (!isLoading && !user) {
      // Auto guest login
      guestLogin().catch(console.log);
    }
  }, [user, isLoading, guestLogin, router]);

  const suits = [
    { Icon: Spade, color: "#fff" },
    { Icon: Heart, color: "#e74c3c" },
    { Icon: Diamond, color: "#e74c3c" },
    { Icon: Club, color: "#fff" },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 8 }).map((_, i) => {
          const SuitInfo = suits[i % 4];
          return (
            <motion.div
              key={i}
              className="absolute opacity-[0.04]"
              style={{
                left: `${10 + i * 12}%`,
                top: `${15 + (i % 3) * 25}%`,
                color: SuitInfo.color,
              }}
              animate={{
                y: [0, -20, 0],
                rotate: [0, i % 2 ? 15 : -15, 0],
              }}
              transition={{
                duration: 5 + i * 0.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.3,
              }}
            >
              <SuitInfo.Icon size={48} />
            </motion.div>
          );
        })}

        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(212,168,67,0.06) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Logo + Loading */}
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, type: "spring" }}
        className="text-center z-10"
      >
        <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-2">
          <span className="text-gradient-gold">ACE</span>
          <span className="text-foreground ml-2">ARENA</span>
        </h1>
        <p className="text-muted-foreground text-sm md:text-base tracking-widest uppercase mb-6">
          Premium Online Poker
        </p>
        <div className="flex items-center justify-center gap-6 mb-10">
          <div className="h-px w-16 bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
          <div className="flex gap-4">
            <Spade className="w-5 h-5 text-gold/60" />
            <Heart className="w-5 h-5 text-red-500/60" />
            <Diamond className="w-5 h-5 text-red-500/60" />
            <Club className="w-5 h-5 text-gold/60" />
          </div>
          <div className="h-px w-16 bg-gradient-to-l from-transparent via-gold/40 to-transparent" />
        </div>

        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          className="mx-auto mb-4 flex justify-center"
        >
          <Loader2 className="w-10 h-10 text-gold/40" />
        </motion.div>
        <p className="text-sm text-muted-foreground animate-pulse tracking-widest uppercase">
          Entering the arena...
        </p>
      </motion.div>
    </div>
  );
}
