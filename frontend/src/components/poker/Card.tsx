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
  Hearts: "#d61f2c",
  Diamonds: "#d61f2c",
  Clubs: "#111827",
  Spades: "#111827",
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
    sm: { width: 44, height: 62, rank: 13, suit: 10, center: 22 },
    md: { width: 62, height: 86, rank: 18, suit: 13, center: 30 },
    lg: { width: 80, height: 112, rank: 22, suit: 16, center: 40 },
  };

  const s = sizeStyles[size];

  if (faceDown || !card) {
    return (
      <motion.div
        initial={{ rotateY: 180, y: -24, scale: 0.7, opacity: 0 }}
        animate={{ rotateY: 0, y: 0, scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 22, delay }}
        className={`card-back relative rounded-lg overflow-hidden cursor-default select-none shrink-0 ${className}`}
        style={{
          width: s.width,
          height: s.height,
          border: "2px solid #fdf6e3",
          boxShadow: "0 6px 14px rgba(0,0,0,0.45)",
          transformPerspective: 600,
        }}
      >
        <div className="absolute inset-[3px] rounded-[5px] border border-[#f7e19f]/40 flex items-center justify-center">
          <div
            className="rounded-full border border-[#f7e19f]/50 bg-black/20 flex items-center justify-center text-[#f7e19f]"
            style={{ width: s.width * 0.45, height: s.width * 0.45 }}
          >
            <div style={{ width: s.width * 0.24, height: s.width * 0.24 }}>{SUIT_SVGS.Spades}</div>
          </div>
        </div>
      </motion.div>
    );
  }

  const suitIcon = SUIT_SVGS[card.suit];
  const rank = RANK_DISPLAY[card.rank] || card.rank;
  const color = SUIT_COLORS[card.suit] || "#1f2937";

  return (
    <motion.div
      initial={{ rotateY: 180, y: -24, scale: 0.7, opacity: 0 }}
      animate={{ rotateY: 0, y: highlight ? -6 : 0, scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 22, delay }}
      className={`card-face relative rounded-lg cursor-default select-none shrink-0 flex flex-col items-center ${className}`}
      style={{
        width: s.width,
        height: s.height,
        transformPerspective: 600,
        border: highlight ? "2px solid #e8b923" : "1px solid rgba(0,0,0,0.12)",
        boxShadow: highlight
          ? "0 0 18px rgba(232,185,35,0.65), 0 8px 18px rgba(0,0,0,0.4)"
          : "0 6px 14px rgba(0,0,0,0.35), inset 0 -2px 0 rgba(0,0,0,0.05)",
      }}
    >
      {/* Top Left */}
      <div
        className="absolute flex flex-col items-center"
        style={{
          top: size === "xs" ? 2 : 4,
          left: size === "xs" ? 2 : 4,
          color,
          width: Math.max(s.suit, s.rank),
        }}
      >
        <span className="font-black leading-none tracking-tighter" style={{ fontSize: s.rank }}>{rank}</span>
        <div className="mt-0.5" style={{ width: s.suit }}>{suitIcon}</div>
      </div>

      {/* Center Large Suit */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ color }}>
        <div style={{ width: s.center, height: s.center, marginTop: s.height * 0.12, marginLeft: s.width * 0.12 }}>{suitIcon}</div>
      </div>
    </motion.div>
  );
}
