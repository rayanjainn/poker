"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  User,
  Copy,
  Dices,
  ArrowRight,
  Plus,
  Play,
  Circle,
  Trophy,
  Users,
  Lock,
  Unlock,
  Loader2,
  Home,
  Coins,
  Link as LinkIcon,
  Check,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { TableInfo } from "@/lib/types";
import { api } from "@/lib/api";

export default function LobbyPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Create table form
  const [tableName, setTableName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [smallBlind, setSmallBlind] = useState(10);
  const [maxPlayers, setMaxPlayers] = useState(9);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/");
    }
  }, [user, isLoading, router]);

  const fetchTables = useCallback(async () => {
    try {
      const data = (await api.tables.list()) as TableInfo[];
      setTables(data);
    } catch (err) {
      console.log("Failed to fetch tables:", err);
      setTables([]);
    }
  }, []);

  useEffect(() => {
    fetchTables();
    const interval = setInterval(fetchTables, 8000);
    return () => clearInterval(interval);
  }, [fetchTables]);

  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const table = (await api.tables.create({
        name: tableName || `${user?.display_name}'s Table`,
        is_private: isPrivate,
        small_blind: smallBlind,
        big_blind: smallBlind * 2,
        min_buy_in: smallBlind * 20,
        max_buy_in: smallBlind * 1000,
        max_players: maxPlayers,
      })) as TableInfo;
      setIsCreateOpen(false);
      router.push(`/table/${table.id}`);
    } catch (err) {
      console.log("Failed to create table:", err);
    } finally {
      setIsCreating(false);
    }
  };

  const copyShareLink = (tableId: string) => {
    const link = `${window.location.origin}/table/${tableId}`;

    // Check if navigator.clipboard is available
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(link)
        .then(() => {
          setCopiedId(tableId);
          setTimeout(() => setCopiedId(null), 2000);
        })
        .catch(() => {
          fallbackCopy(link, tableId);
        });
    } else {
      fallbackCopy(link, tableId);
    }
  };

  const fallbackCopy = (text: string, tableId: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand("copy");
      setCopiedId(tableId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.log("Fallback copy failed:", err);
    }
    document.body.removeChild(textArea);
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 rounded-full border-2 border-gold border-t-transparent"
        />
      </div>
    );
  }

  // Only show public tables (private ones are link-only)
  const visibleTables = tables.filter((t) => !t.is_private);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b border-border/50"
        style={{
          background: "rgba(10, 10, 20, 0.85)",
          backdropFilter: "blur(16px)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black">
              <span className="text-gradient-gold">ACE</span>
              <span className="text-foreground ml-1">ARENA</span>
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarFallback
                  className="text-xs font-bold"
                  style={{
                    background: "linear-gradient(135deg, #2a2a4a, #1a1a3a)",
                    color: "#d4a843",
                  }}
                >
                  {user.display_name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden md:inline">
                {user.display_name}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 md:py-8">
        {/* Hero */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-6 md:mb-8"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-1">
                Welcome,{" "}
                <span className="text-gradient-gold">{user.display_name}</span>
              </h2>
              <p className="text-sm text-muted-foreground">
                Find a table or create your own. {visibleTables.length} public
                tables active.
              </p>
            </div>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger
                render={
                  <Button
                    className="font-bold uppercase tracking-wide text-sm h-11 flex items-center gap-2 group"
                    style={{
                      background: "linear-gradient(135deg, #d4a843, #a07c2a)",
                      color: "#1a1a2e",
                    }}
                  />
                }
              >
                <Plus className="w-4 h-4 transition-transform group-hover:scale-110" />
                <span>Create Room</span>
              </DialogTrigger>
              <DialogContent className="glass-card border-gold/10 sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-gradient-gold text-xl">
                    Create a Room
                  </DialogTitle>
                  <DialogDescription>
                    Set up your poker room and invite friends
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateTable} className="space-y-4 mt-2">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <Home className="w-3 h-3" />
                      Room Name
                    </Label>
                    <Input
                      value={tableName}
                      onChange={(e) => setTableName(e.target.value)}
                      placeholder={`${user.display_name}'s Room`}
                      className="bg-muted/30 border-border/50 h-10"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                        <Coins className="w-3 h-3" />
                        Small Blind
                      </Label>
                      <Input
                        type="number"
                        value={smallBlind}
                        onChange={(e) => setSmallBlind(Number(e.target.value))}
                        min={1}
                        className="bg-muted/30 border-border/50 h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                        <Trophy className="w-3 h-3" />
                        Big Blind
                      </Label>
                      <Input
                        type="number"
                        value={smallBlind * 2}
                        disabled
                        className="bg-muted/30 border-border/50 h-10 opacity-50"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <Users className="w-3 h-3" />
                      Max Players
                    </Label>
                    <Input
                      type="number"
                      value={maxPlayers}
                      onChange={(e) => setMaxPlayers(Number(e.target.value))}
                      min={2}
                      max={9}
                      className="bg-muted/30 border-border/50 h-10"
                    />
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/20 border border-border/30">
                    <input
                      type="checkbox"
                      id="private-table"
                      checked={isPrivate}
                      onChange={(e) => setIsPrivate(e.target.checked)}
                      className="w-4 h-4 accent-gold"
                    />
                    <Label
                      htmlFor="private-table"
                      className="text-sm cursor-pointer flex items-center gap-2"
                    >
                      {isPrivate ? (
                        <Lock className="w-3.5 h-3.5 text-gold" />
                      ) : (
                        <Unlock className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                      <div className="flex flex-col">
                        <span>Private room</span>
                        <span className="text-[10px] text-muted-foreground font-normal">
                          Invite link only, hidden from lobby
                        </span>
                      </div>
                    </Label>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateOpen(false)}
                      className="flex-1 border-border/50 h-11"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isCreating}
                      className="flex-1 font-bold h-11 group"
                      style={{
                        background: "linear-gradient(135deg, #d4a843, #a07c2a)",
                        color: "#1a1a2e",
                      }}
                    >
                      {isCreating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <div className="flex items-center gap-2">
                          <span>Create Room</span>
                          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </motion.div>

        {/* Tables grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          <AnimatePresence>
            {visibleTables.map((table, i) => (
              <motion.div
                key={table.id}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card
                  className="glass-card border-gold/5 hover:border-gold/20 hover:-translate-y-1 hover:shadow-[0_15px_40px_rgba(212,168,67,0.15)] transition-all duration-300 cursor-pointer group relative overflow-hidden"
                  onClick={() => router.push(`/table/${table.id}`)}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-bold group-hover:text-gold transition-colors truncate">
                        {table.name}
                      </CardTitle>
                      <Badge
                        className={`text-[9px] shrink-0 flex items-center ${
                          table.status === "playing"
                            ? "bg-green-500/20 text-green-400 border-green-500/30"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {table.status === "playing" ? (
                          <>
                            <Play className="w-2 h-2 fill-current mr-1" />
                            Live
                          </>
                        ) : (
                          <>
                            <Circle className="w-2 h-2 mr-1" />
                            Open
                          </>
                        )}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3 h-3 text-gold/60" />
                          <span>
                            Blinds:{" "}
                            <span className="text-foreground font-medium">
                              {table.small_blind}/{table.big_blind}
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Trophy className="w-3 h-3 text-gold/60" />
                          <span>
                            Buy-in:{" "}
                            <span className="text-foreground font-medium">
                              {table.min_buy_in.toLocaleString()} -{" "}
                              {table.max_buy_in.toLocaleString()}
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-center">
                        {/* Mini table: occupied seats lit around a felt oval */}
                        <div className="relative w-24 h-14">
                          <div className="rail absolute inset-[6px] rounded-full p-[3px]">
                            <div className="felt w-full h-full rounded-full" />
                          </div>
                          {Array.from({ length: table.max_players }).map((_, j) => {
                            const angle = Math.PI / 2 + (j / table.max_players) * Math.PI * 2;
                            const taken = j < table.current_players;
                            return (
                              <div
                                key={j}
                                className={`absolute w-2 h-2 rounded-full -translate-x-1/2 -translate-y-1/2 transition-transform group-hover:scale-125 ${
                                  taken
                                    ? "bg-gold shadow-[0_0_6px_rgba(232,185,35,0.8)]"
                                    : "bg-white/15 border border-white/10"
                                }`}
                                style={{
                                  left: `${50 + 47 * Math.cos(angle)}%`,
                                  top: `${50 + 44 * Math.sin(angle)}%`,
                                }}
                              />
                            );
                          })}
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                          {table.current_players}/{table.max_players} seated
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-border/30 flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/table/${table.id}`);
                        }}
                        className="flex-1 text-xs font-semibold text-gold hover:bg-gold/10 flex items-center justify-center gap-1.5"
                      >
                        <span>Join Table</span>
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyShareLink(table.id);
                        }}
                        className="text-xs text-muted-foreground hover:text-gold"
                      >
                        {copiedId === table.id ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <LinkIcon className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {visibleTables.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 md:py-20"
          >
            <div className="mb-4 flex justify-center">
              <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center border border-gold/20">
                <Dices className="w-8 h-8 text-gold-light" />
              </div>
            </div>
            <h3 className="text-xl font-bold mb-2">No tables yet</h3>
            <p className="text-muted-foreground mb-6 text-sm">
              Create a room and invite your friends!
            </p>
            <Button
              onClick={() => setIsCreateOpen(true)}
              style={{
                background: "linear-gradient(135deg, #d4a843, #a07c2a)",
                color: "#1a1a2e",
              }}
              className="font-bold flex items-center gap-2 mx-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Create Room</span>
            </Button>
          </motion.div>
        )}
      </main>
    </div>
  );
}
