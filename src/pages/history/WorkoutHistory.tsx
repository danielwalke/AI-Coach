import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { X, ChevronRight, Trash2, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { TrainingSession } from '../../types/api';
import GlassCard from '../../components/ui/GlassCard';

const WorkoutHistory: React.FC = () => {
    const { sessions, deleteSession, calculateSessionXP } = useData();
    const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);



    const handleDelete = async (e: React.MouseEvent, sessionId: number) => {
        e.stopPropagation();
        if (deletingId === sessionId) {
            // Second click = confirm
            await deleteSession(sessionId);
            setDeletingId(null);
            if (selectedSession?.id === sessionId) setSelectedSession(null);
        } else {
            setDeletingId(sessionId);
            // Auto-reset confirmation after 3s
            setTimeout(() => setDeletingId(prev => prev === sessionId ? null : prev), 3000);
        }
    };

    return (
        <div className="flex flex-col gap-6 pb-32 pt-8 px-2 max-w-2xl mx-auto">
            <header className="px-2">
                <h1 className="text-3xl font-extrabold text-text tracking-tight">Workout History</h1>
                <p className="text-base text-muted font-medium mt-1 uppercase tracking-wide opacity-80">
                    {sessions.length} workout{sessions.length !== 1 ? 's' : ''} logged
                </p>
            </header>

            {sessions.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center border-dashed border-2 border-border rounded-2xl bg-surface/50">
                    <Clock size={48} className="text-muted/30 mb-4" />
                    <p className="text-muted mb-4 font-medium">No workouts yet</p>
                    <Link to="/training" className="btn btn-primary shadow-lg shadow-primary/30">Start your first session</Link>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {[...sessions].reverse().map(session => (
                        <GlassCard
                            key={session.id}
                            className="p-5 flex justify-between items-center group active:scale-[0.99] shrink-0"
                            onClick={() => setSelectedSession(session)}
                        >
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <div className="font-bold text-text text-lg">
                                        {new Date(session.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                    </div>
                                    <span className="text-[10px] font-bold bg-yellow-500/10 text-yellow-600 px-1.5 py-0.5 rounded border border-yellow-500/20">
                                        +{calculateSessionXP(session)} XP
                                    </span>
                                </div>
                                <div className="text-xs text-muted font-medium uppercase tracking-wide">
                                    {session.exercises.length} Exercises • {Math.floor(session.duration_seconds / 60)} min
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={(e) => handleDelete(e, session.id)}
                                    className={`p-2 rounded-full transition-colors ${deletingId === session.id
                                        ? 'bg-red-500/20 text-red-500 scale-110'
                                        : 'bg-surface-highlight text-muted opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-500'
                                        }`}
                                    title={deletingId === session.id ? 'Click again to confirm' : 'Delete workout'}
                                >
                                    <Trash2 size={16} />
                                </button>
                                <div className="p-2 rounded-full bg-surface-highlight text-muted group-hover:text-primary transition-colors">
                                    <ChevronRight size={18} />
                                </div>
                            </div>
                        </GlassCard>
                    ))}
                </div>
            )}

            {/* Details Modal */}
            {selectedSession && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-surface w-full max-w-lg max-h-[85vh] rounded-3xl flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in duration-300 ring-1 ring-black/5">
                        <div className="p-5 border-b border-border flex justify-between items-center bg-surface sticky top-0 z-10">
                            <div>
                                <h2 className="text-xl font-bold text-text">Workout Details</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <p className="text-xs text-muted font-medium uppercase tracking-wide">{new Date(selectedSession.date).toLocaleString()}</p>
                                    <span className="text-muted">•</span>
                                    <p className="text-xs text-primary font-bold uppercase tracking-wide">
                                        ⏱️ {Math.floor(selectedSession.duration_seconds / 60)}m {selectedSession.duration_seconds % 60}s
                                    </p>
                                </div>
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
                                        {ex.exercise.name}
                                    </h3>
                                    <div className="flex flex-col gap-0">
                                        {ex.sets.map((set, j) => (
                                            <React.Fragment key={j}>
                                                {set.rest_seconds !== undefined && set.rest_seconds > 0 && (
                                                    <div className="flex justify-center -my-2 relative z-10">
                                                        <span className="bg-surface px-2 text-[10px] font-bold text-orange-500 border border-orange-500/30 rounded-full py-0.5 flex items-center gap-1 shadow-sm">
                                                            <span>🛑</span>
                                                            Rest: {Math.floor(set.rest_seconds / 60)}:{String(set.rest_seconds % 60).padStart(2, '0')}
                                                        </span>
                                                    </div>
                                                )}

                                                <div className="flex justify-between items-center text-sm border border-border p-3 rounded-xl bg-surface mb-2 relative z-0">
                                                    <div className="flex items-center gap-4">
                                                        <span className="w-6 h-6 rounded-full bg-surface-highlight flex items-center justify-center text-xs font-bold text-muted">{j + 1}</span>
                                                        <span className={`font-medium ${set.completed ? 'text-text' : 'text-muted'}`}>{set.weight} kg <span className="text-muted mx-1">x</span> {set.reps}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {set.set_duration !== undefined && set.set_duration > 0 && (
                                                            <span className="text-[10px] text-blue-500 font-mono bg-blue-500/10 px-2 py-0.5 rounded flex items-center gap-1" title="Set Duration">
                                                                <span>⏱️</span>
                                                                {Math.floor(set.set_duration / 60)}:{String(set.set_duration % 60).padStart(2, '0')}
                                                            </span>
                                                        )}
                                                        {set.completed && <div className="text-primary text-[10px] font-bold bg-primary/10 px-2 py-1 rounded-full">DONE</div>}
                                                    </div>
                                                </div>
                                            </React.Fragment>
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

export default WorkoutHistory;
