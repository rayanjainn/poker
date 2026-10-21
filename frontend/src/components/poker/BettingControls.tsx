"use client";

import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Ban, 
  Circle, 
  Coins, 
  TrendingUp, 
  Zap,
  ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface BettingControlsProps {
  currentBet: number;
  playerChips: number;
  playerCurrentBet: number;
  bigBlind: number;
  pot: number;
  isActionOn: boolean;
  onAction: (action: string, amount?: number) => void;
}

export function BettingControls({
  currentBet,
  playerChips,
  playerCurrentBet,
  bigBlind,
  pot,
  isActionOn,
  onAction,
}: BettingControlsProps) {
  const toCall = Math.max(0, currentBet - playerCurrentBet);
  // Raise-to is capped by the stack; if a full min-raise is unaffordable the slider collapses to all-in
  const maxRaiseTo = playerChips + playerCurrentBet;
  const minRaise = Math.min(currentBet + bigBlind, maxRaiseTo);
  const [raiseAmount, setRaiseAmount] = useState(minRaise);
  const clamp = useCallback(
    (v: number) => Math.max(minRaise, Math.min(maxRaiseTo, Math.round(v))),
    [minRaise, maxRaiseTo]
  );

  const canCheck = toCall === 0;
  const canCall = toCall > 0 && playerChips > 0;
  const canRaise = playerChips > toCall;
  const raiseIsAllIn = raiseAmount >= maxRaiseTo;

  const handleRaise = useCallback(() => {
    const to = clamp(raiseAmount);
    if (to >= maxRaiseTo) onAction("all_in");
    else onAction("raise", to - playerCurrentBet);
  }, [onAction, raiseAmount, playerCurrentBet, clamp, maxRaiseTo]);

  // Pot-sized presets: raise to (current bet + fraction of the pot after calling)
  const potAfterCall = pot + toCall;
  const presets = [
    { label: "Min", value: minRaise },
    { label: "½ Pot", value: currentBet + potAfterCall / 2 },
    { label: "¾ Pot", value: currentBet + (potAfterCall * 3) / 4 },
    { label: "Pot", value: currentBet + potAfterCall },
  ].map((p) => ({ ...p, value: clamp(p.value) }));

  // Keyboard shortcuts: F fold, C check/call, R raise, A all-in
  useEffect(() => {
    if (!isActionOn) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "f") onAction("fold");
      else if (k === "c" || k === "k") {
        if (canCheck) onAction("check");
        else if (canCall) onAction("call");
      } else if (k === "r" && canRaise) handleRaise();
      else if (k === "a") onAction("all_in");
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isActionOn, onAction, canCheck, canCall, canRaise, handleRaise]);

  if (!isActionOn) return null;

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="fixed bottom-0 left-0 right-0 md:bottom-6 md:right-6 md:left-auto z-50 w-full md:w-[320px] px-2 pb-2 md:p-0"
    >
      <div
        className="px-4 py-4 md:py-5 rounded-3xl md:rounded-2xl border border-white/10"
        style={{
          background: "rgba(10, 10, 20, 0.95)",
          backdropFilter: "blur(32px)",
          WebkitBackdropFilter: "blur(32px)",
          boxShadow: "0 -4px 30px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.05)",
        }}
      >
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-black uppercase tracking-[0.2em] text-gold">Your turn</span>
          <span className="hidden md:inline text-[9px] text-white/35 font-semibold tracking-wider">F · C · R · A</span>
        </div>

        {/* Raise slider */}
        {canRaise && (
          <div className="mb-3 px-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1">
                <ChevronUp className="w-2.5 h-2.5" />
                Raise to
              </span>
              <div className="flex items-center gap-2 bg-black/40 px-2 py-1 rounded-lg border border-[#c5a05933]">
                <span className="text-[10px] text-white/40 font-bold">$</span>
                <input
                  type="number"
                  value={raiseAmount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val)) setRaiseAmount(val);
                  }}
                  onBlur={() => setRaiseAmount((v) => clamp(v))}
                  className="bg-transparent border-none p-0 text-sm font-black text-gold focus:ring-0 w-20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>
            <Slider
              value={[raiseAmount]}
              min={minRaise}
              max={maxRaiseTo}
              step={bigBlind}
              onValueChange={(v) =>
                setRaiseAmount(Array.isArray(v) ? v[0] : (v as number))
              }
              className="mb-2"
            />

            {/* Quick bet presets */}
            <div className="flex gap-1.5">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => setRaiseAmount(preset.value)}
                  className={`flex-1 px-1 py-1.5 text-[10px] font-bold rounded-lg transition-all hover:-translate-y-0.5 active:translate-y-0 ${
                    raiseAmount === preset.value
                      ? "bg-gold text-black border border-gold shadow-[0_0_12px_rgba(232,185,35,0.45)]"
                      : "bg-gold/10 text-gold border border-gold/25 hover:bg-gold/20"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons — 2 rows */}
        <div className="flex flex-col gap-2">
          {/* Row 1: Fold + Check/Call */}
          <div className="flex gap-2">
            <Button
              onClick={() => onAction("fold")}
              className="flex-1 h-12 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 active:scale-[0.97] flex items-center justify-center gap-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_4px_12px_rgba(0,0,0,0.35)]"
              style={{
                background: "#c0392b",
                border: "1px solid #e74c3c",
                color: "#ffffff",
                boxShadow: "0 3px 10px rgba(192, 57, 43, 0.3)",
              }}
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Fold</span>
            </Button>

            {canCheck ? (
              <Button
                onClick={() => onAction("check")}
                className="flex-1 h-12 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 active:scale-[0.97] flex items-center justify-center gap-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_4px_12px_rgba(0,0,0,0.35)]"
                style={{
                  background: "linear-gradient(135deg, #2d6b3f, #27ae60)",
                  border: "1px solid rgba(39, 174, 96, 0.5)",
                  color: "#fff",
                }}
              >
                <Circle className="w-3.5 h-3.5" />
                <span>Check</span>
              </Button>
            ) : canCall ? (
              <Button
                onClick={() => onAction("call")}
                className="flex-1 h-12 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 active:scale-[0.97] flex items-center justify-center gap-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_4px_12px_rgba(0,0,0,0.35)]"
                style={{
                  background: "linear-gradient(135deg, #2d6b3f, #27ae60)",
                  border: "1px solid rgba(39, 174, 96, 0.5)",
                  color: "#fff",
                }}
              >
                <Coins className="w-3.5 h-3.5" />
                <span>Call {toCall.toLocaleString()}</span>
              </Button>
            ) : null}
          </div>

          {/* Row 2: Raise + All-in */}
          <div className="flex gap-2">
            {canRaise && (
              <Button
                onClick={handleRaise}
                className="flex-1 h-12 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 active:scale-[0.97] flex items-center justify-center gap-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_4px_12px_rgba(0,0,0,0.35)]"
                style={{
                  background: "linear-gradient(135deg, #a07c2a, #d4a843)",
                  border: "1px solid rgba(212, 168, 67, 0.5)",
                  color: "#1a1a2e",
                }}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span className="tabular-nums">{raiseIsAllIn ? "All In" : `Raise ${clamp(raiseAmount).toLocaleString()}`}</span>
              </Button>
            )}

            <Button
              onClick={() => onAction("all_in")}
              className="flex-1 h-12 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 active:scale-[0.97] flex items-center justify-center gap-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_4px_12px_rgba(0,0,0,0.35)]"
              style={{
                background: "linear-gradient(135deg, #8e44ad, #9b59b6)",
                border: "1px solid rgba(155, 89, 182, 0.5)",
                color: "#fff",
              }}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>All In</span>
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
