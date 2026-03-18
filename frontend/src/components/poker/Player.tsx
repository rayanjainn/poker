"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChipStack } from "./ChipStack";
import type { PlayerInfo, Card as CardType } from "@/lib/types";
import { PokerCard } from "./Card";

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

  const cardSize = isMobile ? "xs" : "sm";
  const myCardSize = isMobile ? "sm" : "md";

  // Calculate remaining time percentage
  const [timeLeftPercent, setTimeLeftPercent] = useState(100);

  useEffect(() => {
    if (!isActionOn || !turnExpiresAt) {
      setTimeLeftPercent(100);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = turnExpiresAt - now;
      const total = turnTimeoutSeconds * 1000;
      const percent = Math.max(0, (remaining / total) * 100);
      setTimeLeftPercent(percent);
    }, 100);

    return () => clearInterval(interval);
  }, [isActionOn, turnExpiresAt, turnTimeoutSeconds]);

  // Vector calculation to push cards towards center of table (50, 50)
  const cx = parseFloat(position.x);
  const cy = parseFloat(position.y);
  const dx = 50 - cx;
  const dy = 50 - cy;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;

  const inwardOffset = isMobile ? 55 : 85;
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

      {/* Main Info Card (PokerNow Style) */}
      <div className="relative group z-10">
        <div
          className={`relative rounded-lg flex flex-col justify-center transition-all duration-300 ${
            player.is_folded || player.is_sitting_out ? "opacity-50" : ""
          } ${isActionOn ? "bg-white text-black shadow-[0_0_30px_rgba(255,255,255,0.8)] z-30 scale-105" : "bg-[#1c1c1c]/90 text-white z-10"}`}
          style={{
            minWidth: isMobile ? 100 : 130,
            height: isMobile ? 45 : 55,
            padding: "4px 12px",
            border: isActionOn ? "none" : "1px solid rgba(255, 255, 255, 0.05)",
          }}
        >
          {/* Action Timer - Progress Bar at Bottom */}
          {isActionOn && (
            <div className="absolute bottom-0 left-0 h-1.5 bg-[#4caf50]/30 w-full z-20 rounded-b-lg overflow-hidden">
              <motion.div
                className="h-full bg-[#4caf50]"
                initial={{ width: "100%" }}
                animate={{ width: `${timeLeftPercent}%` }}
                transition={{ duration: 0.2, ease: "linear" }}
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            {!isActionOn && (
               <div className="w-6 h-6 flex items-center justify-center rounded bg-white/10 shrink-0">
                  <span className="text-[10px] uppercase font-bold text-white/50">{initials}</span>
               </div>
            )}
            <div className="flex flex-col overflow-hidden">
              <span className={`font-bold truncate ${isActionOn ? "text-sm text-black" : "text-xs text-white/90"}`}>
                {player.display_name}
              </span>
              <span className={`font-black ${isActionOn ? "text-lg text-black leading-tight" : "text-sm text-white"} truncate`}>
                {player.chips >= 1000 ? (player.chips/1000).toFixed(1) + 'k' : player.chips}
              </span>
            </div>
          </div>
        </div>

        {player.is_sitting_out && (
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] md:text-[10px] uppercase tracking-wider text-white/50 font-bold">
            Waiting
          </div>
        )}
        {player.is_folded && !player.is_sitting_out && (
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] md:text-[10px] uppercase tracking-wider text-white/50 font-bold">
            Folded
          </div>
        )}

        {/* Dealer Button (PokerNow Style) */}
        {isDealer && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -right-2 -bottom-2 z-50 w-6 h-6 md:w-7 md:h-7 bg-white rounded-full flex items-center justify-center border-2 border-[#141416] shadow-xl pointer-events-none"
          >
            <span className="text-[10px] md:text-xs font-black text-black">D</span>
          </motion.div>
        )}
      </div>

      {/* Current Bet Circle (PokerNow Style) */}
      <AnimatePresence>
        {player.current_bet > 0 && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ 
              scale: 1, 
              opacity: 1,
              x: nx * (inwardOffset - (isMobile ? 35 : 55)),
              y: ny * (inwardOffset - (isMobile ? 35 : 55)),
            }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute z-20 flex items-center justify-center pointer-events-none"
          >
            <div 
              className="flex items-center justify-center rounded-full font-black shadow-md border-2 border-[rgba(0,0,0,0.1)]"
              style={{
                backgroundColor: "#dced31", // Bright clear yellow/green
                color: "#111",
                minWidth: isMobile ? "32px" : "40px",
                height: isMobile ? "32px" : "40px",
                padding: "0 8px",
                fontSize: isMobile ? "11px" : "14px",
              }}
            >
              {player.current_bet >= 1000 ? (player.current_bet/1000).toFixed(1) + 'k' : player.current_bet}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
