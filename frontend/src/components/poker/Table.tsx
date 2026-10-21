"use client";

import { motion, AnimatePresence } from "framer-motion";
import { 
  Flame, 
  Gem, 
  Home, 
  Spade, 
  Ruler, 
  Target, 
  Users, 
  Play, 
  UserPlus, 
  Clock, 
  Dices,
  Sparkles
} from "lucide-react";
import { PokerCard } from "./Card";
import { PlayerSeat } from "./Player";
import { BettingControls } from "./BettingControls";
import { Button } from "@/components/ui/button";
import type { GameState, Card as CardType, HandResultInfo } from "@/lib/types";
import { useEffect, useState } from "react";

interface PokerTableProps {
  gameState: GameState;
  currentUserId: string;
  holeCards: CardType[];
  handResults: HandResultInfo[] | null;
  onAction: (action: string, amount?: number) => void;
  onStartGame: () => void;
  onJoinClick: () => void;
}

// Desktop seat positions (9 seats around oval)
const SEAT_POSITIONS_DESKTOP: { x: string; y: string }[] = [
  { x: "50%", y: "90%" }, // Seat 0 - Bottom center (current user)
  { x: "15%", y: "82%" }, // Seat 1 - Bottom left
  { x: "5%",  y: "50%" }, // Seat 2 - Left
  { x: "15%", y: "18%" }, // Seat 3 - Top left
  { x: "38%", y: "5%" },  // Seat 4 - Top left-center
  { x: "62%", y: "5%" },  // Seat 5 - Top right-center
  { x: "85%", y: "18%" }, // Seat 6 - Top right
  { x: "95%", y: "50%" }, // Seat 7 - Right
  { x: "85%", y: "82%" }, // Seat 8 - Bottom right
];

// Mobile seat positions (more compact)
const SEAT_POSITIONS_MOBILE: { x: string; y: string }[] = [
  { x: "50%", y: "95%" },
  { x: "12%", y: "85%" },
  { x: "2%",  y: "50%" },
  { x: "12%", y: "15%" },
  { x: "35%", y: "2%" },
  { x: "65%", y: "2%" },
  { x: "88%", y: "15%" },
  { x: "98%", y: "50%" },
  { x: "88%", y: "85%" },
];

const RANK_ORDER: Record<string, number> = {
  Two: 2, Three: 3, Four: 4, Five: 5, Six: 6, Seven: 7, Eight: 8,
  Nine: 9, Ten: 10, Jack: 11, Queen: 12, King: 13, Ace: 14,
};

// True if the ranks contain five consecutive values (ace plays low too)
function hasRun(ranks: number[]): boolean {
  const set = new Set(ranks);
  if (set.has(14)) set.add(1);
  const sorted = [...set].sort((a, b) => a - b);
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = sorted[i] === sorted[i - 1] + 1 ? run + 1 : 1;
    if (run >= 5) return true;
  }
  return false;
}

// Simple hand strength evaluator for helper display
function getHandStrength(holeCards: CardType[], communityCards: CardType[]): string | null {
  if (holeCards.length < 2) return null;
  
  const allCards = [...holeCards, ...communityCards];
  const ranks = allCards.map(c => RANK_ORDER[c.rank] || 0);
  const suits = allCards.map(c => c.suit);

  // Check for pairs, trips, etc.
  const rankCounts: Record<number, number> = {};
  for (const r of ranks) {
    rankCounts[r] = (rankCounts[r] || 0) + 1;
  }
  const counts = Object.values(rankCounts).sort((a, b) => b - a);
  
  // Check flush
  const suitCounts: Record<string, number> = {};
  for (const s of suits) {
    suitCounts[s] = (suitCounts[s] || 0) + 1;
  }
  const hasFlush = Object.values(suitCounts).some(c => c >= 5);
  
  // Check straight (simplified)
  const hasStraight = hasRun(ranks);

  if (hasFlush && hasStraight) {
    const flushSuit = Object.entries(suitCounts).find(([, c]) => c >= 5)?.[0];
    const suited = allCards.filter(c => c.suit === flushSuit).map(c => RANK_ORDER[c.rank] || 0);
    if (hasRun(suited)) return "Straight Flush";
  }
  if (counts[0] === 4) return "Four of a Kind";
  if (counts[0] === 3 && counts[1] >= 2) return "Full House";
  if (hasFlush) return "Flush";
  if (hasStraight) return "Straight";
  if (counts[0] === 3) return "Three of a Kind";
  if (counts[0] === 2 && counts[1] === 2) return "Two Pair";
  if (counts[0] === 2) return "Pair";
  
  // High card
  const highest = Math.max(...ranks);
  const highName: Record<number, string> = { 14: "Ace", 13: "King", 12: "Queen", 11: "Jack" };
  return `${highName[highest] || highest} High`;
}

// Icon helper for hand strength
function HandStrengthIcon({ rank }: { rank: string }) {
  const iconProps = { className: "w-3 h-3 text-gold" };
  
  if (rank.includes("Straight Flush")) return <Flame {...iconProps} className="w-3 h-3 text-red-500" />;
  if (rank.includes("Four of a Kind")) return <Gem {...iconProps} />;
  if (rank.includes("Full House")) return <Home {...iconProps} />;
  if (rank.includes("Flush")) return <Spade {...iconProps} />;
  if (rank.includes("Straight")) return <Ruler {...iconProps} />;
  if (rank.includes("Three of a Kind")) return <Target {...iconProps} />;
  if (rank.includes("Two Pair")) return <Users {...iconProps} />;
  if (rank.includes("Pair")) return <Users {...iconProps} />;
  return <Sparkles {...iconProps} />;
}

export function PokerTable({
  gameState,
  currentUserId,
  holeCards,
  onAction,
  onStartGame,
  onJoinClick,
  handResults,
}: PokerTableProps) {
  const currentPlayer = gameState.players.find((p) => p.id === currentUserId);
  const isActionOnMe = gameState.action_on === currentUserId;
  const isWaiting = gameState.status === "Waiting" || gameState.status === "BetweenHands";
  const canStart = gameState.players.length >= 2 && isWaiting;
  const isSeated = !!currentPlayer;

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const seatPositions = isMobile ? SEAT_POSITIONS_MOBILE : SEAT_POSITIONS_DESKTOP;
  const handStrength = currentPlayer?.current_hand_rank || getHandStrength(holeCards, gameState.community_cards);


  return (
    <div className="table-bg relative w-full h-full flex items-start justify-center px-2 pt-10 pb-2 md:p-12 overflow-hidden">
      <div className="relative w-full aspect-[4/5] md:aspect-[2/1] max-w-[1200px] mt-0 md:mt-[2vh]">
        {/* Table felt (PokerNow Style) */}
        <div className="absolute top-[5%] bottom-[5%] left-[5%] right-[5%] md:top-[5%] md:bottom-[5%] md:left-[10%] md:right-[10%] flex items-center justify-center">
          <div
            className="rail w-full h-full rounded-full relative"
            style={{ padding: isMobile ? 8 : 16 }}
          >
          <div className="felt w-full h-full rounded-full relative overflow-visible flex flex-col items-center justify-center">
            {/* Center Area (Community Cards & Pot) */}
            <div className="flex flex-col items-center justify-center gap-4 z-20">
              {/* Pot display */}
              <div className="flex flex-col items-center gap-1 h-8">
                <AnimatePresence>
                  {gameState.pot > 0 && (
                    <motion.div
                      key={gameState.pot}
                      initial={{ scale: 0.85, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 18 }}
                      className="flex items-center gap-2 bg-black/35 border border-white/10 pl-1.5 pr-4 py-1 rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_12px_rgba(0,0,0,0.3)] backdrop-blur-sm"
                    >
                      <span className="chip w-5 h-5 md:w-6 md:h-6 rounded-full" />
                      <span className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Pot</span>
                      <span className="text-white font-black text-lg md:text-xl tabular-nums">
                        {gameState.pot >= 1000 ? (gameState.pot/1000).toFixed(1) + 'k' : gameState.pot}
                      </span>
                      {gameState.current_bet > 0 && (
                        <span className="hidden md:inline text-white/70 font-semibold text-xs md:text-sm">
                          total {gameState.pot + gameState.players.reduce((acc, p) => acc + p.current_bet, 0)}
                        </span>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Community Cards */}
              <div className="flex gap-1.5 md:gap-2">
                {Array.from({ length: 5 }).map((_, i) => {
                  const card = gameState.community_cards[i];
                  return card ? (
                    <PokerCard
                      key={`${card.rank}-${card.suit}`}
                      card={card}
                      size={isMobile ? "sm" : "lg"}
                      delay={i < 3 ? i * 0.12 : 0}
                    />
                  ) : (
                    <div
                      key={`slot-${i}`}
                      className="rounded-lg border border-dashed border-white/15 bg-black/10"
                      style={isMobile ? { width: 44, height: 62 } : { width: 80, height: 112 }}
                    />
                  );
                })}
              </div>

              {/* Phase indicator */}
              <div className="h-8">
                {gameState.phase && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center"
                  >
                    <span
                      className="text-[9px] md:text-[10px] uppercase tracking-[0.3em] font-black px-4 py-1.5 rounded-full shadow-lg"
                      style={{
                        background: "linear-gradient(to right, rgba(197, 160, 89, 0.05), rgba(197, 160, 89, 0.2), rgba(197, 160, 89, 0.05))",
                        border: "1px solid rgba(197, 160, 89, 0.3)",
                        color: "#c5a059",
                      }}
                    >
                      {gameState.phase}
                    </span>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* Player seats & Empty seats */}
        <div className="absolute inset-0">
          {seatPositions.map((pos, seatIndex) => {
            const player = gameState.players.find((p) => p.seat === seatIndex);
            
            if (player) {
              const result = handResults?.find((r) => r.player_id === player.id);
              return (
                <div key={player.id} className="pointer-events-none">
                  <PlayerSeat
                    player={player}
                    isCurrentUser={player.id === currentUserId}
                    isActionOn={gameState.action_on === player.id}
                    isDealer={gameState.dealer_seat === player.seat}
                    holeCards={player.id === currentUserId ? holeCards : undefined}
                    revealCards={result?.cards}
                    position={pos}
                    isMobile={isMobile}
                    turnExpiresAt={gameState.turn_expires_at}
                    turnTimeoutSeconds={gameState.turn_timeout_seconds}
                  />
                </div>
              );
            } else {
              // Empty Seat SIT Placeholder
              return (
                <div
                  key={`empty-seat-${seatIndex}`}
                  className="absolute z-10"
                  style={{
                    left: pos.x,
                    top: pos.y,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <button
                    onClick={() => onJoinClick?.()}
                    disabled={isSeated}
                    className="group"
                  >
                    <div className={`w-12 h-12 md:w-14 md:h-14 rounded-full border-2 border-dashed flex flex-col items-center justify-center transition-all duration-200 ${isSeated ? "border-white/5 bg-black/20 opacity-40" : "border-white/25 bg-black/40 group-hover:border-gold/70 group-hover:bg-gold/10 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(232,185,35,0.35)]"}`}>
                       <UserPlus className={`w-4 h-4 ${isSeated ? "text-white/15" : "text-white/50 group-hover:text-gold"} transition-colors`} />
                       {!isSeated && (
                         <span className="text-[8px] font-black text-white/30 uppercase tracking-widest leading-none mt-0.5 group-hover:text-gold transition-colors">
                          Sit
                         </span>
                       )}
                    </div>
                  </button>
                </div>
              );
            }
          })}
        </div>

        {/* Hand strength helper for current player */}
        {isSeated && handStrength && holeCards.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed bottom-6 left-6 z-40"
          >
            <div
              className="px-3 py-2 rounded-xl text-xs font-bold"
              style={{
                background: "rgba(10, 10, 25, 0.9)",
                border: "1px solid rgba(212, 168, 67, 0.2)",
                backdropFilter: "blur(12px)",
                color: "#f0d78c",
              }}
            >
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider block mb-0.5">
                Your Hand
              </span>
              <div className="flex items-center gap-1.5">
                <HandStrengthIcon rank={handStrength} />
                <span>{handStrength}</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Betting controls or meta-controls (fixed bottom-right) */}
        {isSeated && isActionOnMe ? (
          <BettingControls
            currentBet={gameState.current_bet}
            playerChips={currentPlayer.chips}
            playerCurrentBet={currentPlayer.current_bet}
            bigBlind={gameState.big_blind}
            pot={gameState.pot}
            isActionOn={isActionOnMe}
            onAction={onAction}
          />
        ) : (
          isWaiting && (
            <motion.div
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 w-full max-w-[260px] md:max-w-[280px]"
            >
              <div
                className="px-5 py-5 rounded-2xl border border-white/10 text-center"
                style={{
                  background: "rgba(10, 10, 25, 0.95)",
                  backdropFilter: "blur(24px)",
                  boxShadow: "0 15px 40px rgba(0, 0, 0, 0.5)",
                }}
              >
                {!isSeated ? (
                  <Button
                    onClick={onJoinClick}
                    className="w-full h-11 font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 group"
                    style={{
                      background: "linear-gradient(135deg, #d4a843, #a07c2a)",
                      color: "#1a1a2e",
                    }}
                  >
                    <UserPlus className="w-4 h-4 transition-transform group-hover:scale-110" />
                    Join Table
                  </Button>
                ) : (
                  <div className="space-y-2.5">
                    <Button
                      disabled={!canStart}
                      onClick={onStartGame}
                      className="w-full h-11 font-black uppercase tracking-widest text-sm transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                      style={{
                        background: canStart
                          ? "linear-gradient(135deg, #d4a843, #a07c2a)"
                          : "rgba(255,255,255,0.05)",
                        color: canStart ? "#1a1a2e" : "rgba(255,255,255,0.2)",
                      }}
                    >
                      {canStart ? (
                         <Play className="w-4 h-4 fill-current" />
                      ) : (
                         <Clock className="w-4 h-4" />
                      )}
                      {gameState.status === "BetweenHands"
                        ? "Next Hand"
                        : "Start Game"}
                    </Button>
                    {!canStart && (
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest flex items-center justify-center gap-2">
                        <Clock className="w-3 h-3 animate-pulse" />
                        <span>Waiting for players</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )
        )}

        {/* Hand number */}
        {gameState.hand_number && (
          <div className="absolute top-2 right-4 text-[9px] text-muted-foreground bg-black/40 px-2.5 py-1 rounded-full backdrop-blur-sm flex items-center gap-1.5 border border-white/5">
            <Dices className="w-2.5 h-2.5 text-gold-light" />
            <span>Hand #{gameState.hand_number}</span>
          </div>
        )}
      </div>
    </div>
  );
}
