"use client";

import { motion } from "framer-motion";
import type { Card as CardType } from "@/lib/types";

const SUIT_SVGS: Record<string, React.ReactNode> = {
  Hearts: (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      <path
        d="M100 180c-2-2-75-68-75-115 0-35 25-50 45-50 20 0 30 15 30 15s10-15 30-15c20 0 45 15 45 50 0 47-73 113-75 115z"
        fill="currentColor"
      />
    </svg>
  ),
  Diamonds: (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      <path d="M100 20 L165 100 L100 180 L35 100 Z" fill="currentColor" />
    </svg>
  ),
  Clubs: (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      <path
        d="M100 85c15 0 28-12 28-28 0-15-12-28-28-28S72 42 72 57c0 15 12 28 28 28zm35 60c15 0 28-12 28-28 0-15-12-28-28-28s-28 12-28 28c0 15 12 28 28 28zm-70 0c15 0 28-12 28-28 0-15-12-28-28-28s-28 12-28 28c0 15 12 28 28 28zM100 135v45h-10v-45h10z"
        fill="currentColor"
      />
    </svg>
  ),
  Spades: (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      <path
        d="M100 20c-2 2-65 65-65 108 0 35 25 45 45 45 15 0 20-10 20-10s5 10 20 10c20 0 45-10 45-45 0-43-63-106-65-108zm0 153v15h-10v-15h10z"
        fill="currentColor"
      />
    </svg>
  ),
};

const SUIT_COLORS: Record<string, string> = {
  Hearts: "#ea3323", // Casino red
  Diamonds: "#ea3323",
  Clubs: "#0d0d14",  // Casino black
  Spades: "#0d0d14",
};

const RANK_DISPLAY: Record<string, string> = {
  Two: "2",
  Three: "3",
  Four: "4",
  Five: "5",
  Six: "6",
  Seven: "7",
  Eight: "8",
  Nine: "9",
  Ten: "10",
  Jack: "J",
  Queen: "Q",
  King: "K",
  Ace: "A",
};

interface PokerCardProps {
  card?: CardType;
  faceDown?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
  delay?: number;
  className?: string;
  highlight?: boolean;
}

export function PokerCard({
  card,
  faceDown = false,
  size = "md",
  delay = 0,
  className = "",
  highlight = false,
}: PokerCardProps) {
  const sizeStyles = {
    xs: { width: 34, height: 48, rank: 9, suit: 8, center: 16 },
    sm: { width: 44, height: 62, rank: 11, suit: 10, center: 20 },
    md: { width: 62, height: 86, rank: 14, suit: 12, center: 28 },
    lg: { width: 80, height: 112, rank: 18, suit: 16, center: 36 },
  };

  const s = sizeStyles[size];

  if (faceDown || !card) {
    return (
      <motion.div
        initial={{ rotateY: 180, scale: 0.8, opacity: 0 }}
        animate={{ rotateY: 0, scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, delay }}
        className={`relative rounded-lg overflow-hidden cursor-default select-none shrink-0 shadow-lg ${className}`}
        style={{
          width: s.width,
          height: s.height,
          background: "#da4a4a", // PokerNow red card back
          border: "2px solid #ffffff",
        }}
      >
        <div className="absolute inset-2 border border-white/30 rounded-md flex items-center justify-center">
          <span className="text-white/80 font-bold tracking-widest rotate-[-45deg] select-none" style={{ fontSize: s.width * 0.15 }}>
            POKER
          </span>
        </div>
      </motion.div>
    );
  }

  const suitIcon = SUIT_SVGS[card.suit];
  const rank = RANK_DISPLAY[card.rank] || card.rank;
  const color = SUIT_COLORS[card.suit] || "#1f2937";

  return (
    <motion.div
      initial={{ rotateY: 180, scale: 0.8, opacity: 0 }}
      animate={{ rotateY: 0, scale: 1, opacity: 1 }}
      transition={{ duration: 0.4, delay, type: "spring", stiffness: 200 }}
      className={`relative rounded-lg cursor-default select-none shrink-0 flex flex-col items-center bg-white shadow-xl ${className}`}
      style={{
        width: s.width,
        height: s.height,
        border: highlight
          ? "2.5px solid #d4a843"
          : "1px solid rgba(0,0,0,0.1)",
        boxShadow: highlight
          ? "0 0 15px rgba(212,168,67,0.4), 0 4px 12px rgba(0,0,0,0.3)"
          : "0 4px 12px rgba(0,0,0,0.15)",
      }}
    >
      {/* Top Left */}
      <div
        className="absolute flex flex-col items-center"
        style={{
          top: size === "xs" ? 1 : 2,
          left: size === "xs" ? 2 : 4,
          color,
          width: s.suit,
        }}
      >
        <span className="font-black leading-none" style={{ fontSize: s.rank }}>{rank}</span>
        <div className="w-full mt-0.5">{suitIcon}</div>
      </div>

      {/* Center Large Suit */}
      <div
        className="absolute inset-0 flex items-center justify-center p-3 opacity-90"
        style={{ color }}
      >
        <div style={{ width: s.center, height: s.center }}>{suitIcon}</div>
      </div>

      {/* Bottom Right */}
      <div
        className="absolute flex flex-col items-center"
        style={{
          bottom: size === "xs" ? 1 : 2,
          right: size === "xs" ? 2 : 4,
          color,
          width: s.suit,
          transform: "rotate(180deg)",
        }}
      >
        <span className="font-black leading-none" style={{ fontSize: s.rank }}>{rank}</span>
        <div className="w-full mt-0.5">{suitIcon}</div>
      </div>
    </motion.div>
  );
}
