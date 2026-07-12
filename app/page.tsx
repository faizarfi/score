"use client";

import { useCallback, useMemo, useState } from "react";

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
};

type ViewMode = "compact" | "large";

const initialTeams: [Team, Team] = [
  {
    name: "Tim Merah",
    shortName: "MRH",
    color: "from-rose-600 to-red-700",
    score: 0,
    sets: 0,
  },
  {
    name: "Tim Biru",
    shortName: "BRU",
    color: "from-blue-600 to-indigo-700",
    score: 0,
    sets: 0,
  },
];

const BASE_SET_TARGET = 25;
const DECIDING_SET_TARGET = 15;
const MAX_SETS_TO_WIN = 3;

// Modifikasi tema agar background solid Merah / Biru dan Teks Putih
const getTeamSideTheme = (teamIndex: TeamIndex) => {
  if (teamIndex === 0) {
    return {
      outer: "border-red-700 bg-red-600 shadow-red-900/20 text-white",
      headerBorder: "border-red-500/50",
      scoreBorder: "border-red-400/40 bg-red-700/50",
      scoreAccent: "text-red-200",
      shortNameText: "text-white bg-red-800 border-red-400/30",
      setCountText: "text-white bg-red-800",
      scoreText: "text-white",
      inputText: "text-white placeholder-red-300 focus:bg-red-700/50"
    };
  }

  return {
    outer: "border-blue-700 bg-blue-600 shadow-blue-900/20 text-white",
    headerBorder: "border-blue-500/50",
    scoreBorder: "border-blue-400/40 bg-blue-700/50",
    scoreAccent: "text-blue-200",
    shortNameText: "text-white bg-blue-800 border-blue-400/30",
    setCountText: "text-white bg-blue-800",
    scoreText: "text-white",
    inputText: "text-white placeholder-blue-300 focus:bg-blue-700/50"
  };
};

export default function Home() {
  const [teams, setTeams] = useState<[Team, Team]>(initialTeams);
  const [viewMode, setViewMode] = useState<ViewMode>("large");
  const [matchFinished, setMatchFinished] = useState(false);

  // Menentukan index tim kiri dan kanan berdasarkan jumlah set (automatis tukar lapangan)
  const totalSetsPlayed = teams[0].sets + teams[1].sets;
  const isCourtSwapped = totalSetsPlayed % 2 === 1;
  const leftTeamIndex: TeamIndex = isCourtSwapped ? 1 : 0;
  const rightTeamIndex: TeamIndex = leftTeamIndex === 0 ? 1 : 0;

  const leftTeam = teams[leftTeamIndex];
  const rightTeam = teams[rightTeamIndex];
  const leftTheme = getTeamSideTheme(leftTeamIndex);
  const rightTheme = getTeamSideTheme(rightTeamIndex);

  // Menentukan Target Skor Dinamis Berdasarkan Set saat ini & Aturan Deuce
  const currentSetTarget = useMemo(() => {
    const isDecidingSet = (teams[0].sets === MAX_SETS_TO_WIN - 1) && (teams[1].sets === MAX_SETS_TO_WIN - 1);
    const baseTarget = isDecidingSet ? DECIDING_SET_TARGET : BASE_SET_TARGET;
    
    const score0 = teams[0].score;
    const score1 = teams[1].score;

  if (score0 >= baseTarget - 1 && score1 >= baseTarget - 1) {
      return Math.max(score0, score1) + (Math.abs(score0 - score1) === 0 ? 2 : 1);
    }
    return baseTarget;
  }, [teams]);

  // Mutator Data Tim
  const updateTeam = useCallback((index: TeamIndex, updater: (team: Team) => Team) => {
    setTeams((prev) => {
      const next = [...prev];
      next[index] = updater(next[index]);
      return next as [Team, Team];
    });
  }, []);

  // Tambah Poin & Logika Otomatis Pindah Set / Selesai Game
  const addPoint = useCallback((index: TeamIndex) => {
    if (matchFinished) return;

    setTeams((prev) => {
      const next = [...prev];
      const targetTeam = { ...next[index] };
      const opponentTeam = next[1 - index];
      
      const nextScore = targetTeam.score + 1;

      // Cek apakah tim memenuhi syarat menang set (mencapai target & selisih minimal 2)
      if (nextScore >= currentSetTarget && nextScore - opponentTeam.score >= 2) {
        const updatedSets = targetTeam.sets + 1;

        if (updatedSets >= MAX_SETS_TO_WIN) {
          setMatchFinished(true);
          targetTeam.score = nextScore;
          targetTeam.sets = updatedSets;
          next[index] = targetTeam;
          return next as [Team, Team];
        }

        // Reset skor untuk set berikutnya, akumulasikan poin menang set
        return [
          { ...prev[0], score: 0, sets: index === 0 ? prev[0].sets + 1 : prev[0].sets },
          { ...prev[1], score: 0, sets: index === 1 ? prev[1].sets + 1 : prev[1].sets },
        ] as [Team, Team];
      }

      targetTeam.score = nextScore;
      next[index] = targetTeam;
      return next as [Team, Team];
    });
  }, [currentSetTarget, matchFinished]);

  // Kurangi Poin Terkunci Batas Bawah Nol
  const removePoint = useCallback((index: TeamIndex) => {
    if (matchFinished) return;
    updateTeam(index, (t) => ({ ...t, score: Math.max(0, t.score - 1) }));
  }, [matchFinished, updateTeam]);

  const resetAllBoard = () => {
    setTeams(initialTeams);
    setMatchFinished(false);
  };

  return (
    <main className={`min-h-screen px-4 py-4 sm:p-6 antialiased font-sans transition-colors duration-300 ${viewMode === "large" ? "bg-slate-900" : "bg-slate-950"}`}>
      <div className="mx-auto max-w-7xl flex flex-col min-h-[calc(100vh-3rem)] gap-4">
        
        {/* UPPER CONSOLE BAR */}
        <header className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4 shadow-xl transition-colors duration-300 bg-slate-800/95 border-slate-700 shadow-black/20`}>
          <div className="flex items-center gap-4">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-500 shadow-md">
              <span className="text-2xl font-black text-slate-950">V</span>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-wider uppercase text-white">
                Pordes Volly Jomblang 2026
              </h1>
              <div className="flex flex-wrap items-center gap-3 mt-0.5 text-sm text-slate-400">
                {matchFinished ? (
                  <span className="text-red-500 font-black animate-pulse">MATCH FINISHED</span>
                ) : (
                  <span className="text-slate-300">SET TARGET: <strong className="text-yellow-400 font-black">{currentSetTarget} POIN</strong></span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-xl p-1 border bg-slate-950 border-slate-700">
              {(["large", "compact"] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`rounded-lg px-4 py-1.5 text-xs font-black uppercase tracking-widest transition-all ${
                    viewMode === mode
                      ? "bg-slate-800 text-yellow-400 shadow-inner border border-slate-700"
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
              className="rounded-xl border-2 border-red-500 bg-red-500/10 px-5 py-1.5 text-xs font-black uppercase tracking-wider text-red-400 transition hover:bg-red-500 hover:text-white"
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
            <div className="w-full max-w-5xl rounded-3xl border-2 border-slate-800 bg-slate-900 p-4 shadow-2xl">
              <div className="grid grid-cols-[1fr_auto_auto_auto_1fr] items-stretch overflow-hidden rounded-2xl border-2 border-slate-800 bg-black">
                
                {/* Tim Kiri Panel */}
                <div className={`flex items-center gap-4 px-6 py-4 ${leftTeamIndex === 0 ? "bg-red-600" : "bg-blue-600"} border-r border-black/20`}>
                  <input
                    value={leftTeam.name}
                    onChange={(e) => updateTeam(leftTeamIndex, (t) => ({ ...t, name: e.target.value }))}
                    className="w-full bg-transparent text-xl font-black uppercase tracking-wide text-white outline-none"
                  />
                </div>

                {/* Skor Kiri Click Target */}
                <button
                  type="button"
                  onClick={() => addPoint(leftTeamIndex)}
                  className={`${leftTeamIndex === 0 ? "bg-red-700 hover:bg-red-800" : "bg-blue-700 hover:bg-blue-800"} px-10 text-center transition border-r border-black/20 text-white`}
                >
                  <span className="font-mono text-7xl font-black tabular-nums tracking-tighter block py-2">{leftTeam.score}</span>
                </button>

                {/* Pusat Divider Informasi */}
                <div className="flex flex-col items-center justify-center bg-slate-950 px-8 min-w-32 text-center">
                  <div className="flex items-center gap-2 bg-slate-900 px-3 py-1 rounded-md border border-slate-800">
                    <span className="text-xl font-black font-mono text-red-500">{leftTeam.sets}</span>
                    <span className="text-[10px] font-black text-slate-500 tracking-wider">SETS</span>
                    <span className="text-xl font-black font-mono text-blue-500">{rightTeam.sets}</span>
                  </div>
                </div>

                {/* Skor Kanan Click Target */}
                <button
                  type="button"
                  onClick={() => addPoint(rightTeamIndex)}
                  className={`${rightTeamIndex === 0 ? "bg-red-700 hover:bg-red-800" : "bg-blue-700 hover:bg-blue-800"} px-10 text-center transition border-l border-black/20 text-white`}
                >
                  <span className="font-mono text-7xl font-black tabular-nums tracking-tighter block py-2">{rightTeam.score}</span>
                </button>

                {/* Tim Kanan Panel */}
                <div className={`flex items-center justify-end gap-4 px-6 py-4 ${rightTeamIndex === 0 ? "bg-red-600" : "bg-blue-600"} border-l border-black/20`}>
                  <input
                    value={rightTeam.name}
                    onChange={(e) => updateTeam(rightTeamIndex, (t) => ({ ...t, name: e.target.value }))}
                    className="w-full bg-transparent text-right text-xl font-black uppercase tracking-wide text-white outline-none"
                  />
                </div>

              </div>

              {/* Quick Controller Footer di Compact Mode */}
              <div className="flex items-center justify-between mt-4 px-2">
                <div className="flex gap-2">
                  <button onClick={() => addPoint(leftTeamIndex)} className="text-xs font-bold bg-emerald-500 text-slate-950 px-4 py-2 rounded-xl">+ KIRI</button>
                  <button onClick={() => removePoint(leftTeamIndex)} className="text-xs font-bold bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl border border-white/10">- KIRI</button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => removePoint(rightTeamIndex)} className="text-xs font-bold bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl border border-white/10">- KANAN</button>
                  <button onClick={() => addPoint(rightTeamIndex)} className="text-xs font-bold bg-emerald-500 text-slate-950 px-4 py-2 rounded-xl">+ KANAN</button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ==========================================
            VIEW MODE 2: LARGE FIELD CONSOLE
            ========================================== */}
        {viewMode === "large" && (
          <section className="grid flex-1 gap-6 md:grid-cols-2 items-stretch">
            
            {/* PANEL TIM KIRI */}
            <article className={`flex flex-col justify-between rounded-3xl border-2 p-6 shadow-2xl transition-all ${leftTheme.outer}`}>
              <div className={`flex items-center justify-between gap-4 border-b pb-4 ${leftTheme.headerBorder}`}>
                <input
                  value={leftTeam.name}
                  onChange={(e) => updateTeam(leftTeamIndex, (t) => ({ ...t, name: e.target.value }))}
                  className={`bg-transparent text-4xl font-black uppercase tracking-wide outline-none rounded px-2 py-1 w-full transition-all ${leftTheme.inputText}`}
                />
                <div className={`border px-4 py-1.5 rounded-xl font-mono text-xl font-black shadow-inner border-none ${leftTheme.shortNameText}`}>
                  {leftTeam.shortName}
                </div>
              </div>

              {/* SCORE BOX (ANGKA BESAR PUTIH) */}
              <div className="my-4 flex-1 flex flex-col justify-center">
                <div 
                  onClick={() => addPoint(leftTeamIndex)}
                  className={`cursor-pointer rounded-3xl border-2 p-6 text-center shadow-inner transition-all hover:bg-black/10 active:scale-[0.98] ${leftTheme.scoreBorder}`}
                >
                  <div className={`text-[14rem] sm:text-[22rem] font-black font-mono tracking-tighter leading-none ${leftTheme.scoreText}`}>
                    {leftTeam.score}
                  </div>
                  <span className={`text-sm font-bold tracking-[0.4em] block mt-2 uppercase ${leftTheme.scoreAccent}`}>TAP UNTUK TAMBAH SKOR</span>
                </div>
              </div>

              {/* KONTROL EDIT BAWAH */}
              <div className={`border-t ${leftTheme.headerBorder} pt-4 flex flex-wrap items-center justify-between gap-4`}>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => addPoint(leftTeamIndex)}
                    className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-8 py-4 text-base font-black shadow-md active:scale-95 transition-all"
                  >
                    POIN (+1)
                  </button>
                  <button
                    type="button"
                    onClick={() => removePoint(leftTeamIndex)}
                    className="rounded-xl bg-black/30 border border-black/20 hover:bg-black/40 px-5 py-4 text-sm font-black text-white shadow-sm active:scale-95 transition-all"
                  >
                    KURANG (-1)
                  </button>
                </div>

                <div className={`px-6 py-2.5 rounded-2xl text-center min-w-32 border-none shadow-inner ${leftTheme.setCountText}`}>
                  <span className="text-[11px] font-bold tracking-[0.35em] text-white/70 block uppercase">SET WIN</span>
                  <span className="text-5xl font-black font-mono leading-none block mt-1 text-white">{leftTeam.sets}</span>
                </div>
              </div>
            </article>

            {/* PANEL TIM KANAN */}
            <article className={`flex flex-col justify-between rounded-3xl border-2 p-6 shadow-2xl transition-all ${rightTheme.outer}`}>
              <div className={`flex items-center justify-between gap-4 border-b pb-4 ${rightTheme.headerBorder}`}>
                <input
                  value={rightTeam.name}
                  onChange={(e) => updateTeam(rightTeamIndex, (t) => ({ ...t, name: e.target.value }))}
                  className={`bg-transparent text-4xl font-black uppercase tracking-wide outline-none rounded px-2 py-1 w-full transition-all ${rightTheme.inputText}`}
                />
                <div className={`border px-4 py-1.5 rounded-xl font-mono text-xl font-black shadow-inner border-none ${rightTheme.shortNameText}`}>
                  {rightTeam.shortName}
                </div>
              </div>

              {/* SCORE BOX (ANGKA BESAR PUTIH) */}
              <div className="my-4 flex-1 flex flex-col justify-center">
                <div 
                  onClick={() => addPoint(rightTeamIndex)}
                  className={`cursor-pointer rounded-3xl border-2 p-6 text-center shadow-inner transition-all hover:bg-black/10 active:scale-[0.98] ${rightTheme.scoreBorder}`}
                >
                  <div className={`text-[14rem] sm:text-[22rem] font-black font-mono tracking-tighter leading-none ${rightTheme.scoreText}`}>
                    {rightTeam.score}
                  </div>
                  <span className={`text-sm font-bold tracking-[0.4em] block mt-2 uppercase ${rightTheme.scoreAccent}`}>TAP UNTUK TAMBAH SKOR</span>
                </div>
              </div>

              {/* KONTROL EDIT BAWAH */}
              <div className={`border-t ${rightTheme.headerBorder} pt-4 flex flex-wrap items-center justify-between gap-4`}>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => addPoint(rightTeamIndex)}
                    className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-8 py-4 text-base font-black shadow-md active:scale-95 transition-all"
                  >
                    POIN (+1)
                  </button>
                  <button
                    type="button"
                    onClick={() => removePoint(rightTeamIndex)}
                    className="rounded-xl bg-black/30 border border-black/20 hover:bg-black/40 px-5 py-4 text-sm font-black text-white shadow-sm active:scale-95 transition-all"
                  >
                    KURANG (-1)
                  </button>
                </div>

                <div className={`px-6 py-2.5 rounded-2xl text-center min-w-32 border-none shadow-inner ${rightTheme.setCountText}`}>
                  <span className="text-[11px] font-bold tracking-[0.35em] text-white/70 block uppercase">SET WIN</span>
                  <span className="text-5xl font-black font-mono leading-none block mt-1 text-white">{rightTeam.sets}</span>
                </div>
              </div>
            </article>

          </section>
        )}

      </div>
    </main>
  );
}