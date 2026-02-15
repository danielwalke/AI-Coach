import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import ProgressChart from './ProgressChart';
import { Activity, Clock, Trophy, X, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { TrainingSession } from '../../types/api';
import GlassCard from '../../components/ui/GlassCard';
import StatCard from '../../components/ui/StatCard';

const Dashboard: React.FC = () => {
    const { user, sessions } = useData();
    const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);

    // Stats Calculations - moved before conditional return to satisfy Rules of Hooks.
    // Note: checks for user/sessions availability are done inside or gracefully handled.
    const streak = React.useMemo(() => {
        if (!sessions || sessions.length === 0) return 0;
        const sortedDates = [...new Set(sessions.map(s => new Date(s.date).toDateString()))]
            .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

        if (sortedDates.length === 0) return 0;
        const today = new Date().toDateString();
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterday = yesterdayDate.toDateString();

        if (sortedDates[0] !== today && sortedDates[0] !== yesterday) return 0;
        let streakCount = 1;
        let currentDate = new Date(sortedDates[0]);

        for (let i = 1; i < sortedDates.length; i++) {
            const prevDate = new Date(sortedDates[i]);
            const diffTime = Math.abs(currentDate.getTime() - prevDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
                streakCount++;
                currentDate = prevDate;
            } else {
                break;
            }
        }
        return streakCount;
    }, [sessions]);

    if (!user) return null;

    const totalSessions = sessions.length;
    const totalDurationSeconds = sessions.reduce((acc, curr) => acc + curr.duration_seconds, 0);
    const totalDurationHours = (totalDurationSeconds / 3600).toFixed(1);

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

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
                <StatCard
                    title="Current Streak"
                    value={streak}
                    unit="days"
                    icon={Trophy}
                    iconColor="text-yellow-500"
                    trend="Keep it up!"
                    trendUp={true}
                    className="col-span-2"
                />
                <StatCard
                    title="Workouts"
                    value={totalSessions}
                    icon={Activity}
                    iconColor="text-primary"
                />
                <StatCard
                    title="Hours"
                    value={totalDurationHours}
                    icon={Clock}
                    iconColor="text-green-500"
                />
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
                                    <div className="font-bold text-text text-lg">{new Date(session.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
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
