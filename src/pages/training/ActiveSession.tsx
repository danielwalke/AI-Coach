import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { Play, Plus, Trash2, Save, Clock, X, Check, PlusCircle } from 'lucide-react';
import { useData } from '../../context/DataContext';
// Local interfaces for state management (using UUID for keys)
interface LocalTrainingSet {
    id: string;
    weight: number;
    reps: number;
    completed: boolean;
}

interface LocalSessionExercise {
    exerciseId: number;
    sets: LocalTrainingSet[];
}
import ExerciseSelector from './ExerciseSelector';

const ActiveSession: React.FC = () => {
    const { user, exercises: allExercises, addSession } = useData();
    const navigate = useNavigate();

    // Session State
    const [isActive, setIsActive] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [sessionExercises, setSessionExercises] = useState<LocalSessionExercise[]>([]);
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);

    // Timer Effect
    useEffect(() => {
        let interval: number;
        if (isActive) {
            interval = window.setInterval(() => {
                setElapsedTime(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isActive]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const startSession = () => {
        setIsActive(true);
        setElapsedTime(0);
        setSessionExercises([]);
    };

    const handleAddExercise = (exerciseId: number) => {
        const newSessionExercise: LocalSessionExercise = {
            exerciseId,
            sets: [
                { id: uuidv4(), weight: 0, reps: 0, completed: false }
            ]
        };
        // Functional update to ensure no race conditions
        setSessionExercises(prev => [...prev, newSessionExercise]);
    };

    const updateSet = (exerciseIndex: number, setIndex: number, field: keyof LocalTrainingSet, value: string | number | boolean) => {
        setSessionExercises(prev => prev.map((ex, i) => {
            if (i !== exerciseIndex) return ex;

            const updatedSets = ex.sets.map((s, j) => {
                if (j !== setIndex) return s;
                return { ...s, [field]: value };
            });

            return { ...ex, sets: updatedSets };
        }));
    };

    const addSet = (exerciseIndex: number) => {
        setSessionExercises(prev => prev.map((ex, i) => {
            if (i !== exerciseIndex) return ex;

            const previousSet = ex.sets[ex.sets.length - 1];
            const newSet: LocalTrainingSet = {
                id: uuidv4(),
                weight: previousSet ? previousSet.weight : 0,
                reps: previousSet ? previousSet.reps : 0,
                completed: false
            };

            return { ...ex, sets: [...ex.sets, newSet] };
        }));
    };

    const removeSet = (exerciseIndex: number, setIndex: number) => {
        setSessionExercises(prev => prev.map((ex, i) => {
            if (i !== exerciseIndex) return ex;
            return { ...ex, sets: ex.sets.filter((_, j) => j !== setIndex) };
        }));
    };

    const removeExercise = (index: number) => {
        setSessionExercises(prev => prev.filter((_, i) => i !== index));
    };

    const finishSession = async () => {
        if (!user) return;

        // Transform local state to API format
        const apiExercises = sessionExercises.map(ex => ({
            exercise_id: ex.exerciseId,
            sets: ex.sets.map(s => ({
                weight: s.weight,
                reps: s.reps,
                completed: true // Auto-mark as completed since we removed the toggle
            }))
        }));

        await addSession({
            date: new Date().toISOString(),
            duration_seconds: elapsedTime,
            exercises: apiExercises
        });

        setIsActive(false);
        navigate('/dashboard');
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
            <div className="flex items-center justify-between mb-6 sticky top-0 bg-bg z-10 py-2 border-b border-border" style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                <h1 className="text-xl font-bold flex items-center gap-2 text-text">
                    <Clock className="text-primary" size={24} />
                    {formatTime(elapsedTime)}
                </h1>
                <button
                    onClick={finishSession}
                    className="btn btn-primary flex items-center gap-2"
                >
                    <Save size={18} /> Finish
                </button>
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
                                    <div className="col-span-1 flex justify-center">
                                        <div className="bg-gray-800 rounded-full w-6 h-6 flex items-center justify-center text-xs text-white">
                                            {setIndex + 1}
                                        </div>
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
                onSelect={handleAddExercise}
            />
        </div>
    );
};

export default ActiveSession;
