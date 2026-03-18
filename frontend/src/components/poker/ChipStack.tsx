"use client";

import { motion } from "framer-motion";

interface ChipStackProps {
  amount: number;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  animate?: boolean;
}

const CHIP_COLORS = [
  { min: 0, color: "#e0e0e0", border: "#b0b0b0", label: "white" },
  { min: 5, color: "#e74c3c", border: "#c0392b", label: "red" },
  { min: 25, color: "#2ecc71", border: "#27ae60", label: "green" },
  { min: 100, color: "#3498db", border: "#2980b9", label: "blue" },
  { min: 500, color: "#9b59b6", border: "#8e44ad", label: "purple" },
  { min: 1000, color: "#f39c12", border: "#e67e22", label: "orange" },
  { min: 5000, color: "#d4a843", border: "#a07c2a", label: "gold" },
];

function getChipColor(amount: number) {
  let chip = CHIP_COLORS[0];
  for (const c of CHIP_COLORS) {
    if (amount >= c.min) chip = c;
  }
  return chip;
}

function formatChips(amount: number): string {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
  return amount.toLocaleString();
}

export function ChipStack({
  amount,
  size = "md",
  className = "",
  animate = true,
}: ChipStackProps) {
  const chip = getChipColor(amount);

  const sizeMap = {
    xs: { chip: 18, font: "text-[9px]", offset: -1.5 },
    sm: { chip: 24, font: "text-[10px]", offset: -2 },
    md: { chip: 32, font: "text-xs", offset: -3 },
    lg: { chip: 42, font: "text-sm", offset: -4 },
  };

  const s = sizeMap[size];

  // Determine stack height based on amount (1-5 chips)
  const stackHeight = Math.min(5, Math.max(1, Math.floor(Math.log10(amount || 1) / 1.5) + 1));

  const Wrapper = (animate ? motion.div : "div") as React.ElementType;
  const wrapperProps = animate
    ? {
        initial: { scale: 0, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        transition: { type: "spring" as const, stiffness: 300, damping: 20 },
      }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={`flex flex-col items-center gap-0.5 ${className}`}
    >
      {/* Chip stack visual */}
      <div 
        className="relative" 
        style={{ 
          width: s.chip, 
          height: s.chip + (stackHeight - 1) * Math.abs(s.offset) 
        }}
      >
        {Array.from({ length: stackHeight }).map((_, i) => (
          <div
            key={i}
            className="rounded-full flex items-center justify-center absolute left-0"
            style={{
              width: s.chip,
              height: s.chip,
              bottom: i * Math.abs(s.offset),
              background: `radial-gradient(circle at 35% 35%, ${chip.color}, ${chip.border})`,
              border: `1.5px solid ${chip.border}`,
              boxShadow: i === 0 
                ? "0 4px 8px rgba(0,0,0,0.5)" 
                : "0 1px 2px rgba(0,0,0,0.3)",
              zIndex: 10 - i,
            }}
          >
            {/* Dashes around chip */}
            <div className="absolute inset-0 rounded-full opacity-30" style={{
              background: `conic-gradient(
                from 0deg,
                transparent 15deg, white 15deg, white 20deg, transparent 20deg,
                transparent 35deg, white 35deg, white 40deg, transparent 40deg,
                transparent 55deg, white 55deg, white 60deg, transparent 60deg,
                transparent 75deg, white 75deg, white 80deg, transparent 80deg,
                transparent 95deg, white 95deg, white 100deg, transparent 100deg,
                transparent 115deg, white 115deg, white 120deg, transparent 120deg,
                transparent 135deg, white 135deg, white 140deg, transparent 140deg,
                transparent 155deg, white 155deg, white 160deg, transparent 160deg,
                transparent 175deg, white 175deg, white 180deg, transparent 180deg
              )`,
            }} />
            
            {/* Center circle */}
            <div
              className="rounded-full flex items-center justify-center z-10"
              style={{
                width: s.chip * 0.5,
                height: s.chip * 0.5,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            />
          </div>
        ))}
      </div>

      {/* Amount text */}
      <span className={`${s.font} font-black text-gold drop-shadow-md`}>
        {formatChips(amount)}
      </span>
    </Wrapper>
  );
}
