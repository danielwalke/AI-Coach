import React from 'react';
import { useData } from '../../context/DataContext';
import ProgressChart from './ProgressChart';
import { Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import GlassCard from '../../components/ui/GlassCard';

const Dashboard: React.FC = () => {
    const { user, streak, level, currentXP, nextLevelXP, totalXP } = useData();

    // Stats Grid
    if (!user) return null;

    // Calculate percent for progress bar
    const xpPercent = Math.min(100, Math.max(0, (currentXP / nextLevelXP) * 100));

    // Calculate motivation percentile
    // Use real backend percentile if available, otherwise 0
    const betterThanPercent = user.xp_percentile || 0;

    return (
        <div className="flex flex-col gap-4 pb-4 pt-4 px-2 max-w-2xl mx-auto">
            <header className="flex justify-between items-center px-2">
                <div>
                    <h1 className="text-3xl font-extrabold text-text tracking-tight">Summary</h1>
                    <p className="text-base text-muted font-medium mt-1 uppercase tracking-wide opacity-80">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                </div>
                <Link to="/profile" className="transition-transform hover:scale-105 active:scale-95">
                    <div className="w-10 h-10 rounded-full bg-surface-highlight flex items-center justify-center text-primary text-lg font-bold shadow-sm">
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                </Link>
            </header>

            {/* Gamification Stats */}
            <div className="grid grid-cols-2 gap-4">
                <div className="card text-center p-4 relative overflow-hidden bg-surface border border-border flex flex-col items-center justify-center shadow-sm">
                    <div className="text-3xl mb-1 animate-bounce">🔥</div>
                    <div className="font-black text-2xl text-text">{streak}</div>
                    <div className="text-[10px] text-muted uppercase font-bold tracking-wider">Day Streak</div>
                </div>
                <div className="card text-center p-4 bg-surface border border-border flex flex-col items-center justify-center shadow-sm">
                    <div className="text-3xl mb-1">🏆</div>
                    <div className="font-black text-2xl text-text">{level}</div>
                    <div className="text-[10px] text-muted uppercase font-bold tracking-wider">Level</div>
                </div>
            </div>

            <div className="card p-4 bg-surface border border-border shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-end mb-2 relative z-10">
                    <div>
                        <div className="text-[10px] text-muted uppercase font-bold tracking-wider mb-1">Total XP</div>
                        <div className="font-black text-3xl text-text">{totalXP.toLocaleString()}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-primary font-bold">{currentXP} / {nextLevelXP} XP</div>
                        <div className="text-[10px] text-muted font-medium">to next level</div>
                    </div>
                </div>
                <div className="w-full h-2 bg-surface-highlight rounded-full overflow-hidden relative z-10">
                    <div className="h-full bg-gradient-to-r from-primary to-yellow-500 transition-all duration-1000 ease-out" style={{ width: `${xpPercent}%` }}></div>
                </div>
                <div className="absolute top-0 right-0 opacity-5 text-[100px] leading-none pointer-events-none">⚡</div>
            </div>

            {/* Motivation Banner */}
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-4 shadow-lg shadow-indigo-500/20 relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 opacity-10 transform group-hover:scale-110 transition-transform duration-700 rotate-12">
                    <Trophy size={120} />
                </div>
                <div className="relative z-10">
                    <p className="text-white/70 text-[10px] font-bold uppercase tracking-wider mb-1">Performance Insight</p>
                    <div className="text-white">
                        <div className="flex flex-wrap items-baseline gap-x-2 mb-1">
                            <span className="text-lg font-bold">You are better than</span>
                            <span className="text-3xl font-black text-yellow-300 tracking-tight">{betterThanPercent}%</span>
                            <span className="text-lg font-bold">of all users</span>
                        </div>
                        <p className="text-white/80 text-xs font-medium max-w-[80%]">
                            Your dedication is paying off! Keep training to reach the top tier.
                        </p>
                    </div>
                </div>
            </div>

            <section>
                <div className="px-2 mb-3">
                    <h2 className="text-xl font-bold text-text tracking-tight">Progress</h2>
                </div>
                <GlassCard className="p-4">
                    <ProgressChart />
                </GlassCard>
            </section>
        </div>
    );
};

export default Dashboard;

