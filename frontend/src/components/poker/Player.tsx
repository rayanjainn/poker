"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PlayerInfo, Card as CardType } from "@/lib/types";
import { PokerCard } from "./Card";

function formatChips(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0) + "M";
  if (n >= 10_000) return (n / 1000).toFixed(n % 1000 ? 1 : 0) + "k";
  return n.toLocaleString();
}

interface PlayerSeatProps {
  player: PlayerInfo;
  isCurrentUser: boolean;
  isActionOn: boolean;
  isDealer?: boolean;
  holeCards?: CardType[];
  revealCards?: CardType[];
  position: { x: string; y: string };
  isMobile?: boolean;
  turnExpiresAt?: number;
  turnTimeoutSeconds?: number;
}

export function PlayerSeat({
  player,
  isCurrentUser,
  isActionOn,
  isDealer = false,
  holeCards,
  revealCards,
  position,
  isMobile = false,
  turnExpiresAt,
  turnTimeoutSeconds = 30,
}: PlayerSeatProps) {
  const initials = player.display_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Stable per-player avatar color
  const hue = [...player.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

  const cardSize = isMobile ? "xs" : "sm";
  const myCardSize = isMobile ? "sm" : "md";

  // Calculate remaining time percentage
  const [timeLeftPercent, setTimeLeftPercent] = useState(100);

  useEffect(() => {
    if (!isActionOn || !turnExpiresAt) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = turnExpiresAt - now;
      const total = turnTimeoutSeconds * 1000;
      const percent = Math.max(0, (remaining / total) * 100);
      setTimeLeftPercent(percent);
    }, 100);

    return () => clearInterval(interval);
  }, [isActionOn, turnExpiresAt, turnTimeoutSeconds]);

  const timerPercent = isActionOn && turnExpiresAt ? timeLeftPercent : 100;
  const timerColor = timerPercent > 50 ? "#4ade80" : timerPercent > 20 ? "#facc15" : "#ef4444";

  // Vector calculation to push cards towards center of table (50, 50)
  const cx = parseFloat(position.x);
  const cy = parseFloat(position.y);
  const dx = 50 - cx;
  const dy = 50 - cy;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;

  const inwardOffset = isMobile ? 46 : 85;
  const cardTranslateX = nx * inwardOffset;
  const cardTranslateY = ny * inwardOffset;

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="absolute flex items-center justify-center z-30"
      style={{
        left: position.x,
        top: position.y,
        width: isMobile ? 120 : 160,
        height: isMobile ? 120 : 160,
        transform: "translate(-50%, -50%)",
      }}
    >
      {/* Table Cards Vector Container */}
      <motion.div
        className="absolute z-0 flex items-center justify-center"
        animate={{ x: cardTranslateX, y: cardTranslateY }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {/* Hole cards current user */}
        {isCurrentUser && !player.is_folded && !player.is_sitting_out && (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{
              y: isActionOn ? -12 : 0,
              opacity: 1,
              scale: isActionOn ? 1.15 : 1,
            }}
            className="flex relative"
            style={{
              zIndex: 101,
              filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.5))",
            }}
          >
            {holeCards && holeCards.length > 0 ? (
              holeCards.map((card, i) => (
                <div key={i} style={{ marginLeft: i > 0 ? -12 : 0, transform: `rotate(${i === 0 ? -6 : 6}deg)`, transformOrigin: "bottom center" }}>
                  <PokerCard card={card} size={myCardSize} delay={i * 0.1} />
                </div>
              ))
            ) : (
              <>
                <div style={{ transform: "rotate(-6deg)", transformOrigin: "bottom center" }}>
                  <PokerCard faceDown size={myCardSize} delay={0} />
                </div>
                <div style={{ marginLeft: -12, transform: "rotate(6deg)", transformOrigin: "bottom center" }}>
                  <PokerCard faceDown size={myCardSize} delay={0.05} />
                </div>
              </>
            )}

            {player.current_hand_rank && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1 rounded-sm bg-white text-black text-[10px] font-black uppercase tracking-widest shadow-[0_4px_10px_rgba(0,0,0,0.3)] z-[110]"
              >
                {player.current_hand_rank}
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Other players cards back */}
        {!isCurrentUser && !revealCards && !player.is_folded && !player.is_sitting_out && player.chips >= 0 && (
            <div className="flex" style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.4))" }}>
              <div style={{ transform: "rotate(-6deg)", transformOrigin: "bottom center" }}>
                <PokerCard faceDown size={cardSize} delay={0} />
              </div>
              <div style={{ marginLeft: -8, transform: "rotate(6deg)", transformOrigin: "bottom center" }}>
                <PokerCard faceDown size={cardSize} delay={0.05} />
              </div>
            </div>
        )}

        {/* Opponent cards revealed */}
        {!isCurrentUser && revealCards && revealCards.length > 0 && (
          <motion.div
            initial={{ y: 5, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex"
            style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.4))" }}
          >
            {revealCards.map((card, i) => (
              <div key={i} style={{ marginLeft: i > 0 ? -8 : 0, transform: `rotate(${i === 0 ? -6 : 6}deg)`, transformOrigin: "bottom center" }}>
                <PokerCard card={card} size={cardSize} delay={i * 0.1} />
              </div>
            ))}
          </motion.div>
        )}
      </motion.div>

      {/* Seat plate */}
      <div className="relative group z-10">
        <motion.div
          animate={{ scale: isActionOn ? 1.06 : 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className={`relative flex items-center gap-2 rounded-full transition-[opacity,filter] duration-300 ${
            player.is_folded || player.is_sitting_out ? "opacity-45 grayscale" : ""
          } ${isActionOn ? "animate-action-ring" : ""}`}
          style={{
            minWidth: isMobile ? 104 : 140,
            padding: isMobile ? "3px 12px 3px 3px" : "4px 16px 4px 4px",
            background: isCurrentUser
              ? "linear-gradient(135deg, rgba(58,44,12,0.95), rgba(20,16,8,0.95))"
              : "linear-gradient(135deg, rgba(34,34,46,0.95), rgba(14,14,20,0.95))",
            border: isCurrentUser ? "1px solid rgba(232,185,35,0.45)" : "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 8px 20px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)",
          }}
        >
          {/* Avatar with circular turn timer */}
          <div className="relative shrink-0" style={{ width: isMobile ? 34 : 42, height: isMobile ? 34 : 42 }}>
            <div
              className="absolute inset-[3px] rounded-full flex items-center justify-center font-black text-white"
              style={{
                background: `linear-gradient(135deg, hsl(${hue} 70% 50%), hsl(${(hue + 40) % 360} 70% 32%))`,
                fontSize: isMobile ? 11 : 13,
              }}
            >
              {initials}
            </div>
            {isActionOn && (
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="16.5" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2.5" />
                <circle
                  cx="18"
                  cy="18"
                  r="16.5"
                  fill="none"
                  stroke={timerColor}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  pathLength={100}
                  strokeDasharray={`${timerPercent} 100`}
                  style={{ transition: "stroke-dasharray 0.1s linear, stroke 0.3s" }}
                />
              </svg>
            )}
          </div>

          <div className="flex flex-col overflow-hidden leading-tight">
            <span className={`font-semibold truncate ${isMobile ? "text-[10px]" : "text-xs"} ${isCurrentUser ? "text-gold-light" : "text-white/75"}`}>
              {isCurrentUser ? "You" : player.display_name}
            </span>
            <motion.span
              key={player.chips}
              initial={{ y: -4, opacity: 0.4 }}
              animate={{ y: 0, opacity: 1 }}
              className={`font-black tabular-nums text-white ${isMobile ? "text-xs" : "text-sm"}`}
            >
              {formatChips(player.chips)}
            </motion.span>
          </div>
        </motion.div>

        {(player.is_sitting_out || player.is_folded) && (
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] md:text-[10px] uppercase tracking-wider text-white/50 font-bold">
            {player.is_sitting_out ? "Waiting" : "Folded"}
          </div>
        )}

        {/* Dealer Button */}
        {isDealer && (
          <motion.div
            layoutId="dealer-button"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -right-2 -top-2 z-50 w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center pointer-events-none"
            style={{
              background: "radial-gradient(circle at 35% 30%, #ffffff, #d9d9d9)",
              boxShadow: "0 3px 8px rgba(0,0,0,0.6), inset 0 0 0 2px #c9c9c9",
            }}
          >
            <span className="text-[10px] md:text-xs font-black text-black">D</span>
          </motion.div>
        )}
      </div>

      {/* Current Bet Circle (PokerNow Style) */}
      <AnimatePresence>
        {player.current_bet > 0 && (
          <motion.div
            initial={{ scale: 0.4, opacity: 0, x: 0, y: 0 }}
            animate={{ 
              scale: 1, 
              opacity: 1,
              x: nx * (inwardOffset + (isMobile ? 34 : 58)),
              y: ny * (inwardOffset + (isMobile ? 34 : 58)),
            }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute z-20 flex items-center justify-center pointer-events-none"
          >
            <div className="flex items-center gap-1 rounded-full bg-black/45 border border-white/10 pl-0.5 pr-2 py-0.5 shadow-lg backdrop-blur-sm">
              <span className="chip rounded-full" style={{ width: isMobile ? 16 : 20, height: isMobile ? 16 : 20 }} />
              <span className={`font-black tabular-nums text-white ${isMobile ? "text-[11px]" : "text-sm"}`}>
                {formatChips(player.current_bet)}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
