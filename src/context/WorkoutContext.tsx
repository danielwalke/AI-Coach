import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useData } from './DataContext';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import type { WorkoutTemplate } from '../types/api';

export interface LocalTrainingSet {
    id: string;
    weight: number;
    reps: number;
    completed: boolean;
    restSeconds?: number;
    setDuration?: number;
    goalWeight?: number;
    goalReps?: number;
}

export interface LocalSessionExercise {
    exerciseId: number;
    sets: LocalTrainingSet[];
}

export type TimerMode = 'set' | 'rest';

interface WorkoutContextType {
    isActive: boolean;
    elapsedTime: number;
    sessionExercises: LocalSessionExercise[];
    timerMode: TimerMode;
    modeTimer: number;
    templateName: string | null;
    motivationalQuote: string | null;
    toggleTimerMode: () => void;
    startSession: () => void;
    startFromTemplate: (template: WorkoutTemplate) => void;
    cancelSession: () => void;
    finishSession: () => Promise<void>;
    addExercise: (exerciseId: number) => void;
    removeExercise: (index: number) => void;
    addSet: (exerciseIndex: number) => void;
    updateSet: (exerciseIndex: number, setIndex: number, field: keyof LocalTrainingSet, value: string | number | boolean) => void;
    removeSet: (exerciseIndex: number, setIndex: number) => void;
}

const FALLBACK_QUOTES = [
    "Every rep counts. You showed up, and that's what matters! 💪",
    "Consistency beats perfection. Another session in the books! 🔥",
    "You didn't come this far to only come this far. Keep pushing! 🚀",
    "The only bad workout is the one that didn't happen. Great job! ⭐",
    "Your future self will thank you for today's effort! 💯",
    "Champions are made in the sessions nobody watches. Well done! 🏆",
    "Discipline is choosing between what you want now and what you want most. 🎯",
    "You're building something great, one workout at a time! 🏗️",
];

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

export const WorkoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { addSession, user } = useData();
    const navigate = useNavigate();

    // Session State
    const [isActive, setIsActive] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [sessionExercises, setSessionExercises] = useState<LocalSessionExercise[]>([]);
    const [templateName, setTemplateName] = useState<string | null>(null);
    const [motivationalQuote, setMotivationalQuote] = useState<string | null>(null);

    // Timer Mode
    const [timerMode, setTimerMode] = useState<TimerMode>('set');
    const [modeTimer, setModeTimer] = useState(0);

    // Track current set
    const [currentSetRef, setCurrentSetRef] = useState<{ ex: number; set: number } | null>(null);

    // Workout Timer
    useEffect(() => {
        let interval: number;
        if (isActive) {
            interval = window.setInterval(() => {
                setElapsedTime(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isActive]);

    // Mode Timer
    useEffect(() => {
        let interval: number;
        if (isActive) {
            interval = window.setInterval(() => {
                setModeTimer(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isActive, timerMode]);

    const modeTimerRef = useRef(modeTimer);
    useEffect(() => { modeTimerRef.current = modeTimer; }, [modeTimer]);

    // Pre-fetch motivational quote from LLM
    const fetchMotivationalQuote = async (tplName?: string | null) => {
        const fallback = FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)];
        setMotivationalQuote(fallback); // Set fallback immediately

        try {
            const data = await apiClient.post('/coach/motivate', {
                duration_seconds: 0,
                exercise_count: 0,
                total_sets: 0,
                template_name: tplName || null,
            });
            if (data?.quote) {
                setMotivationalQuote(data.quote);
            }
        } catch {
            // Keep fallback
        }
    };

    const toggleTimerMode = () => {
        const elapsed = modeTimerRef.current;

        if (timerMode === 'set') {
            if (currentSetRef) {
                setSessionExercises(prev => prev.map((ex, i) => {
                    if (i !== currentSetRef.ex) return ex;
                    return {
                        ...ex,
                        sets: ex.sets.map((s, j) => {
                            if (j === currentSetRef.set) {
                                return { ...s, setDuration: (s.setDuration || 0) + elapsed, completed: true };
                            }
                            return s;
                        })
                    };
                }));
            }
            setTimerMode('rest');
        } else {
            let found = false;
            setSessionExercises(prev => {
                const updated = prev.map((ex, i) => {
                    if (found) return ex;
                    return {
                        ...ex,
                        sets: ex.sets.map((s, j) => {
                            if (found) return s;
                            if (!s.completed && s.restSeconds === undefined) {
                                found = true;
                                setCurrentSetRef({ ex: i, set: j });
                                return { ...s, restSeconds: elapsed };
                            }
                            return s;
                        })
                    };
                });
                if (!found && currentSetRef) {
                    return updated.map((ex, i) => {
                        if (i !== currentSetRef.ex) return ex;
                        return {
                            ...ex,
                            sets: ex.sets.map((s, j) => {
                                if (j === currentSetRef.set) {
                                    return { ...s, restSeconds: (s.restSeconds || 0) + elapsed };
                                }
                                return s;
                            })
                        };
                    });
                }
                return updated;
            });
            setTimerMode('set');
        }

        setModeTimer(0);
    };

    const startSession = () => {
        setIsActive(true);
        setElapsedTime(0);
        setSessionExercises([]);
        setTimerMode('set');
        setModeTimer(0);
        setTemplateName(null);
        setCurrentSetRef(null);
        fetchMotivationalQuote(null);
    };

    const startFromTemplate = (template: WorkoutTemplate) => {
        setIsActive(true);
        setElapsedTime(0);
        setTimerMode('set');
        setModeTimer(0);
        setTemplateName(template.name);

        const exercises: LocalSessionExercise[] = template.exercises.map(tex => ({
            exerciseId: tex.exercise.id,
            sets: tex.sets.map(s => ({
                id: uuidv4(),
                weight: s.goal_weight,
                reps: s.goal_reps,
                completed: false,
                goalWeight: s.goal_weight,
                goalReps: s.goal_reps,
            }))
        }));
        setSessionExercises(exercises);
        if (exercises.length > 0 && exercises[0].sets.length > 0) {
            setCurrentSetRef({ ex: 0, set: 0 });
        }
        fetchMotivationalQuote(template.name);
    };

    const cancelSession = () => {
        if (confirm("Are you sure you want to cancel the workout? All progress will be lost.")) {
            setIsActive(false);
            setSessionExercises([]);
            setTimerMode('set');
            setModeTimer(0);
            setTemplateName(null);
            setCurrentSetRef(null);
            setMotivationalQuote(null);
            navigate('/dashboard');
        }
    };

    const finishSession = async () => {
        if (!user) return;

        if (timerMode === 'set' && currentSetRef) {
            const finalSetDuration = modeTimer;
            const apiExercises = sessionExercises.map((ex, i) => ({
                exercise_id: ex.exerciseId,
                sets: ex.sets.map((s, j) => ({
                    weight: s.weight,
                    reps: s.reps,
                    completed: true,
                    rest_seconds: s.restSeconds || 0,
                    set_duration: (i === currentSetRef.ex && j === currentSetRef.set)
                        ? (s.setDuration || 0) + finalSetDuration
                        : (s.setDuration || 0),
                    goal_weight: s.goalWeight,
                    goal_reps: s.goalReps,
                }))
            }));
            await addSession({ date: new Date().toISOString(), duration_seconds: elapsedTime, exercises: apiExercises });
        } else {
            const apiExercises = sessionExercises.map(ex => ({
                exercise_id: ex.exerciseId,
                sets: ex.sets.map(s => ({
                    weight: s.weight,
                    reps: s.reps,
                    completed: true,
                    rest_seconds: s.restSeconds || 0,
                    set_duration: s.setDuration || 0,
                    goal_weight: s.goalWeight,
                    goal_reps: s.goalReps,
                }))
            }));
            await addSession({ date: new Date().toISOString(), duration_seconds: elapsedTime, exercises: apiExercises });
        }

        setIsActive(false);
        setTimerMode('set');
        setModeTimer(0);
        setTemplateName(null);
        setCurrentSetRef(null);
        // Don't clear motivationalQuote — summary modal reads it
    };

    const addExercise = (exerciseId: number) => {
        const newSessionExercise: LocalSessionExercise = {
            exerciseId,
            sets: [{ id: uuidv4(), weight: 0, reps: 0, completed: false }]
        };
        setSessionExercises(prev => {
            const next = [...prev, newSessionExercise];
            if (!currentSetRef) {
                setCurrentSetRef({ ex: next.length - 1, set: 0 });
            }
            return next;
        });
    };

    const removeExercise = (index: number) => {
        setSessionExercises(prev => prev.filter((_, i) => i !== index));
        if (currentSetRef && currentSetRef.ex === index) {
            setCurrentSetRef(null);
        }
    };

    const addSet = (exerciseIndex: number) => {
        setSessionExercises(prev => prev.map((ex, i) => {
            if (i !== exerciseIndex) return ex;
            const previousSet = ex.sets[ex.sets.length - 1];
            const newSet: LocalTrainingSet = {
                id: uuidv4(),
                weight: previousSet ? previousSet.weight : 0,
                reps: previousSet ? previousSet.reps : 0,
                completed: false,
                goalWeight: previousSet?.goalWeight,
                goalReps: previousSet?.goalReps,
            };
            return { ...ex, sets: [...ex.sets, newSet] };
        }));
    };

    const updateSet = (exerciseIndex: number, setIndex: number, field: keyof LocalTrainingSet, value: string | number | boolean) => {
        setSessionExercises(prev => prev.map((ex, i) => {
            if (i !== exerciseIndex) return ex;
            return {
                ...ex,
                sets: ex.sets.map((s, j) => {
                    if (j === setIndex) return { ...s, [field]: value };
                    return s;
                })
            };
        }));
        if (!currentSetRef || currentSetRef.ex !== exerciseIndex || currentSetRef.set !== setIndex) {
            setCurrentSetRef({ ex: exerciseIndex, set: setIndex });
        }
    };

    const removeSet = (exerciseIndex: number, setIndex: number) => {
        setSessionExercises(prev => prev.map((ex, i) => {
            if (i !== exerciseIndex) return ex;
            return { ...ex, sets: ex.sets.filter((_, j) => j !== setIndex) };
        }));
    };

    return (
        <WorkoutContext.Provider
            value={{
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
                cancelSession,
                finishSession,
                addExercise,
                removeExercise,
                addSet,
                updateSet,
                removeSet
            }}
        >
            {children}
        </WorkoutContext.Provider>
    );
};

export const useWorkout = () => {
    const context = useContext(WorkoutContext);
    if (context === undefined) {
        throw new Error('useWorkout must be used within a WorkoutProvider');
    }
    return context;
};
