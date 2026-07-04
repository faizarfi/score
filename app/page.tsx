"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ==========================================
// TIPE DATA & KONSTANTA UTAMA
// ==========================================
type TeamIndex = 0 | 1;

type Team = {
  name: string;
  shortName: string;
  color: string;
  score: number;
  sets: number;
  timeoutsUsed: number;
};

type MatchLog = {
  id: string;
  timestamp: string;
  gameClock: string;
  teamIndex: TeamIndex;
  teamName: string;
  action: "ADD" | "SUB" | "TIMEOUT" | "SET_WIN";
  currentScore: [number, number];
  description: string;
};

type ViewMode = "compact" | "large" | "analytics";
type MatchStatus = "READY" | "LIVE" | "TIMEOUT" | "FINISHED";

const initialTeams: [Team, Team] = [
  {
    name: "Tim Merah",
    shortName: "MRH",
    color: "from-rose-600 to-red-700",
    score: 0,
    sets: 0,
    timeoutsUsed: 0,
  },
  {
    name: "Tim Biru",
    shortName: "BRU",
    color: "from-blue-600 to-indigo-700",
    score: 0,
    sets: 0,
    timeoutsUsed: 0,
  },
];

const BASE_SET_TARGET = 25;
const DECIDING_SET_TARGET = 15;
const MAX_SETS_TO_WIN = 3; 

const getTeamSideTheme = (teamIndex: TeamIndex) => {
  if (teamIndex === 0) {
    return {
      outer: "border-rose-500 bg-rose-950/80",
      outerActive: "animate-shake border-yellow-400 bg-rose-900",
      headerBorder: "border-rose-800",
      scoreBorder: "border-rose-500/30",
      scoreAccent: "text-rose-400/60",
      shortNameText: "text-rose-300",
      pulseText: "text-rose-400",
      setCountText: "text-rose-400",
      buttonTint: "border-rose-500/20 text-rose-400",
    };
  }

  return {
    outer: "border-blue-500 bg-blue-950/80",
    outerActive: "animate-shake border-yellow-400 bg-blue-900",
    headerBorder: "border-blue-800",
    scoreBorder: "border-blue-500/30",
    scoreAccent: "text-cyan-400/60",
    shortNameText: "text-blue-300",
    pulseText: "text-cyan-400",
    setCountText: "text-blue-400",
    buttonTint: "border-blue-500/20 text-cyan-400",
  };
};

// ==========================================
// AUDIO SYNTHESIZER (WEB AUDIO API)
// ==========================================
const playSynthSound = (type: "click" | "point" | "alert" | "victory") => {
  if (typeof window === "undefined") return;
  try {
    const webkitAudioContext = (window as Window & { webkitAudioContext?: new () => AudioContext }).webkitAudioContext;
    const AudioContextCtor = window.AudioContext || webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor();
    
    switch (type) {
      case "click": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
        break;
      }
      case "point": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
        break;
      }
      case "alert": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(330, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
        break;
      }
      case "victory": {
        const now = ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50]; 
        notes.forEach((freq, index) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + index * 0.1);
          gain.gain.setValueAtTime(0.1, now + index * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.1 + 0.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + index * 0.1);
          osc.stop(now + index * 0.1 + 0.4);
        });
        break;
      }
    }
  } catch (e) {
    console.error("Audio synth error:", e);
  }
};

function formatClock(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600).toString().padStart(2, "0");
  const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return h !== "00" ? `${h}:${m}:${s}` : `${m}:${s}`;
}

export default function Home() {
  // States Utama
  const [teams, setTeams] = useState<[Team, Team]>(initialTeams);
  const [viewMode, setViewMode] = useState<ViewMode>("large");
  const [matchStatus, setMatchStatus] = useState<MatchStatus>("READY");
  
  // State Waktu & Kontrol
  const [clock, setClock] = useState(0);
  const [timeoutClock, setTimeoutClock] = useState(30);
  const [activeTimeoutTeam, setActiveTimeoutTeam] = useState<TeamIndex | null>(null);
  
  // State Aturan Voli Esensial
  const [servingTeam, setServingTeam] = useState<TeamIndex | null>(0);
  const [setHistory, setSetHistory] = useState<[number, number][]>([]);
  const [matchLogs, setMatchLogs] = useState<MatchLog[]>([]);
  
  // State Efek Visual & Animasi
  const [pulseTeam, setPulseTeam] = useState<TeamIndex | null>(null);
  const [displayScores, setDisplayScores] = useState<[number, number]>([0, 0]);
  const [triggerShake, setTriggerShake] = useState<TeamIndex | null>(null);

  // References untuk Animasi Interpolasi Skor
  const frameRef = useRef<number | null>(null);
  const displayScoresRef = useRef(displayScores);
  const isCourtSwapped = setHistory.length % 2 === 0;
  const leftTeamIndex: TeamIndex = isCourtSwapped ? 1 : 0;
  const rightTeamIndex: TeamIndex = leftTeamIndex === 0 ? 1 : 0;
  const leftTeam = teams[leftTeamIndex];
  const rightTeam = teams[rightTeamIndex];
  const leftScore = leftTeam.score;
  const rightScore = rightTeam.score;
  const leftTheme = getTeamSideTheme(leftTeamIndex);
  const rightTheme = getTeamSideTheme(rightTeamIndex);
  const currentSetNumber = setHistory.length + 1;

  useEffect(() => {
    displayScoresRef.current = displayScores;
  }, [displayScores]);

  // Engine Pengatur Jam Pertandingan Utama
  useEffect(() => {
    if (matchStatus !== "LIVE") return undefined;
    const timer = window.setInterval(() => {
      setClock((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [matchStatus]);

  // Engine Pengatur Hitung Mundur Timeout
  useEffect(() => {
    if (matchStatus !== "TIMEOUT") return undefined;
    const timer = window.setInterval(() => {
      setTimeoutClock((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          setMatchStatus("LIVE");
          setActiveTimeoutTeam(null);
          playSynthSound("alert");
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [matchStatus]);

  // Sistem Animasi LERF (Fluid Score Increment)
  useEffect(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
    }

    const startScores = displayScoresRef.current;
    const targetScores: [number, number] = [leftScore, rightScore];
    const startTime = window.performance.now();
    const duration = 200; 

    const step = (timestamp: number) => {
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4); 

      setDisplayScores([
        Math.round(startScores[0] + (targetScores[0] - startScores[0]) * eased),
        Math.round(startScores[1] + (targetScores[1] - startScores[1]) * eased),
      ]);

      if (progress < 1) {
        frameRef.current = window.requestAnimationFrame(step);
      }
    };

    frameRef.current = window.requestAnimationFrame(step);
    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, [leftScore, rightScore]);

  // Menentukan Target Skor Dinamis Berdasarkan Deuce
  const currentSetTarget = useMemo(() => {
    const currentTotalSets = teams[0].sets + teams[1].sets;
    const baseTarget = currentTotalSets === (MAX_SETS_TO_WIN * 2 - 2) ? DECIDING_SET_TARGET : BASE_SET_TARGET;
    
    if (leftScore >= baseTarget - 1 && rightScore >= baseTarget - 1) {
      return Math.max(leftScore, rightScore) + (Math.abs(leftScore - rightScore) === 0 ? 2 : 1);
    }
    return baseTarget;
  }, [leftScore, rightScore, teams]);

  // Deteksi Kondisi Set Point Secara Real-Time
  const setPointStatus = useMemo(() => {
    if (leftScore >= currentSetTarget - 1 && leftScore > rightScore) return 0;
    if (rightScore >= currentSetTarget - 1 && rightScore > leftScore) return 1;
    return null;
  }, [leftScore, rightScore, currentSetTarget]);

  // Mutator Data Tim Terpusat
  const updateTeam = useCallback((index: TeamIndex, updater: (team: Team) => Team) => {
    setTeams((prev) => {
      const next = [...prev];
      next[index] = updater(next[index]);
      return next as [Team, Team];
    });
  }, []);

  // Push Catatan Pertandingan Kedalam Log
  const pushLog = useCallback((teamIndex: TeamIndex, action: MatchLog["action"], desc: string, currentSnap: [number, number], gameClock: string) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const newLog: MatchLog = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: timeStr,
      gameClock,
      teamIndex,
      teamName: teams[teamIndex].name,
      action,
      currentScore: currentSnap,
      description: desc,
    };
    setMatchLogs((prev) => [newLog, ...prev]);
  }, [teams]);

  // Aksi Tambah Poin Penuh Validasi
  const addPoint = useCallback((index: TeamIndex) => {
    if (matchStatus === "FINISHED" || matchStatus === "TIMEOUT") return;
    if (matchStatus === "READY") setMatchStatus("LIVE");

    playSynthSound("point");
    setPulseTeam(index);
    setServingTeam(index);

    const opponentIndex = 1 - index;
    const nextScore = teams[index].score + 1;
    const currentScoresSnap: [number, number] = index === 0 ? [nextScore, teams[1].score] : [teams[0].score, nextScore];

    if (nextScore >= currentSetTarget && nextScore - teams[opponentIndex].score >= 2) {
      playSynthSound("victory");
      const updatedSets = teams[index].sets + 1;
      
      pushLog(index, "SET_WIN", `Memenangkan Set dengan skor ${nextScore} - ${teams[opponentIndex].score}`, currentScoresSnap, formatClock(clock));
      setSetHistory((prev) => [...prev, currentScoresSnap]);

      if (updatedSets >= MAX_SETS_TO_WIN) {
        setMatchStatus("FINISHED");
        updateTeam(index, (t) => ({ ...t, score: nextScore, sets: updatedSets }));
        return;
      }

      setTeams((prev) => [
        { ...prev[0], score: 0, sets: index === 0 ? prev[0].sets + 1 : prev[0].sets, timeoutsUsed: 0 },
        { ...prev[1], score: 0, sets: index === 1 ? prev[1].sets + 1 : prev[1].sets, timeoutsUsed: 0 },
      ]);
      return;
    }

    updateTeam(index, (t) => ({ ...t, score: nextScore }));
    pushLog(index, "ADD", "Mendapatkan 1 Poin", currentScoresSnap, formatClock(clock));
    
    if (nextScore >= currentSetTarget - 2) {
      setTriggerShake(index);
      setTimeout(() => setTriggerShake(null), 300);
    }
  }, [clock, currentSetTarget, matchStatus, pushLog, teams, updateTeam]);

  // Kurangi Poin Terkunci Batas Bawah Nol
  const removePoint = useCallback((index: TeamIndex) => {
    if (teams[index].score === 0 || matchStatus === "TIMEOUT") return;
    playSynthSound("click");
    
    const nextScore = Math.max(0, teams[index].score - 1);
    const currentScoresSnap: [number, number] = index === 0 ? [nextScore, teams[1].score] : [teams[0].score, nextScore];
    
    updateTeam(index, (t) => ({ ...t, score: nextScore }));
    pushLog(index, "SUB", "Koreksi pengurangan 1 poin", currentScoresSnap, formatClock(clock));
  }, [clock, matchStatus, pushLog, teams, updateTeam]);

  // Fungsi Request Jeda Strategis
  const requestTimeout = useCallback((index: TeamIndex) => {
    if (matchStatus !== "LIVE" || teams[index].timeoutsUsed >= 2) return;
    playSynthSound("alert");
    setActiveTimeoutTeam(index);
    setMatchStatus("TIMEOUT");
    setTimeoutClock(30);
    updateTeam(index, (t) => ({ ...t, timeoutsUsed: t.timeoutsUsed + 1 }));
    pushLog(index, "TIMEOUT", "Mengambil Technical Timeout (30s)", [teams[0].score, teams[1].score], formatClock(clock));
  }, [clock, matchStatus, pushLog, teams, updateTeam]);

  const resetAllBoard = () => {
    playSynthSound("alert");
    setTeams(initialTeams);
    setSetHistory([]);
    setMatchLogs([]);
    setClock(0);
    setMatchStatus("READY");
    setServingTeam(0);
    setActiveTimeoutTeam(null);
  };

  // Keyboard Global Event Listener Matrix
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return; 
      
      switch (e.code) {
        case "Space":
          e.preventDefault();
          setMatchStatus((prev) => (prev === "LIVE" ? "READY" : prev === "READY" ? "LIVE" : prev));
          break;
        case "KeyQ": addPoint(0); break;
        case "KeyA": removePoint(0); break;
        case "KeyP": addPoint(1); break;
        case "KeyL": removePoint(1); break;
        case "KeyZ": requestTimeout(0); break;
        case "KeyM": requestTimeout(1); break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [addPoint, matchStatus, removePoint, requestTimeout]);

  return (
    <main className="min-h-screen bg-slate-950 relative overflow-hidden px-4 py-4 sm:p-6 font-sans text-slate-100 antialiased selection:bg-cyan-500/30">
      
      {/* STYLE INTEGRATION FOR MACRO HIGH-VISIBILITY EMISSIVES */}
      <style jsx global>{`
        @keyframes score-pop {
          0% { transform: scale(1); }
          50% { transform: scale(1.08); filter: brightness(1.5); }
          100% { transform: scale(1); }
        }
        @keyframes panel-flash {
          0% { background-color: rgba(255,255,255,0.3); }
          100% { background-color: transparent; }
        }
        @keyframes critical-shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        .animate-score-pop { animation: score-pop 0.18s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .animate-flash { animation: panel-flash 0.3s ease-out; }
        .animate-shake { animation: critical-shake 0.2s ease-in-out infinite; }
      `}</style>

      {/* OVERLAY TIMEOUT MODAL */}
      {matchStatus === "TIMEOUT" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
          <div className="text-center p-10 rounded-3xl border-4 border-amber-500 bg-slate-900 shadow-[0_0_80px_rgba(245,158,11,0.4)] max-w-lg w-full mx-4">
            <span className="text-2xl font-black uppercase tracking-[0.4em] text-amber-400 block animate-pulse">TIMEOUT TIME</span>
            <h2 className="text-5xl font-black mt-4 text-white">
              {activeTimeoutTeam !== null ? teams[activeTimeoutTeam].name : "PANEL"}
            </h2>
            <div className="my-8 text-[10rem] font-black font-mono tracking-tighter text-yellow-300 tabular-nums leading-none">
              {timeoutClock}
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl relative z-10 flex flex-col min-h-[calc(100vh-3rem)] gap-4">
        
        {/* UPPER CONSOLE BAR */}
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-900/95 p-4 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-500 shadow-md">
              <span className="text-2xl font-black text-slate-950">V</span>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-wider uppercase text-white">
                Pordes Volly Jomblang 2026
              </h1>
              <div className="flex flex-wrap items-center gap-3 mt-0.5 text-sm text-slate-400">
                <span>STATUS MATCH: <strong className="text-yellow-400 font-black">{matchStatus}</strong></span>
                <span>•</span>
                <span>SET TARGET: <strong className="text-emerald-400 font-black">{currentSetTarget} POIN</strong></span>
                <span>•</span>
                <span>SET <strong className="text-cyan-400 font-black">{currentSetNumber}</strong> | KANAN: <strong className="text-white font-black">{rightTeam.name}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-xl bg-black p-1 border border-white/10">
              {(["compact", "large", "analytics"] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`rounded-lg px-4 py-1.5 text-xs font-black uppercase tracking-widest transition-all ${
                    viewMode === mode
                      ? "bg-slate-800 text-yellow-400 shadow-inner border border-white/10"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={resetAllBoard}
              className="rounded-xl border-2 border-red-600 bg-red-600/20 px-5 py-1.5 text-xs font-black uppercase tracking-wider text-red-400 transition hover:bg-red-600 hover:text-white"
            >
              Reset Match
            </button>
          </div>
        </header>

        {/* ==========================================
            VIEW MODE 1: COMPACT MODE STRIP
            ========================================== */}
        {viewMode === "compact" && (
          <section className="flex flex-1 items-center justify-center py-6">
            <div className="w-full max-w-5xl rounded-3xl border-2 border-white/10 bg-slate-900/95 p-4 shadow-2xl">
              <div className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-stretch overflow-hidden rounded-2xl border-2 border-white/10 bg-black">
                
                {/* Tim Kiri Panel */}
                <div className={`flex items-center gap-4 px-6 py-4 ${leftTeamIndex === 0 ? "bg-rose-950/40" : "bg-blue-950/40"} border-r border-white/5`}>
                  {servingTeam === leftTeamIndex && <span className="h-6 w-6 rounded-full bg-yellow-400 animate-ping absolute" />}
                  {servingTeam === leftTeamIndex && <span className="h-6 w-6 rounded-full bg-yellow-400 relative z-10 shadow-[0_0_20px_#facc15]" />}
                  <input
                    value={leftTeam.name}
                    onChange={(e) => updateTeam(leftTeamIndex, (t) => ({ ...t, name: e.target.value }))}
                    className="w-36 bg-transparent text-xl font-black uppercase tracking-wide text-white outline-none"
                  />
                </div>

                {/* Skor Kiri Click Target */}
                <button
                  type="button"
                  onClick={() => addPoint(leftTeamIndex)}
                  className={`bg-slate-900 px-6 text-center transition hover:bg-slate-800 border-r border-white/5 ${pulseTeam === leftTeamIndex ? `animate-flash ${leftTheme.pulseText}` : "text-white"}`}
                >
                  <span className="font-mono text-7xl sm:text-8xl font-black tabular-nums tracking-tighter block">{displayScores[0]}</span>
                </button>

                {/* Pusat Divider Informasi */}
                <div className="flex flex-col items-center justify-center bg-black px-8 min-w-40 text-center">
                  <span className="text-xs font-black tracking-widest text-slate-500">WAKTU</span>
                  <span className="text-2xl font-black font-mono tracking-tight text-cyan-400 mt-1 tabular-nums">{formatClock(clock)}</span>
                  <div className="mt-3 flex items-center gap-2 bg-slate-900 px-3 py-1 rounded-md border border-white/10">
                    <span className={`text-lg font-black font-mono ${leftTheme.setCountText}`}>{leftTeam.sets}</span>
                    <span className="text-[10px] font-black text-slate-500 tracking-wider">SETS</span>
                    <span className={`text-lg font-black font-mono ${rightTheme.setCountText}`}>{rightTeam.sets}</span>
                  </div>
                </div>

                {/* Skor Kanan Click Target */}
                <button
                  type="button"
                  onClick={() => addPoint(rightTeamIndex)}
                  className={`bg-slate-900 px-6 text-center transition hover:bg-slate-800 border-l border-white/5 ${pulseTeam === rightTeamIndex ? `animate-flash ${rightTheme.pulseText}` : "text-white"}`}
                >
                  <span className="font-mono text-7xl sm:text-8xl font-black tabular-nums tracking-tighter block">{displayScores[1]}</span>
                </button>

                {/* Tim Kanan Panel */}
                <div className={`flex items-center justify-end gap-4 px-6 py-4 ${rightTeamIndex === 0 ? "bg-rose-950/40" : "bg-blue-950/40"} border-l border-white/5`}>
                  <input
                    value={rightTeam.name}
                    onChange={(e) => updateTeam(rightTeamIndex, (t) => ({ ...t, name: e.target.value }))}
                    className="w-36 bg-transparent text-right text-xl font-black uppercase tracking-wide text-white outline-none"
                  />
                  {servingTeam === rightTeamIndex && <span className="h-6 w-6 rounded-full bg-yellow-400 animate-ping absolute" />}
                  {servingTeam === rightTeamIndex && <span className="h-6 w-6 rounded-full bg-yellow-400 relative z-10 shadow-[0_0_20px_#facc15]" />}
                </div>

              </div>

              {/* Quick Controller Footer di Compact Mode */}
              <div className="flex items-center justify-between mt-4 px-2">
                <div className="flex gap-3">
                  <button onClick={() => removePoint(leftTeamIndex)} className="text-sm font-bold bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl border border-white/10">- TIM KIRI</button>
                  <button onClick={() => requestTimeout(leftTeamIndex)} className="text-sm font-bold bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 px-4 py-2 rounded-xl border border-amber-500/20">T.O KIRI</button>
                </div>
                <button 
                  onClick={() => setMatchStatus(matchStatus === "LIVE" ? "READY" : "LIVE")}
                  className="bg-yellow-400 text-slate-950 px-6 py-2 rounded-xl font-black uppercase tracking-wider text-sm shadow-md"
                >
                  {matchStatus === "LIVE" ? "PAUSE CLOCK" : "START CLOCK"}
                </button>
                <div className="flex gap-3">
                  <button onClick={() => requestTimeout(rightTeamIndex)} className="text-sm font-bold bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 px-4 py-2 rounded-xl border border-amber-500/20">T.O KANAN</button>
                  <button onClick={() => removePoint(rightTeamIndex)} className="text-sm font-bold bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl border border-white/10">- TIM KANAN</button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ==========================================
            VIEW MODE 2: LARGE FIELD CONSOLE (HIGH VISIBILITY)
            ========================================== */}
        {viewMode === "large" && (
          <section className="grid flex-1 gap-4 md:grid-cols-[1fr_auto_1fr] items-stretch">
            
            {/* PANEL SEKTOR TIM KIRI (KONTRAST TINGGI) */}
            <article className={`flex flex-col justify-between rounded-3xl border-4 transition-all duration-200 p-6 ${
              triggerShake === leftTeamIndex ? leftTheme.outerActive : leftTheme.outer
            } ${setPointStatus === 0 ? "ring-8 ring-yellow-400 shadow-[0_0_60px_rgba(250,204,21,0.3)] animate-pulse" : "shadow-xl"}`}>
              
              <div className={`flex items-center justify-between gap-4 border-b-2 pb-4 ${leftTheme.headerBorder}`}>
                <div className="flex items-center gap-3">
                  {servingTeam === leftTeamIndex && (
                    <div className="relative flex h-6 w-6">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-6 w-6 bg-yellow-400 shadow-[0_0_15px_#facc15]"></span>
                    </div>
                  )}
                  <input
                    value={leftTeam.name}
                    onChange={(e) => updateTeam(leftTeamIndex, (t) => ({ ...t, name: e.target.value }))}
                    className="bg-transparent text-3xl font-black uppercase tracking-wide text-white outline-none focus:bg-black/30 rounded px-2 py-1"
                  />
                </div>
                <div className={`bg-black/40 border border-white/10 px-4 py-1.5 rounded-xl font-mono text-lg font-black ${leftTheme.shortNameText}`}>
                  {leftTeam.shortName}
                </div>
              </div>

              {/* RAKSASA SCORE PANEL - TERBACA DARI 50 METER */}
              <div className="my-4 flex-1 flex flex-col justify-center">
                <div 
                  onClick={() => addPoint(leftTeamIndex)}
                  className={`cursor-pointer rounded-2xl bg-black border-2 p-8 text-center shadow-2xl transition hover:border-white/40 active:bg-slate-900 ${leftTheme.scoreBorder}`}
                >
                  <div className={`text-[12rem] sm:text-[16rem] font-black font-mono tracking-tighter leading-none text-white transition-transform ${pulseTeam === leftTeamIndex ? `scale-105 ${leftTheme.pulseText}` : ""}`}>
                    {leftTeam.score}
                  </div>
                  <span className={`text-xs font-black tracking-[0.4em] block mt-2 uppercase ${leftTheme.scoreAccent}`}>TAP AREA UNTUK TAMBAH SKOR (+1)</span>
                </div>
              </div>

              {/* KONTROL OPERATOR BAWAH */}
              <div className="border-t-2 border-rose-800 pt-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => addPoint(leftTeamIndex)}
                    className="rounded-xl bg-emerald-500 text-slate-950 px-6 py-3 text-sm font-black transition hover:brightness-110 active:scale-95 shadow-lg"
                  >
                    POIN TIM L (Q)
                  </button>
                  <button
                    type="button"
                    onClick={() => removePoint(leftTeamIndex)}
                    className="rounded-xl bg-slate-900 border border-white/20 px-4 py-3 text-xs font-black text-slate-300 hover:bg-slate-800"
                  >
                    KURANG (A)
                  </button>
                </div>

                <div className="flex items-center gap-4 bg-black/40 border border-white/5 p-2 rounded-xl">
                  <div className="text-center border-r border-white/10 pr-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">TIMEOUT</span>
                    <div className="flex gap-1 mt-1">
                      {[1, 2].map((num) => (
                        <span key={num} className={`h-3 w-5 rounded-sm ${leftTeam.timeoutsUsed >= num ? "bg-yellow-400" : "bg-slate-800"}`} />
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={leftTeam.timeoutsUsed >= 2}
                    onClick={() => requestTimeout(leftTeamIndex)}
                    className={`rounded-lg bg-amber-500/20 border px-3 py-1 text-xs font-bold disabled:opacity-20 ${leftTheme.buttonTint}`}
                  >
                    MINTA T.O (Z)
                  </button>
                </div>

                <div className="bg-black px-6 py-3 rounded-2xl border border-white/10 text-center min-w-28 shadow-lg">
                  <span className="text-[11px] font-black tracking-[0.35em] text-slate-300 block uppercase">MENANG SET</span>
                  <span className={`text-5xl sm:text-6xl font-black font-mono leading-none block mt-1 ${leftTheme.setCountText}`}>{leftTeam.sets}</span>
                </div>
              </div>

            </article>

            {/* SEKTOR KONSOL JANTUNG TENGAH (METRIK UTAMA) */}
            <div className="flex flex-col items-center justify-center gap-4 py-2 min-w-64">
              
              <div className="rounded-2xl border-2 border-white/10 bg-slate-900 p-5 text-center w-full shadow-2xl">
                <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 block">TOTAL WAKTU PERTANDINGAN</span>
                <p className="mt-2 text-4xl font-black font-mono tracking-tight text-cyan-400 tabular-nums bg-black py-2 rounded-xl border border-white/5">{formatClock(clock)}</p>
                <button
                  type="button"
                  onClick={() => setMatchStatus(matchStatus === "LIVE" ? "READY" : "LIVE")}
                  className={`mt-4 w-full rounded-xl py-3 text-sm font-black uppercase tracking-widest transition-all border-2 ${
                    matchStatus === "LIVE"
                      ? "bg-amber-500/10 border-amber-500/40 text-amber-400 hover:bg-amber-500/20"
                      : "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30"
                  }`}
                >
                  {matchStatus === "LIVE" ? "PAUSE MATCH (SPACE)" : "START MATCH (SPACE)"}
                </button>
              </div>

              {/* INDIKATOR SCANNING DATA LAPANGAN */}
              <div className="rounded-2xl border border-white/10 bg-black/80 p-4 w-full text-center">
                <span className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500 block mb-3">PAPAN INFORMASI STRATEGIS</span>
                <div className="flex flex-col gap-2 text-xs font-mono">
                  <div className="flex justify-between items-center bg-slate-900 p-2.5 rounded-lg border border-white/5">
                    <span className="text-slate-400 font-bold">POSISI SERVIS:</span>
                    <span className="font-black text-yellow-400 text-sm">{servingTeam === null ? "BELUM" : teams[servingTeam].name}</span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-900 p-2.5 rounded-lg border border-white/5">
                    <span className="text-slate-400 font-bold">SELISIH POIN:</span>
                    <span className="font-black text-white text-base bg-white/10 px-2.5 py-0.5 rounded-md">{Math.abs(leftScore - rightScore)} POIN</span>
                  </div>
                </div>
              </div>

              {/* RECORD LOG HISTORI SET KONDENSASI */}
              <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 w-full flex-1 flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-400 block text-center mb-2">RIWAYAT SET SEBELUMNYA</span>
                {setHistory.length === 0 ? (
                  <div className="text-center text-xs text-slate-600 my-auto italic border-2 border-dashed border-white/5 rounded-xl py-6 bg-black/20">Belum ada data set selesai</div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                    {setHistory.map((history, i) => (
                      <div key={i} className="flex items-center justify-between bg-black px-4 py-2 rounded-xl border border-white/5 text-sm font-mono">
                        <span className="text-slate-400 font-black">SET {i + 1}</span>
                        <div className="flex gap-3 font-black text-base">
                          <span className={history[0] > history[1] ? "text-rose-400" : "text-slate-400"}>{history[0]}</span>
                          <span className="text-slate-600">:</span>
                          <span className={history[1] > history[0] ? "text-cyan-400" : "text-slate-400"}>{history[1]}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* PANEL SEKTOR TIM KANAN (KONTRAST TINGGI) */}
            <article className={`flex flex-col justify-between rounded-3xl border-4 transition-all duration-200 p-6 ${
              triggerShake === rightTeamIndex ? rightTheme.outerActive : rightTheme.outer
            } ${setPointStatus === 1 ? "ring-8 ring-yellow-400 shadow-[0_0_60px_rgba(250,204,21,0.3)] animate-pulse" : "shadow-xl"}`}>
              
              <div className={`flex items-center justify-between gap-4 border-b-2 pb-4 ${rightTheme.headerBorder}`}>
                <div className="flex items-center gap-3">
                  {servingTeam === rightTeamIndex && (
                    <div className="relative flex h-6 w-6">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-6 w-6 bg-yellow-400 shadow-[0_0_15px_#facc15]"></span>
                    </div>
                  )}
                  <input
                    value={rightTeam.name}
                    onChange={(e) => updateTeam(rightTeamIndex, (t) => ({ ...t, name: e.target.value }))}
                    className="bg-transparent text-3xl font-black uppercase tracking-wide text-white outline-none focus:bg-black/30 rounded px-2 py-1"
                  />
                </div>
                <div className={`bg-black/40 border border-white/10 px-4 py-1.5 rounded-xl font-mono text-lg font-black ${rightTheme.shortNameText}`}>
                  {rightTeam.shortName}
                </div>
              </div>

              {/* RAKSASA SCORE PANEL - TERBACA DARI 50 METER */}
              <div className="my-4 flex-1 flex flex-col justify-center">
                <div 
                  onClick={() => addPoint(rightTeamIndex)}
                  className={`cursor-pointer rounded-2xl bg-black border-2 p-8 text-center shadow-2xl transition hover:border-white/40 active:bg-slate-900 ${rightTheme.scoreBorder}`}
                >
                  <div className={`text-[12rem] sm:text-[16rem] font-black font-mono tracking-tighter leading-none text-white transition-transform ${pulseTeam === rightTeamIndex ? `scale-105 ${rightTheme.pulseText}` : ""}`}>
                    {rightTeam.score}
                  </div>
                  <span className={`text-xs font-black tracking-[0.4em] block mt-2 uppercase ${rightTheme.scoreAccent}`}>TAP AREA UNTUK TAMBAH SKOR (+1)</span>
                </div>
              </div>

              {/* KONTROL OPERATOR BAWAH */}
              <div className="border-t-2 border-blue-800 pt-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => addPoint(rightTeamIndex)}
                    className="rounded-xl bg-emerald-500 text-slate-950 px-6 py-3 text-sm font-black transition hover:brightness-110 active:scale-95 shadow-lg"
                  >
                    POIN TIM R (P)
                  </button>
                  <button
                    type="button"
                    onClick={() => removePoint(rightTeamIndex)}
                    className="rounded-xl bg-slate-900 border border-white/20 px-4 py-3 text-xs font-black text-slate-300 hover:bg-slate-800"
                  >
                    KURANG (L)
                  </button>
                </div>

                <div className="flex items-center gap-4 bg-black/40 border border-white/5 p-2 rounded-xl">
                  <div className="text-center border-r border-white/10 pr-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">TIMEOUT</span>
                    <div className="flex gap-1 mt-1">
                      {[1, 2].map((num) => (
                        <span key={num} className={`h-3 w-5 rounded-sm ${rightTeam.timeoutsUsed >= num ? "bg-yellow-400" : "bg-slate-800"}`} />
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={rightTeam.timeoutsUsed >= 2}
                    onClick={() => requestTimeout(rightTeamIndex)}
                    className={`rounded-lg bg-amber-500/20 border px-3 py-1 text-xs font-bold disabled:opacity-20 ${rightTheme.buttonTint}`}
                  >
                    MINTA T.O (M)
                  </button>
                </div>

                <div className="bg-black px-6 py-3 rounded-2xl border border-white/10 text-center min-w-28 shadow-lg">
                  <span className="text-[11px] font-black tracking-[0.35em] text-slate-300 block uppercase">MENANG SET</span>
                  <span className={`text-5xl sm:text-6xl font-black font-mono leading-none block mt-1 ${rightTheme.setCountText}`}>{rightTeam.sets}</span>
                </div>
              </div>

            </article>

          </section>
        )}

        {/* ==========================================
            VIEW MODE 3: ADVANCED LIVE ANALYTICS LOGS
            ========================================== */}
        {viewMode === "analytics" && (
          <section className="flex-1 grid gap-4 md:grid-cols-2 items-stretch">
            
            <div className="rounded-3xl border border-white/10 bg-slate-900 p-5 flex flex-col">
              <h3 className="text-sm font-black uppercase tracking-wider text-cyan-400 border-b border-white/10 pb-3">Statistik Efisiensi Laga</h3>
              
              <div className="mt-4 grid grid-cols-2 gap-4 flex-1 items-center">
                <div className="p-4 bg-black rounded-2xl text-center border border-white/5">
                  <span className="text-[10px] font-bold tracking-wider text-slate-400 block uppercase">Total Rally Points Terjadi</span>
                  <div className="text-4xl font-black font-mono mt-2 text-white">{matchLogs.filter(l => l.action === "ADD").length}</div>
                </div>
                <div className="p-4 bg-black rounded-2xl text-center border border-white/5">
                  <span className="text-[10px] font-bold tracking-wider text-slate-400 block uppercase">Rata-rata Skor per Menit</span>
                  <div className="text-4xl font-black font-mono mt-2 text-white">
                    {clock > 0 ? ((matchLogs.filter(l => l.action === "ADD").length / clock) * 60).toFixed(1) : "0.0"}
                  </div>
                </div>
                
                <div className="col-span-2 p-4 bg-black rounded-2xl border border-white/5">
                  <span className="text-[10px] font-bold tracking-wider text-slate-400 block uppercase text-center mb-2">Rasio Distribusi Poin Tim</span>
                  <div className="flex h-6 w-full rounded-lg overflow-hidden bg-slate-950 border border-white/10 p-0.5">
                    <div 
                      className="bg-rose-600 transition-all duration-500 shadow-[0_0_15px_#f43f5e]" 
                      style={{ width: `${(leftScore + rightScore) > 0 ? (leftScore / (leftScore + rightScore)) * 100 : 50}%` }}
                    />
                    <div 
                      className="bg-blue-600 transition-all duration-500 flex-1 shadow-[0_0_15px_#2563eb]"
                    />
                  </div>
                  <div className="flex justify-between text-xs font-mono text-slate-400 mt-2 font-bold">
                    <span>{leftScore} POIN ({ (leftScore + rightScore) > 0 ? ((leftScore / (leftScore + rightScore)) * 100).toFixed(0) : 50 }%)</span>
                    <span>{rightScore} POIN ({ (leftScore + rightScore) > 0 ? ((rightScore / (leftScore + rightScore)) * 100).toFixed(0) : 50 }%)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-900 p-5 flex flex-col h-105 md:h-auto">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-400 border-b border-white/10 pb-3">Jurnal Kronologi Laga (Live Feed)</h3>
              <div className="mt-3 flex-1 overflow-y-auto pr-1 flex flex-col gap-2 max-h-90">
                {matchLogs.length === 0 ? (
                  <div className="text-center text-xs text-slate-600 my-auto italic">Belum ada aksi pertandingan tercatat</div>
                ) : (
                  matchLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-2.5 rounded-xl bg-black border border-white/5 text-xs transition-all hover:bg-slate-900">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[10px] font-bold text-cyan-400 bg-slate-900 border border-white/10 px-2 py-0.5 rounded-md">
                          {log.gameClock}
                        </span>
                        <div>
                          <span className={`font-black ${log.teamIndex === 0 ? "text-rose-400" : "text-cyan-400"}`}>
                            {log.teamName}
                          </span>
                          <p className="text-slate-400 mt-0.5 font-medium">{log.description}</p>
                        </div>
                      </div>
                      <div className="text-right font-mono font-bold text-slate-400 bg-slate-900 px-2 py-1 rounded border border-white/5">
                        [{log.currentScore[0]}-{log.currentScore[1]}]
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </section>
        )}

        {/* CHEATSHEET CONTROLLER */}
        <footer className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-center text-xs font-black text-yellow-400 tracking-wider shadow-lg">
          SHORTCUT — TIM KIRI: [Q] +1 Poin, [A] -1 Poin, [Z] Timeout | TIM KANAN: [P] +1 Poin, [L] -1 Poin, [M] Timeout | JEDA WAKTU: [SPACEBAR]
        </footer>

      </div>
    </main>
  );
}