import React, { useState } from 'react';
import { Play, Plus, Trash2, Save, Clock, X, PlusCircle, StopCircle, Timer } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useWorkout } from '../../context/WorkoutContext';
import ExerciseSelector from './ExerciseSelector';

const ActiveSession: React.FC = () => {
    const { exercises: allExercises } = useData();
    const {
        isActive,
        elapsedTime,
        sessionExercises,
        isResting,
        restTimer,
        startSession,
        finishSession,
        cancelSession,
        addExercise,
        removeExercise,
        addSet,
        updateSet,
        removeSet
    } = useWorkout();

    const [isSelectorOpen, setIsSelectorOpen] = useState(false);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getExerciseName = (id: number) => {
        return allExercises.find(e => e.id === id)?.name || 'Unknown Exercise';
    };

    if (!isActive) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-6">
                <div className="bg-surface p-10 rounded-full border border-border flex items-center justify-center shadow-lg shadow-primary/20" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                    <Play size={64} className="text-primary ml-2" style={{ color: 'var(--color-primary)' }} />
                </div>
                <h1 className="text-2xl font-bold text-text">Ready to workout?</h1>
                <button className="btn btn-primary text-lg px-8 py-3" onClick={startSession}>
                    Start New Session
                </button>
            </div>
        );
    }

    return (
        <div className="pb-20">
            {/* Header / Timer Bar */}
            <div className="flex items-center justify-between mb-6 sticky top-0 bg-bg z-10 py-2 border-b border-border" style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                <div className="flex flex-col">
                    <h1 className="text-xl font-bold flex items-center gap-2 text-text">
                        <Clock className="text-primary" size={24} />
                        {formatTime(elapsedTime)}
                    </h1>
                    {isResting && (
                        <span className="text-sm font-bold text-orange-500 animate-pulse flex items-center gap-1">
                            <Timer size={14} /> Rest: {formatTime(restTimer)}
                        </span>
                    )}
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={cancelSession}
                        className="btn bg-red-600 hover:bg-red-700 text-white p-2"
                        title="Cancel Workout"
                    >
                        <StopCircle size={20} />
                    </button>
                    <button
                        onClick={finishSession}
                        className="btn btn-primary flex items-center gap-2"
                    >
                        <Save size={18} /> Finish
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-4">
                {sessionExercises.map((sessionExercise, exerciseIndex) => (
                    <div key={exerciseIndex} className="card">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-text">{getExerciseName(sessionExercise.exerciseId)}</h3>
                            <button
                                onClick={() => removeExercise(exerciseIndex)}
                                className="text-muted hover:text-danger p-1"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="grid grid-cols-12 gap-2 mb-1 text-xs text-muted uppercase font-bold text-center">
                                <div className="col-span-1">#</div>
                                <div className="col-span-4">kg</div>
                                <div className="col-span-4">Reps</div>
                                <div className="col-span-3"></div>
                            </div>

                            {sessionExercise.sets.map((set, setIndex) => (
                                <div key={set.id} data-testid="set-row" className={`grid grid-cols-12 gap-2 items-center ${set.completed ? 'opacity-50' : ''}`}>
                                    <div className="col-span-1 flex flex-col items-center justify-center gap-1">
                                        <div className="bg-gray-800 rounded-full w-6 h-6 flex items-center justify-center text-xs text-white">
                                            {setIndex + 1}
                                        </div>
                                        {set.restSeconds !== undefined && set.restSeconds > 0 && (
                                            <div className="text-[10px] text-orange-500 font-mono">
                                                {Math.floor(set.restSeconds / 60)}:{String(set.restSeconds % 60).padStart(2, '0')}
                                            </div>
                                        )}
                                    </div>
                                    <div className="col-span-4">
                                        <input
                                            type="number"
                                            className="w-full text-center px-1"
                                            value={set.weight || ''}
                                            onChange={e => updateSet(exerciseIndex, setIndex, 'weight', Number(e.target.value))}
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="col-span-4">
                                        <input
                                            type="number"
                                            className="w-full text-center px-1"
                                            value={set.reps || ''}
                                            onChange={e => updateSet(exerciseIndex, setIndex, 'reps', Number(e.target.value))}
                                            placeholder="0"
                                        />
                                    </div>

                                    <div className="col-span-3 flex justify-center">
                                        <button
                                            onClick={() => removeSet(exerciseIndex, setIndex)}
                                            className="text-muted hover:text-danger"
                                            title="Remove Set"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
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
