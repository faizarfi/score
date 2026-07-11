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

const getTeamSideTheme = (teamIndex: TeamIndex) => {
  if (teamIndex === 0) {
    return {
      outer: "border-rose-500 bg-rose-950/80",
      headerBorder: "border-rose-800",
      scoreBorder: "border-rose-500/30",
      scoreAccent: "text-rose-400/60",
      shortNameText: "text-rose-300",
      setCountText: "text-rose-400",
    };
  }

  return {
    outer: "border-blue-500 bg-blue-950/80",
    headerBorder: "border-blue-800",
    scoreBorder: "border-blue-500/30",
    scoreAccent: "text-cyan-400/60",
    shortNameText: "text-blue-300",
    setCountText: "text-blue-400",
  };
};

export default function Home() {
  const [teams, setTeams] = useState<[Team, Team]>(initialTeams);
  const [viewMode, setViewMode] = useState<ViewMode>("large");
  const [matchFinished, setMatchFinished] = useState(false);

  // Menentukan index tim kiri dan kanan berdasarkan jumlah set (otomatis tukar lapangan)
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
    <main className="min-h-screen bg-slate-950 px-4 py-4 sm:p-6 text-slate-100 antialiased font-sans">
      <div className="mx-auto max-w-7xl flex flex-col min-h-[calc(100vh-3rem)] gap-4">
        
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
                {matchFinished ? (
                  <span className="text-red-500 font-black animate-pulse">MATCH FINISHED</span>
                ) : (
                  <span>SET TARGET: <strong className="text-emerald-400 font-black">{currentSetTarget} POIN</strong></span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-xl bg-black p-1 border border-white/10">
              {(["large", "compact"] as ViewMode[]).map((mode) => (
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
              <div className="grid grid-cols-[1fr_auto_auto_auto_1fr] items-stretch overflow-hidden rounded-2xl border-2 border-white/10 bg-black">
                
                {/* Tim Kiri Panel */}
                <div className={`flex items-center gap-4 px-6 py-4 ${leftTeamIndex === 0 ? "bg-rose-950/40" : "bg-blue-950/40"} border-r border-white/5`}>
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
                  className="bg-slate-900 px-8 text-center transition hover:bg-slate-800 border-r border-white/5 text-white"
                >
                  <span className="font-mono text-6xl font-black tabular-nums tracking-tighter block">{leftTeam.score}</span>
                </button>

                {/* Pusat Divider Informasi */}
                <div className="flex flex-col items-center justify-center bg-black px-8 min-w-32 text-center">
                  <div className="flex items-center gap-2 bg-slate-900 px-3 py-1 rounded-md border border-white/10">
                    <span className={`text-xl font-black font-mono ${leftTheme.setCountText}`}>{leftTeam.sets}</span>
                    <span className="text-[10px] font-black text-slate-500 tracking-wider">SETS</span>
                    <span className={`text-xl font-black font-mono ${rightTheme.setCountText}`}>{rightTeam.sets}</span>
                  </div>
                </div>

                {/* Skor Kanan Click Target */}
                <button
                  type="button"
                  onClick={() => addPoint(rightTeamIndex)}
                  className="bg-slate-900 px-8 text-center transition hover:bg-slate-800 border-l border-white/5 text-white"
                >
                  <span className="font-mono text-6xl font-black tabular-nums tracking-tighter block">{rightTeam.score}</span>
                </button>

                {/* Tim Kanan Panel */}
                <div className={`flex items-center justify-end gap-4 px-6 py-4 ${rightTeamIndex === 0 ? "bg-rose-950/40" : "bg-blue-950/40"} border-l border-white/5`}>
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
                  <button onClick={() => removePoint(leftTeamIndex)} className="text-xs font-bold bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl border border-white/10">- KIRI</button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => removePoint(rightTeamIndex)} className="text-xs font-bold bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl border border-white/10">- KANAN</button>
                  <button onClick={() => addPoint(rightTeamIndex)} className="text-xs font-bold bg-emerald-500 text-slate-950 px-4 py-2 rounded-xl">+ KANAN</button>
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
            
            {/* PANEL TIM KIRI */}
            <article className={`flex flex-col justify-between rounded-3xl border-4 p-6 shadow-xl ${leftTheme.outer}`}>
              <div className={`flex items-center justify-between gap-4 border-b-2 pb-4 ${leftTheme.headerBorder}`}>
                <input
                  value={leftTeam.name}
                  onChange={(e) => updateTeam(leftTeamIndex, (t) => ({ ...t, name: e.target.value }))}
                  className="bg-transparent text-3xl font-black uppercase tracking-wide text-white outline-none focus:bg-black/30 rounded px-2 py-1 w-full"
                />
                <div className={`bg-black/40 border border-white/10 px-4 py-1.5 rounded-xl font-mono text-lg font-black ${leftTheme.shortNameText}`}>
                  {leftTeam.shortName}
                </div>
              </div>

              {/* SCORE BOX */}
              <div className="my-4 flex-1 flex flex-col justify-center">
                <div 
                  onClick={() => addPoint(leftTeamIndex)}
                  className={`cursor-pointer rounded-2xl bg-black border-2 p-8 text-center shadow-2xl transition hover:border-white/40 active:bg-slate-900 ${leftTheme.scoreBorder}`}
                >
                  <div className="text-[12rem] sm:text-[16rem] font-black font-mono tracking-tighter leading-none text-white">
                    {leftTeam.score}
                  </div>
                  <span className={`text-xs font-black tracking-[0.4em] block mt-2 uppercase ${leftTheme.scoreAccent}`}>TAP UNTUK TAMBAH SKOR</span>
                </div>
              </div>

              {/* KONTROL EDIT BAWAH */}
              <div className="border-t-2 border-white/10 pt-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => addPoint(leftTeamIndex)}
                    className="rounded-xl bg-emerald-500 text-slate-950 px-6 py-3 text-sm font-black shadow-lg"
                  >
                    POIN (+1)
                  </button>
                  <button
                    type="button"
                    onClick={() => removePoint(leftTeamIndex)}
                    className="rounded-xl bg-slate-900 border border-white/20 px-4 py-3 text-xs font-black text-slate-300"
                  >
                    KURANG (-1)
                  </button>
                </div>

                <div className="bg-black px-6 py-3 rounded-2xl border border-white/10 text-center min-w-28 shadow-lg">
                  <span className="text-[11px] font-black tracking-[0.35em] text-slate-300 block uppercase">SET WIN</span>
                  <span className={`text-5xl font-black font-mono leading-none block mt-1 ${leftTheme.setCountText}`}>{leftTeam.sets}</span>
                </div>
              </div>
            </article>

            {/* SEKTOR TENGAH - INDIKATOR LAPANGAN */}
            <div className="flex flex-col items-center justify-center gap-4 py-2 min-w-48 text-center bg-black/40 border border-white/10 rounded-2xl p-4">
              <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 block">TOTAL SETS PLAYED</span>
              <p className="text-4xl font-black font-mono tracking-tight text-cyan-400 bg-black px-6 py-2 rounded-xl border border-white/5">{totalSetsPlayed}</p>
              
              <div className="text-xs font-mono mt-4 text-slate-400">
                <div className="bg-slate-900 p-2.5 rounded-lg border border-white/5">
                  <span className="font-bold block text-[10px] text-slate-500 uppercase">Selisih Poin</span>
                  <span className="font-black text-white text-base block mt-0.5">{Math.abs(leftTeam.score - rightTeam.score)} Poin</span>
                </div>
              </div>
            </div>

            {/* PANEL TIM KANAN */}
            <article className={`flex flex-col justify-between rounded-3xl border-4 p-6 shadow-xl ${rightTheme.outer}`}>
              <div className={`flex items-center justify-between gap-4 border-b-2 pb-4 ${rightTheme.headerBorder}`}>
                <input
                  value={rightTeam.name}
                  onChange={(e) => updateTeam(rightTeamIndex, (t) => ({ ...t, name: e.target.value }))}
                  className="bg-transparent text-3xl font-black uppercase tracking-wide text-white outline-none focus:bg-black/30 rounded px-2 py-1 w-full"
                />
                <div className={`bg-black/40 border border-white/10 px-4 py-1.5 rounded-xl font-mono text-lg font-black ${rightTheme.shortNameText}`}>
                  {rightTeam.shortName}
                </div>
              </div>

              {/* SCORE BOX */}
              <div className="my-4 flex-1 flex flex-col justify-center">
                <div 
                  onClick={() => addPoint(rightTeamIndex)}
                  className={`cursor-pointer rounded-2xl bg-black border-2 p-8 text-center shadow-2xl transition hover:border-white/40 active:bg-slate-900 ${rightTheme.scoreBorder}`}
                >
                  <div className="text-[12rem] sm:text-[16rem] font-black font-mono tracking-tighter leading-none text-white">
                    {rightTeam.score}
                  </div>
                  <span className={`text-xs font-black tracking-[0.4em] block mt-2 uppercase ${rightTheme.scoreAccent}`}>TAP UNTUK TAMBAH SKOR</span>
                </div>
              </div>

              {/* KONTROL EDIT BAWAH */}
              <div className="border-t-2 border-white/10 pt-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => addPoint(rightTeamIndex)}
                    className="rounded-xl bg-emerald-500 text-slate-950 px-6 py-3 text-sm font-black shadow-lg"
                  >
                    POIN (+1)
                  </button>
                  <button
                    type="button"
                    onClick={() => removePoint(rightTeamIndex)}
                    className="rounded-xl bg-slate-900 border border-white/20 px-4 py-3 text-xs font-black text-slate-300"
                  >
                    KURANG (-1)
                  </button>
                </div>

                <div className="bg-black px-6 py-3 rounded-2xl border border-white/10 text-center min-w-28 shadow-lg">
                  <span className="text-[11px] font-black tracking-[0.35em] text-slate-300 block uppercase">SET WIN</span>
                  <span className={`text-5xl font-black font-mono leading-none block mt-1 ${rightTheme.setCountText}`}>{rightTeam.sets}</span>
                </div>
              </div>
            </article>

          </section>
        )}

      </div>
    </main>
  );
}