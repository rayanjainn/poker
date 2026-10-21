"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Link as LinkIcon,
  Check,
  MessageCircle,
  Trophy,
  UserPlus,
  LogOut,
  ArrowRight,
  LayoutDashboard,
  User,
  X,
  AlertCircle,
  ChevronLeft,
  Coins,
  Loader2,
} from "lucide-react";
import { PokerTable } from "@/components/poker/Table";
import { PokerCard } from "@/components/poker/Card";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import type {
  GameState,
  Card as CardType,
  ServerMessage,
  HandResultInfo,
} from "@/lib/types";

interface ChatMessage {
  player_id: string;
  display_name: string;
  message: string;
  timestamp: number;
}

interface JoinRequest {
  table_id: string;
  player_id: string;
  display_name: string;
  buy_in: number;
}

export default function TablePage() {
  const router = useRouter();
  const params = useParams();
  const tableId = params.id as string;
  const { user, isLoading: authLoading, logout } = useAuth();

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [holeCards, setHoleCards] = useState<CardType[]>([]);
  const [handResults, setHandResults] = useState<HandResultInfo[] | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [joinDisplayName, setJoinDisplayName] = useState("");
  const [joinBuyIn, setJoinBuyIn] = useState(1000);
  const [showShareLink, setShowShareLink] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isSeatTaken = useCallback(
    (id: string) => {
      return gameState?.players.some((p) => p.id.toLowerCase() === id.toLowerCase());
    },
    [gameState],
  );

  const isSeated = user ? isSeatTaken(user.id) : false;
  const isAdmin =
    user && gameState && gameState.creator_id.toLowerCase() === user.id.toLowerCase();

  const handleMessage = useCallback(
    (msg: ServerMessage) => {
      switch (msg.type) {
        case "game_state":
          const state = msg as unknown as GameState;
          setGameState(state);
          if (state.status === "Playing" || state.status === "Waiting") {
            setHandResults(null);
          }
          // Sync join requests from server
          if (state.pending_joins) {
            setJoinRequests(
              state.pending_joins.map((rj: any) => ({
                ...rj,
                table_id: state.table_id,
              })),
            );
          }
          break;
        case "cards_dealt":
          console.log("Cards dealt received:", msg);
          if (
            "cards" in msg &&
            "player_id" in msg &&
            user &&
            msg.player_id === user.id
          ) {
            setHoleCards(msg.cards);
            setHandResults(null); // Clear previous results when new cards arrive
            localStorage.setItem(
              `hole_cards_${tableId}`,
              JSON.stringify(msg.cards),
            );
          }
          break;
        case "community_cards":
          break;
        case "hand_result":
          if ("results" in msg) {
            setHandResults(msg.results);
            // Clear results and old cards after a delay
            setTimeout(() => {
              // Only clear if status is still BetweenHands – this prevents clearing new cards
              // for the next hand if it already started.
              setHandResults(null);
            }, 8000);
          }
          break;
        case "player_action":
          break;
        case "player_joined":
        case "player_left":
          break;
        case "chat":
          if ("display_name" in msg && "message" in msg) {
            setChatMessages((prev) => [
              ...prev.slice(-50),
              {
                player_id: msg.player_id,
                display_name: msg.display_name,
                message: msg.message,
                timestamp: Date.now(),
              },
            ]);
          }
          break;
        case "error":
          if ("message" in msg) {
            console.log("Game error:", msg.message);
            setLastError(msg.message);
            setHasRequestedJoin(false);
            setTimeout(() => setLastError(null), 5000);

            if (msg.message.toLowerCase().includes("user not found")) {
              logout();
              router.push("/");
            }
            setHasRequestedJoin(false);
          }
          break;
        case "join_requested":
          console.log("Join requested message received:", msg);
          if (
            "table_id" in msg &&
            "player_id" in msg &&
            "buy_in" in msg &&
            "display_name" in msg
          ) {
            const req = {
              table_id: msg.table_id as string,
              player_id: msg.player_id as string,
              display_name: msg.display_name as string,
              buy_in: msg.buy_in as number,
            };
            setJoinRequests((prev) => {
              if (prev.some((r) => r.player_id === req.player_id)) return prev;
              return [...prev, req];
            });
          }
          break;
      }
    },
    [tableId, logout, router, user],
  );

  const { isConnected, connect, send, disconnect } = useWebSocket({
    onMessage: handleMessage,
    onConnect: () => console.log("WebSocket connected"),
    onDisconnect: () => console.log("WebSocket disconnected"),
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && !isConnected) {
      connect();
    }
  }, [user, isConnected, connect]);

  useEffect(() => {
    if (isConnected && user) {
      send({ type: "observe_table", table_id: tableId });
    }
  }, [isConnected, user, tableId, send]);

  // Load hole cards from localStorage on mount
  useEffect(() => {
    if (tableId && typeof window !== "undefined") {
      const saved = localStorage.getItem(`hole_cards_${tableId}`);
      if (saved) {
        try {
          setHoleCards(JSON.parse(saved));
        } catch {
          localStorage.removeItem(`hole_cards_${tableId}`);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  // Auto-open join dialog if not seated (only once on initial load)
  const hasAutoOpenedRef = useRef(false);
  useEffect(() => {
    if (isConnected && gameState && user && !isSeated && !hasAutoOpenedRef.current) {
      setIsJoinDialogOpen(true);
      hasAutoOpenedRef.current = true;
    }
  }, [isConnected, gameState, user, isSeated]);

  // Debug IDs for admin join hub
  useEffect(() => {
    if (gameState && user) {
      console.log("[JoinHub DEBUG] User ID:", user.id);
      console.log("[JoinHub DEBUG] Table Creator ID:", gameState.creator_id);
      console.log(
        "[JoinHub DEBUG] Match:",
        gameState.creator_id.toLowerCase() === user.id.toLowerCase(),
      );
    }
  }, [gameState, user, tableId]);

  // Auto-close join dialog if seated
  useEffect(() => {
    if (isSeated) {
      setIsJoinDialogOpen(false);
      setHasRequestedJoin(false);
    }
  }, [isSeated]);

  // Set default display name from user once
  const initializedName = useRef(false);
  useEffect(() => {
    if (user && !initializedName.current) {
      setJoinDisplayName(user.display_name);
      initializedName.current = true;
    }
  }, [user]);

  // Empty fallback state
  useEffect(() => {
    if (!isConnected && user && !gameState) {
      setGameState({
        table_id: tableId,
        status: "Waiting",
        phase: null,
        community_cards: [],
        pot: 0,
        current_bet: 0,
        action_on: null,
        dealer_seat: null,
        players: [],
        small_blind: 0,
        big_blind: 0,
        creator_id: "",
        turn_timeout_seconds: 30,
        pending_joins: [],
        hand_number: null,
        server_seed_hash: null,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, user, tableId, gameState]);

  // Auto-start next hand when status is BetweenHands
  useEffect(() => {
    if (
      gameState?.status === "BetweenHands" &&
      isSeated &&
      gameState.players.length >= 2
    ) {
      const timer = setTimeout(() => {
        send({ type: "start_game", table_id: tableId });
      }, 4000); // 4 second delay between hands
      return () => clearTimeout(timer);
    }
  }, [gameState?.status, isSeated, gameState?.players.length, send, tableId]);

  const [hasRequestedJoin, setHasRequestedJoin] = useState(false);

  const handleJoinTable = useCallback(() => {
    console.log(
      "[JOIN_DEBUG] Sending join_request for table",
      tableId,
      "with buy-in",
      joinBuyIn,
    );
    send({
      type: "join_request",
      table_id: tableId,
      buy_in: joinBuyIn,
      display_name: joinDisplayName,
    });
    setHasRequestedJoin(true);
  }, [send, tableId, joinBuyIn, joinDisplayName]);

  useEffect(() => {
    console.log("[JOIN_DEBUG] joinRequests state updated:", joinRequests);
  }, [joinRequests]);

  useEffect(() => {
    if (gameState) {
      console.log(
        "[JOIN_DEBUG] GameState updated. Pending joins in state:",
        gameState.pending_joins,
      );
    }
  }, [gameState]);

  const handleLeaveTable = useCallback(() => {
    send({ type: "leave_table", table_id: tableId });
    router.push("/lobby");
  }, [send, tableId, router]);

  const handleAction = useCallback(
    (action: string, amount?: number) => {
      send({ type: "action", table_id: tableId, action, amount });
    },
    [send, tableId],
  );

  const handleStartGame = useCallback(() => {
    send({ type: "start_game", table_id: tableId });
  }, [send, tableId]);

  const handleSendChat = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (chatInput.trim()) {
        send({ type: "chat", table_id: tableId, message: chatInput.trim() });
        setChatInput("");
      }
    },
    [send, tableId, chatInput],
  );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const copyShareLink = useCallback(() => {
    const link = `${window.location.origin}/table/${tableId}`;

    // Check if navigator.clipboard is available (only in secure contexts)
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(link)
        .then(() => {
          setShowShareLink(true);
          setTimeout(() => setShowShareLink(false), 2000);
        })
        .catch(() => {
          // Fallback if clipboard API fails
          fallbackCopy(link);
        });
    } else {
      fallbackCopy(link);
    }
  }, [tableId]);

  const fallbackCopy = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;

    // Ensure it's not visible
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    document.body.appendChild(textArea);

    textArea.focus();
    textArea.select();

    try {
      document.execCommand("copy");
      setShowShareLink(true);
      setTimeout(() => setShowShareLink(false), 2000);
    } catch (err) {
      console.log("Fallback copy failed:", err);
    }

    document.body.removeChild(textArea);
  };

  if (authLoading || !user) {
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

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#050510] selection:bg-gold/30">
      {/* Top bar */}
      <header
        className="h-14 md:h-16 flex items-center justify-between px-4 md:px-8 border-b border-white/5 shrink-0 z-50 relative"
        style={{
          background: "rgba(10, 10, 25, 0.8)",
          backdropFilter: "blur(24px)",
          boxShadow: "0 4px 30px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLeaveTable}
            className="text-[#c5a059] hover:text-white transition-all text-xs flex items-center gap-2 group px-4 rounded-xl border border-transparent hover:border-[#c5a05933]"
          >
            <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span className="font-bold uppercase tracking-widest text-[10px]">
              Lobby
            </span>
          </Button>
          {gameState?.hand_number && (
            <div className="px-3 py-1 rounded-full border border-[#c5a05933] bg-[#c5a0590a] hidden sm:flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#c5a059] animate-pulse" />
              <span className="text-[10px] text-[#c5a059] font-black uppercase tracking-wider">
                Hand #{gameState.hand_number}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 border border-white/5">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background: isConnected ? "#2ecc71" : "#e74c3c",
                boxShadow: isConnected
                  ? "0 0 10px rgba(46,204,113,0.4)"
                  : "0 0 10px rgba(231,76,60,0.4)",
              }}
            />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/50">
              {isConnected ? "Server: Online" : "Disconnected"}
            </span>
          </div>

          {gameState && (
            <div className="hidden lg:flex items-center gap-4 text-[10px] text-white/40 uppercase font-black tracking-[0.2em] bg-white/5 px-4 py-1.5 rounded-xl border border-white/5">
              <span>SB: ${gameState.small_blind}</span>
              <div className="w-1 h-1 rounded-full bg-white/20" />
              <span>BB: ${gameState.big_blind}</span>
            </div>
          )}

          {/* Share button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={copyShareLink}
            className={`text-[10px] font-black uppercase tracking-widest transition-all px-4 rounded-xl border ${
              showShareLink
                ? "text-green-500 border-green-500/20 bg-green-500/5"
                : "text-[#c5a059] border-[#c5a05944] hover:border-[#c5a059] hover:bg-[#c5a0590a]"
            }`}
          >
            {showShareLink ? (
              <>
                <Check className="w-3.5 h-3.5 mr-2" />
                <span className="hidden md:inline">Copied!</span>
              </>
            ) : (
              <>
                <LinkIcon className="w-3.5 h-3.5 mr-2" />
                <span className="hidden md:inline">Share Link</span>
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowChat(!showChat)}
            className={`w-10 h-10 rounded-xl transition-all ${
              showChat
                ? "bg-[#c5a05922] text-[#c5a059] border border-[#c5a05944]"
                : "bg-white/5 text-white/40 border border-transparent hover:border-white/10"
            }`}
          >
            <MessageCircle className="w-5 h-5" />
          </Button>

          <Button
            onClick={handleLeaveTable}
            className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 px-4 h-10 rounded-xl transition-all hidden sm:flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">
              Quit
            </span>
          </Button>
        </div>
      </header>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Game area */}
        <div className="flex-1 relative bg-[radial-gradient(circle_at_center,_#101025_0%,_#050510_100%)]">
          {gameState && user ? (
            <PokerTable
              gameState={gameState}
              currentUserId={user.id}
              holeCards={holeCards}
              handResults={handResults}
              onAction={handleAction}
              onStartGame={handleStartGame}
              onJoinClick={() => setIsJoinDialogOpen(true)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 rounded-full border-4 border-[#c5a059] border-t-transparent shadow-[0_0_20px_rgba(197,160,89,0.3)]"
              />
              <span className="text-xs font-black uppercase tracking-[0.3em] text-[#c5a059] animate-pulse">
                Entering Casino...
              </span>
            </div>
          )}

          {/* Winner Overlay - More spectacular */}

          {/* Join Table Dialog */}
          <AnimatePresence>
            {isJoinDialogOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-[150] flex items-center justify-center bg-[#050510aa] backdrop-blur-md p-4"
              >
                <motion.div
                  initial={{ scale: 0.9, y: 30 }}
                  animate={{ scale: 1, y: 0 }}
                  className="w-full max-w-sm rounded-[32px] border border-white/10 p-8 shadow-[0_20px_80px_rgba(0,0,0,0.8)]"
                  style={{
                    background:
                      "linear-gradient(145deg, #121225 0%, #080815 100%)",
                  }}
                >
                  <div className="flex flex-col items-center text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-[#c5a05915] flex items-center justify-center border border-[#c5a05933] mb-4">
                      <UserPlus className="w-8 h-8 text-[#c5a059]" />
                    </div>
                    <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-1">
                      Join Table
                    </h3>
                    <p className="text-[10px] text-white/40 uppercase font-black tracking-[0.2em]">
                      Secure your seat at the high stakes
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] text-white/40 uppercase font-black tracking-widest pl-1">
                        Display Name
                      </Label>
                      <Input
                        value={joinDisplayName}
                        onChange={(e) => setJoinDisplayName(e.target.value)}
                        placeholder="ENTER NAME"
                        className="bg-white/5 border-white/10 h-14 rounded-xl px-5 text-base font-bold focus:border-[#c5a059] focus:ring-0 transition-all placeholder:text-white/10"
                        maxLength={20}
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-end pl-1">
                        <Label className="text-[10px] text-white/40 uppercase font-black tracking-widest">
                          Initial Buy-in
                        </Label>
                        <span className="text-2xl font-black text-[#c5a059]">
                          ${joinBuyIn.toLocaleString()}
                        </span>
                      </div>
                      <Input
                        type="number"
                        value={joinBuyIn}
                        onChange={(e) => setJoinBuyIn(Number(e.target.value))}
                        className="bg-white/5 border-white/10 h-14 rounded-xl px-5 text-base font-bold focus:border-[#c5a059] focus:ring-0 transition-all"
                      />
                      <div className="grid grid-cols-4 gap-2">
                        {[1000, 5000, 25000, 100000].map((amt) => (
                          <button
                            key={amt}
                            onClick={() => setJoinBuyIn(amt)}
                            className={`py-2 rounded-xl text-[10px] font-black transition-all border ${
                              joinBuyIn === amt
                                ? "bg-[#c5a059] text-black border-[#c5a059]"
                                : "bg-white/5 text-white/40 border-white/5 hover:border-white/20"
                            }`}
                          >
                            ${amt.toLocaleString()}
                          </button>
                        ))}
                      </div>
                    </div>

                    {hasRequestedJoin ? (
                      <div className="p-8 bg-[#c5a0590a] border border-[#c5a05933] rounded-3xl text-center space-y-3">
                        <Loader2 className="w-10 h-10 animate-spin text-[#c5a059] mx-auto" />
                        <div>
                          <p className="text-lg font-black text-white uppercase tracking-tight">
                            {isAdmin ? "Joining Table" : "Request Pending"}
                          </p>
                          <p className="text-[10px] text-white/40 uppercase font-black tracking-widest mt-1">
                            {isAdmin
                              ? "Finalizing seat..."
                              : "Waiting for approval..."}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 pt-2">
                        <Button
                          onClick={handleJoinTable}
                          disabled={!joinDisplayName.trim()}
                          className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-sm shadow-[0_10px_20px_rgba(197,160,89,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all"
                          style={{
                            background:
                              "linear-gradient(135deg, #c5a059, #a07c2a)",
                            color: "#050510",
                          }}
                        >
                          {isAdmin ? "Take Seat" : "Request A Seat"}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setIsJoinDialogOpen(false)}
                          className="w-full h-12 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-white/30 hover:text-white"
                        >
                          Specator Mode
                        </Button>
                      </div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Admin Join Requests Hub */}
          <AnimatePresence>
            {gameState &&
              user &&
              gameState.creator_id.toLowerCase() === user.id.toLowerCase() &&
              joinRequests.length > 0 && (
                <motion.div
                  key="join-requests-panel"
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  className="absolute top-16 left-2 right-2 md:right-auto md:top-24 md:left-8 z-[120] md:w-80 max-h-[60vh] overflow-hidden flex flex-col rounded-[24px] md:rounded-[32px] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
                  style={{
                    background: "rgba(10, 10, 25, 0.9)",
                    backdropFilter: "blur(40px)",
                  }}
                >
                  <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                      </div>
                      <h4 className="text-sm font-black text-white uppercase tracking-widest">
                        New Requests
                      </h4>
                    </div>
                    <Badge className="bg-[#c5a059] text-black font-black border-none px-2 rounded-lg">
                      {joinRequests.length}
                    </Badge>
                  </div>

                  <div className="p-3 overflow-y-auto space-y-2">
                    {joinRequests.map((req, i) => (
                      <motion.div
                        key={`${req.player_id}-${i}`}
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white/5 border border-white/5 p-4 rounded-2xl flex flex-col gap-3 group transition-all hover:bg-white/[0.08]"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm font-black text-white uppercase tracking-tight">
                              {req.display_name}
                            </p>
                            <p className="text-[10px] text-[#c5a059] font-black uppercase tracking-widest mt-0.5">
                              Buy-in:{" "}
                              <span className="text-white">
                                ${req.buy_in.toLocaleString()}
                              </span>
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1 h-9 text-[10px] uppercase font-black text-red-400 hover:text-red-500 hover:bg-red-400/10 rounded-xl"
                            onClick={() => {
                              setJoinRequests((prev) =>
                                prev.filter(
                                  (r) => r.player_id !== req.player_id,
                                ),
                              );
                              send({
                                type: "join_respond",
                                table_id: tableId,
                                player_id: req.player_id,
                                accepted: false,
                                buy_in: req.buy_in,
                              });
                            }}
                          >
                            Decline
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 h-9 text-[10px] uppercase font-black bg-[#c5a059] text-black hover:bg-white rounded-xl transition-all"
                            onClick={() => {
                              setJoinRequests((prev) =>
                                prev.filter(
                                  (r) => r.player_id !== req.player_id,
                                ),
                              );
                              send({
                                type: "join_respond",
                                table_id: tableId,
                                player_id: req.player_id,
                                accepted: true,
                                buy_in: req.buy_in,
                              });
                            }}
                          >
                            Approve
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
          </AnimatePresence>

          {/* Error toast */}
          <AnimatePresence>
            {lastError && (
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[100]"
              >
                <div className="bg-red-500/90 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg flex items-center gap-2 backdrop-blur-md border border-red-400/30">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{lastError}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hand results overlay — shows all players' cards */}
          <AnimatePresence>
            {handResults && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute inset-0 flex items-center justify-center z-[200] bg-black/45 p-4 backdrop-blur-[3px]"
              >
                <motion.div
                  initial={{ y: 30, scale: 0.92 }}
                  animate={{ y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  className="relative px-6 py-6 rounded-3xl max-w-lg w-full overflow-hidden"
                  style={{
                    background: "linear-gradient(160deg, rgba(30, 24, 10, 0.97), rgba(12, 12, 22, 0.97))",
                    border: "1px solid rgba(232, 185, 35, 0.4)",
                    boxShadow: "0 0 60px rgba(232, 185, 35, 0.18), 0 30px 80px rgba(0,0,0,0.6)",
                  }}
                >
                  {/* Radiating glow behind the headline */}
                  <motion.div
                    aria-hidden
                    className="absolute -top-32 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full pointer-events-none"
                    style={{ background: "radial-gradient(circle, rgba(232,185,35,0.35) 0%, transparent 65%)" }}
                    animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                  />
                  {(() => {
                    const top = [...handResults].sort((a, b) => b.winnings - a.winnings)[0];
                    if (!top || top.winnings <= 0) return null;
                    const iWon = top.player_id === user?.id;
                    const name = gameState?.players.find((p) => p.id === top.player_id)?.display_name || "Unknown";
                    return (
                      <div className="relative text-center mb-5">
                        <motion.div
                          initial={{ scale: 0, rotate: -30 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.1 }}
                          className="mx-auto mb-2 w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br from-gold-light via-gold to-gold-dark shadow-[0_0_30px_rgba(232,185,35,0.6)]"
                        >
                          <Trophy className="w-6 h-6 text-black" />
                        </motion.div>
                        <h3 className="text-2xl md:text-3xl font-black text-gradient-gold leading-tight">
                          {iWon ? "You win!" : `${name} wins`}
                        </h3>
                        <motion.p
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.35 }}
                          className="mt-1 text-sm text-white/70"
                        >
                          <span className="font-black text-gold tabular-nums">+{top.winnings.toLocaleString()}</span>
                          {top.hand_rank && <> · {top.hand_rank}</>}
                        </motion.p>
                      </div>
                    );
                  })()}
                  <div className="relative space-y-2.5">
                    {[...handResults].sort((a, b) => b.winnings - a.winnings).map((result, i) => {
                      const playerName =
                        gameState?.players.find(
                          (p) => p.id === result.player_id,
                        )?.display_name || "Unknown";
                      const isWinner = result.winnings > 0;
                      return (
                        <motion.div
                          key={result.player_id}
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: i * 0.15 }}
                          className="flex items-center justify-between px-4 py-3 rounded-xl"
                          style={{
                            background: isWinner
                              ? "rgba(212,168,67,0.1)"
                              : "rgba(255,255,255,0.03)",
                            border: isWinner
                              ? "1px solid rgba(212,168,67,0.3)"
                              : "1px solid rgba(255,255,255,0.05)",
                          }}
                        >
                          <div className="flex items-center gap-3">
                            {/* Show player's cards */}
                            <div className="flex gap-0.5">
                              {result.cards.map((card, ci) => (
                                <PokerCard
                                  key={ci}
                                  card={card}
                                  size="sm"
                                  delay={i * 0.15 + ci * 0.1}
                                />
                              ))}
                            </div>
                            <div>
                              <div className="text-sm font-semibold flex items-center gap-1.5">
                                {isWinner && (
                                  <Trophy className="w-3.5 h-3.5 text-gold" />
                                )}
                                {playerName}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {result.hand_rank}
                              </div>
                            </div>
                          </div>
                          {isWinner && (
                            <span className="text-sm font-bold text-gold">
                              +{result.winnings.toLocaleString()}
                            </span>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                  <p className="relative text-center text-[10px] uppercase tracking-[0.25em] text-muted-foreground mt-4 animate-pulse">
                    Next hand starting soon
                  </p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Chat Sidebar */}
        <AnimatePresence>
          {showChat && (
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute md:relative right-0 top-0 bottom-0 w-full md:w-96 shrink-0 border-l border-white/5 flex flex-col z-[100]"
              style={{
                background: "rgba(10, 10, 20, 0.98)",
                backdropFilter: "blur(48px)",
                WebkitBackdropFilter: "blur(48px)",
              }}
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <h4 className="flex items-center gap-3 text-sm font-black text-white uppercase tracking-widest">
                  <MessageCircle className="w-5 h-5 text-[#c5a059]" />
                  Chat Hub
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowChat(false)}
                  className="text-white/20 hover:text-white rounded-full"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {chatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-white/10 space-y-4 grayscale">
                    <MessageCircle className="w-12 h-12 opacity-20" />
                    <span className="text-[10px] font-black uppercase tracking-[0.4em]">
                      No messages yet
                    </span>
                  </div>
                ) : (
                  chatMessages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 10, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      className={`flex flex-col ${msg.player_id === user?.id ? "items-end" : "items-start"}`}
                    >
                      <span className="text-[9px] text-white/30 uppercase font-bold mb-1 ml-1">
                        {msg.display_name}
                      </span>
                      <div
                        className={`px-4 py-2.5 rounded-2xl max-w-[85%] text-xs shadow-lg ${
                          msg.player_id === user?.id
                            ? "bg-[#c5a059] text-black font-bold rounded-tr-none"
                            : "bg-white/5 text-white/80 border border-white/5 rounded-tl-none"
                        }`}
                      >
                        {msg.message}
                      </div>
                    </motion.div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              <form
                onSubmit={handleSendChat}
                className="p-6 bg-black/20 border-t border-white/5"
              >
                <div className="relative">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type something..."
                    className="bg-white/5 border-white/10 h-12 rounded-xl pr-12 text-xs font-bold focus:border-[#c5a059] transition-all"
                  />
                  <button
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-[#c5a059] flex items-center justify-center text-black hover:bg-white transition-all shadow-lg active:scale-90"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
