import React, { useState } from 'react';
import { Play, Plus, Trash2, Save, Clock, X, PlusCircle, StopCircle, Dumbbell, Trophy, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { useWorkout } from '../../context/WorkoutContext';
import ExerciseSelector from './ExerciseSelector';
import TemplateSelector from './TemplateSelector';
import type { WorkoutTemplate } from '../../types/api';

interface WorkoutSummary {
    duration: number;
    exerciseCount: number;
    totalSets: number;
    quote: string;
}

const ActiveSession: React.FC = () => {
    const { exercises: allExercises } = useData();
    const {
        isActive,
        elapsedTime,
        sessionExercises,
        timerMode,
        modeTimer,
        templateName,
        motivationalQuote,
        toggleTimerMode,
        startSession,
        startFromTemplate,
        finishSession,
        cancelSession,
        addExercise,
        removeExercise,
        addSet,
        updateSet,
        removeSet
    } = useWorkout();

    const navigate = useNavigate();
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);
    const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
    const [summary, setSummary] = useState<WorkoutSummary | null>(null);
    const [isFinishing, setIsFinishing] = useState(false);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getExerciseName = (id: number) => {
        return allExercises.find(e => e.id === id)?.name || 'Unknown Exercise';
    };

    const handleFinish = async () => {
        setIsFinishing(true);
        const totalSets = sessionExercises.reduce((sum, ex) => sum + ex.sets.length, 0);

        setSummary({
            duration: elapsedTime,
            exerciseCount: sessionExercises.length,
            totalSets,
            quote: motivationalQuote || "Great workout! Keep it up! 💪",
        });

        // Trigger confetti
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#6366f1', '#f43f5e', '#eab308', '#22c55e']
        });

        await finishSession();
        setIsFinishing(false);
    };

    const dismissSummary = () => {
        setSummary(null);
        navigate('/dashboard');
    };

    // ===== WORKOUT SUMMARY MODAL =====
    if (summary) {
        return (
            <div className="flex flex-col items-center justify-center h-[75vh] px-4">
                <div className="w-full max-w-sm text-center">
                    {/* Trophy animation */}
                    <div className="mb-6 relative w-fit mx-auto">
                        <Trophy size={80} className="text-yellow-500 animate-bounce drop-shadow-lg" />
                        <div className="absolute -top-4 -right-10 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse shadow-md">
                            NEW RECORD!
                        </div>
                    </div>

                    <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-600 mb-6 drop-shadow-sm">
                        Workout Complete!
                    </h2>

                    <div className="flex justify-center gap-4 mb-8 text-sm font-bold text-muted uppercase tracking-wider">
                        <span>{formatTime(summary.duration)}</span>
                        <span>•</span>
                        <span>{summary.exerciseCount} Exercises</span>
                        <span>•</span>
                        <span>{summary.totalSets} Sets</span>
                    </div>

                    {/* MOIVATIONAL QUOTE - HIGH VISIBILITY */}
                    <div className="rounded-2xl p-6 mb-8 border-2 border-primary shadow-2xl relative z-50 transform hover:scale-105 transition-transform duration-300 bg-surface"
                    >
                        <p className="text-xl text-text font-serif italic leading-relaxed font-bold">
                            "{summary.quote}"
                        </p>
                        <p className="text-sm text-primary mt-3 font-bold tracking-widest uppercase">— AI Coach</p>
                    </div>

                    {/* XP Gained Badge */}
                    <div className="mb-10 animate-bounce delay-100 dark:text-yellow-400 text-yellow-600 font-black text-3xl flex items-center justify-center gap-2 bg-surface-highlight py-3 px-6 rounded-full mx-auto w-fit shadow-md border border-yellow-500/30">
                        <span>⚡</span>
                        <span>+100 XP</span>
                    </div>

                    <button
                        onClick={dismissSummary}
                        className="btn btn-primary text-xl px-12 py-4 flex items-center justify-center gap-3 mx-auto shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all w-full font-bold relative z-50"
                    >
                        Continue <ArrowRight size={24} />
                    </button>
                </div>
            </div>
        );
    }

    if (!isActive) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-6">
                <div className="bg-surface p-10 rounded-full border border-border flex items-center justify-center shadow-lg shadow-primary/20" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                    <Play size={64} className="text-primary ml-2" style={{ color: 'var(--color-primary)' }} />
                </div>
                <h1 className="text-2xl font-bold text-text">Ready to workout?</h1>
                <button className="btn btn-primary text-lg px-8 py-3" onClick={() => setIsTemplatePickerOpen(true)}>
                    Start New Session
                </button>

                <TemplateSelector
                    isOpen={isTemplatePickerOpen}
                    onClose={() => setIsTemplatePickerOpen(false)}
                    onSelectTemplate={(t: WorkoutTemplate) => startFromTemplate(t)}
                    onSelectEmpty={startSession}
                />
            </div>
        );
    }

    const isSet = timerMode === 'set';

    return (
        <div className="pb-20">
            {/* ===== STICKY TIMER CARD ===== */}
            <div className="sticky top-0 z-20 pb-3 pt-1" style={{ backgroundColor: 'var(--color-bg)' }}>
                <div
                    onClick={toggleTimerMode}
                    className="cursor-pointer select-none rounded-2xl border-2 p-4 transition-all duration-300"
                    style={{
                        borderColor: isSet ? 'var(--color-primary)' : '#f97316',
                        background: isSet
                            ? 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(99,102,241,0.05))'
                            : 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(249,115,22,0.05))',
                    }}
                >
                    {/* Top row: template name + total time + actions */}
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-xs text-muted">
                            {templateName && (
                                <span className="flex items-center gap-1 font-bold" style={{ color: 'var(--color-primary)' }}>
                                    <Dumbbell size={12} /> {templateName}
                                </span>
                            )}
                            <span className="flex items-center gap-1">
                                <Clock size={12} /> {formatTime(elapsedTime)}
                            </span>
                        </div>
                        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                            <button
                                onClick={cancelSession}
                                className="p-1.5 rounded-lg bg-red-600/20 text-red-500 hover:bg-red-600/40 transition-colors"
                                title="Cancel Workout"
                            >
                                <StopCircle size={16} />
                            </button>
                            <button
                                onClick={handleFinish}
                                disabled={isFinishing}
                                className="px-3 py-1.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/40 transition-colors text-xs font-bold flex items-center gap-1 disabled:opacity-50"
                                style={{ color: 'var(--color-primary)' }}
                            >
                                <Save size={14} /> {isFinishing ? 'Saving...' : 'Finish'}
                            </button>
                        </div>
                    </div>

                    {/* Main timer display */}
                    <div className="flex items-center justify-between min-h-[60px]">
                        <div className="flex flex-col">
                            <span className="text-xs font-bold uppercase tracking-wide flex items-center" style={{ color: isSet ? 'var(--color-primary)' : '#f97316' }}>
                                <span className="text-2xl mr-1 w-8 text-center">{isSet ? '💪' : '😮‍💨'}</span>
                                {isSet ? 'Set' : 'Rest'}
                            </span>
                            <span className="text-4xl font-black tabular-nums" style={{ color: isSet ? 'var(--color-primary)' : '#f97316' }}>
                                {formatTime(modeTimer)}
                            </span>
                        </div>

                        {/* Toggle hint */}
                        <div className="flex flex-col items-center gap-1">
                            <button
                                className="w-32 py-2 rounded-xl text-sm font-bold transition-all duration-200 active:scale-95 shadow-sm"
                                style={{
                                    backgroundColor: isSet ? '#f97316' : 'var(--color-primary)',
                                    color: 'white',
                                }}
                            >
                                {isSet ? 'Start Rest →' : '← Start Set'}
                            </button>
                            <span className="text-[10px] text-muted">tap to switch</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ===== EXERCISES ===== */}
            <div className="flex flex-col gap-4">
                {sessionExercises.map((sessionExercise, exerciseIndex) => (
                    <div key={exerciseIndex} className="card">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex flex-col">
                                <h3 className="text-lg font-bold text-text flex items-center gap-2">
                                    {getExerciseName(sessionExercise.exerciseId)}
                                </h3>
                                {allExercises.find(e => e.id === sessionExercise.exerciseId)?.video_url && (
                                    <a href={allExercises.find(e => e.id === sessionExercise.exerciseId)?.video_url}
                                        target="_blank" rel="noopener noreferrer"
                                        className="text-xs text-primary hover:underline flex items-center gap-1 mt-1">
                                        <span className="i-lucide-external-link w-3 h-3" /> View Demo
                                    </a>
                                )}
                            </div>
                            <button
                                onClick={() => removeExercise(exerciseIndex)}
                                className="text-muted hover:text-danger p-1"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>

                        <div className="grid grid-cols-[1fr_2fr_2fr_5fr_1fr] gap-x-2 gap-y-3 items-center">
                            {/* Header */}
                            <div className="text-xs text-muted uppercase font-bold text-center">#</div>
                            <div className="text-xs text-muted uppercase font-bold text-center">KG</div>
                            <div className="text-xs text-muted uppercase font-bold text-center">REPS</div>
                            <div className="text-xs text-muted uppercase font-bold text-center">TIME</div>
                            <div></div>

                            {sessionExercise.sets.map((set, setIndex) => (
                                <React.Fragment key={set.id}>
                                    {/* Explicit Rest Row (above the set it belongs to) */}
                                    {set.restSeconds !== undefined && set.restSeconds > 0 && (
                                        <div className="col-span-5 flex justify-center items-center py-1.5 my-1 relative">
                                            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                                <div className="w-full border-t border-dashed border-gray-700"></div>
                                            </div>
                                            <div className="relative flex justify-center">
                                                <span className="bg-surface px-2 text-xs font-bold text-orange-500 flex items-center gap-1 border border-orange-500/30 rounded-full py-0.5">
                                                    <Clock size={10} /> Rest: {formatTime(set.restSeconds)}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Set Details Row */}
                                    {/* Set number */}
                                    <div className={`flex items-center justify-center ${set.completed ? 'opacity-60' : ''}`}>
                                        <div className={`rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold ${set.completed ? 'bg-green-600 text-white' : 'bg-gray-800 text-white'}`}>
                                            {setIndex + 1}
                                        </div>
                                    </div>

                                    {/* Weight */}
                                    <div className={`${set.completed ? 'opacity-60' : ''}`}>
                                        <div className="border border-gray-700 rounded-xl overflow-hidden focus-within:border-primary transition-colors bg-bg flex flex-col items-center justify-center py-1.5 focus-within:ring-2 ring-primary/20">
                                            <input
                                                type="number"
                                                className="w-full text-center bg-transparent outline-none border-none p-0 text-lg font-bold"
                                                value={set.weight || ''}
                                                onChange={e => updateSet(exerciseIndex, setIndex, 'weight', Number(e.target.value))}
                                                placeholder={set.goalWeight ? String(set.goalWeight) : '0'}
                                            />
                                            <div className="text-[10px] text-center text-muted mt-1 font-medium min-h-[16px]">
                                                {set.goalWeight !== undefined && set.goalWeight > 0 ? `goal: ${set.goalWeight}` : '\u00A0'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Reps */}
                                    <div className={`${set.completed ? 'opacity-60' : ''}`}>
                                        <div className="border border-gray-700 rounded-xl overflow-hidden focus-within:border-primary transition-colors bg-bg flex flex-col items-center justify-center py-1.5 focus-within:ring-2 ring-primary/20">
                                            <input
                                                type="number"
                                                className="w-full text-center bg-transparent outline-none border-none p-0 text-lg font-bold"
                                                value={set.reps || ''}
                                                onChange={e => updateSet(exerciseIndex, setIndex, 'reps', Number(e.target.value))}
                                                placeholder={set.goalReps ? String(set.goalReps) : '0'}
                                            />
                                            <div className="text-[10px] text-center text-muted mt-1 font-medium min-h-[16px]">
                                                {set.goalReps !== undefined && set.goalReps > 0 ? `goal: ${set.goalReps}` : '\u00A0'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Duration details */}
                                    <div className={`flex items-center justify-center gap-2 text-[11px] font-mono ${set.completed ? 'opacity-60' : ''}`}>
                                        {set.setDuration !== undefined && set.setDuration > 0 && (
                                            <span className="px-1.5 py-0.5 rounded bg-primary/20 font-bold" style={{ color: 'var(--color-primary)' }}>
                                                {formatTime(set.setDuration)}
                                            </span>
                                        )}
                                        {(!set.setDuration) && (
                                            <span className="text-muted">—</span>
                                        )}
                                    </div>

                                    {/* Delete */}
                                    <div className="flex justify-center">
                                        <button
                                            onClick={() => removeSet(exerciseIndex, setIndex)}
                                            className="text-muted hover:text-danger p-1"
                                            title="Remove Set"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                </React.Fragment>
                            ))}
                        </div>

                        <button
                            onClick={() => addSet(exerciseIndex)}
                            className="w-full mt-4 py-2 border border-border rounded text-sm text-primary hover:bg-gray-800 flex items-center justify-center gap-2"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)' }}
                        >
                            <Plus size={16} /> Add Set
                        </button>
                    </div>
                ))}

                <button
                    onClick={() => setIsSelectorOpen(true)}
                    className="w-full py-4 border-2 border-dashed border-gray-700 rounded-lg text-muted hover:border-primary hover:text-primary transition-colors flex flex-col items-center justify-center gap-2"
                >
                    <PlusCircle size={24} />
                    <span>Add Exercise</span>
                </button>
            </div>

            <ExerciseSelector
                isOpen={isSelectorOpen}
                onClose={() => setIsSelectorOpen(false)}
                onSelect={(id) => { addExercise(id); setIsSelectorOpen(false); }}
            />
        </div>
    );
};

export default ActiveSession;
