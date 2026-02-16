import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import ProgressChart from './ProgressChart';
import { X, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { TrainingSession } from '../../types/api';
import GlassCard from '../../components/ui/GlassCard';

const Dashboard: React.FC = () => {
    const { user, sessions, streak, level, currentXP, nextLevelXP } = useData();
    const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);

    // Stats Grid
    if (!user) return null;

    // Calculate percent for progress bar
    const xpPercent = Math.min(100, Math.max(0, (currentXP / nextLevelXP) * 100));

    return (
        <div className="flex flex-col gap-6 pb-32 pt-8 px-2 max-w-2xl mx-auto">
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
            <div className="grid grid-cols-3 gap-4 mb-2">
                <div className="card text-center p-4 relative overflow-hidden bg-surface border border-border flex flex-col items-center justify-center shadow-sm">
                    <div className="text-3xl mb-1 animate-bounce">🔥</div>
                    <div className="font-black text-2xl text-text">{streak}</div>
                    <div className="text-[10px] text-muted uppercase font-bold tracking-wider">Streak</div>
                </div>
                <div className="card text-center p-4 bg-surface border border-border flex flex-col items-center justify-center shadow-sm relative overflow-hidden">
                    <div className="text-3xl mb-1">⚡</div>
                    <div className="font-black text-2xl text-text">{currentXP} <span className="text-sm text-muted font-normal">/ {nextLevelXP}</span></div>
                    <div className="text-[10px] text-muted uppercase font-bold tracking-wider">Level Progress</div>
                    <div className="absolute bottom-0 left-0 w-full h-1.5 bg-gray-800">
                        <div className="h-full bg-yellow-400 transition-all duration-1000 ease-out" style={{ width: `${xpPercent}%` }}></div>
                    </div>
                </div>
                <div className="card text-center p-4 bg-surface border border-border flex flex-col items-center justify-center shadow-sm">
                    <div className="text-3xl mb-1">🏆</div>
                    <div className="font-black text-2xl text-text">{level}</div>
                    <div className="text-[10px] text-muted uppercase font-bold tracking-wider">Current Level</div>
                </div>
            </div>



            <section>
                <div className="px-2 mb-3">
                    <h2 className="text-xl font-bold text-text tracking-tight">Progress</h2>
                </div>
                <GlassCard className="p-6">
                    <ProgressChart />
                </GlassCard>
            </section>

            <section>
                <div className="flex items-center justify-between px-2 mb-3">
                    <h2 className="text-xl font-bold text-text tracking-tight">Recent Workouts</h2>
                    <Link to="/training" className="text-primary text-sm font-semibold hover:opacity-80 transition-opacity">Start New</Link>
                </div>

                {sessions.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center border-dashed border-2 border-border rounded-2xl bg-surface/50">
                        <p className="text-muted mb-4 font-medium">No workouts yet</p>
                        <Link to="/training" className="btn btn-primary shadow-lg shadow-primary/30">Start your first session</Link>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {[...sessions].reverse().slice(0, 3).map(session => (
                            <GlassCard
                                key={session.id}
                                className="p-5 flex justify-between items-center group active:scale-[0.99]"
                                onClick={() => setSelectedSession(session)}
                            >
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <div className="font-bold text-text text-lg">{new Date(session.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                                        <span className="text-[10px] font-bold bg-yellow-500/10 text-yellow-600 px-1.5 py-0.5 rounded border border-yellow-500/20">+100 XP</span>
                                    </div>
                                    <div className="text-xs text-muted font-medium uppercase tracking-wide">{session.exercises.length} Exercises • {Math.floor(session.duration_seconds / 60)} min</div>
                                </div>
                                <div className="p-2 rounded-full bg-surface-highlight text-muted group-hover:text-primary transition-colors">
                                    <ChevronRight size={18} />
                                </div>
                            </GlassCard>
                        ))}
                    </div>
                )}
            </section>

            {/* Details Modal */}
            {selectedSession && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-surface w-full max-w-lg max-h-[85vh] rounded-3xl flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in duration-300 ring-1 ring-black/5">
                        <div className="p-5 border-b border-border flex justify-between items-center bg-surface sticky top-0 z-10">
                            <div>
                                <h2 className="text-xl font-bold text-text">Workout Details</h2>
                                <p className="text-xs text-muted font-medium mt-1 uppercase tracking-wide">{new Date(selectedSession.date).toLocaleString()}</p>
                            </div>
                            <button onClick={() => setSelectedSession(null)} className="p-2 bg-surface-highlight rounded-full hover:bg-border transition-colors text-text">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto flex flex-col gap-4 bg-bg/50">
                            {selectedSession.exercises.map((ex, i) => (
                                <div key={i} className="bg-surface p-5 rounded-2xl shadow-sm border border-border">
                                    <h3 className="font-bold text-primary mb-3 text-lg flex items-center gap-2">
                                        <div className="w-1.5 h-6 rounded-full bg-primary/20"></div>
                                        {/* Use exercise name directly from nested object */}
                                        {ex.exercise.name}
                                    </h3>
                                    <div className="flex flex-col gap-3">
                                        {ex.sets.map((set, j) => (
                                            <div key={j} className="flex justify-between items-center text-sm border-b border-border last:border-none pb-3 last:pb-0">
                                                <div className="flex items-center gap-4">
                                                    <span className="w-6 h-6 rounded-full bg-surface-highlight flex items-center justify-center text-xs font-bold text-muted">{j + 1}</span>
                                                    <span className={`font-medium ${set.completed ? 'text-text' : 'text-muted'}`}>{set.weight} kg <span className="text-muted mx-1">x</span> {set.reps}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {set.rest_seconds !== undefined && set.rest_seconds > 0 && (
                                                        <span className="text-[10px] text-orange-500 font-mono bg-orange-500/10 px-2 py-0.5 rounded">
                                                            Rest: {Math.floor(set.rest_seconds / 60)}:{String(set.rest_seconds % 60).padStart(2, '0')}
                                                        </span>
                                                    )}
                                                    {set.completed && <div className="text-primary text-[10px] font-bold bg-primary/10 px-2 py-1 rounded-full">DONE</div>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
