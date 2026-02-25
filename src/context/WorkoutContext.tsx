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
    const { addSession, user, sessions } = useData();
    const navigate = useNavigate();

    const getLastWeight = (exerciseId: number): number => {
        if (!sessions || sessions.length === 0) return 0;
        const sortedSessions = [...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        for (const session of sortedSessions) {
            const exItem = session.exercises.find(e => e.exercise.id === exerciseId);
            if (exItem && exItem.sets.length > 0) {
                const completed = exItem.sets.filter(s => s.completed);
                if (completed.length > 0) {
                    return Math.max(...completed.map(s => s.weight));
                }
                return exItem.sets[0].weight;
            }
        }
        return 0;
    };

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
        let lastTick = Date.now();
        if (isActive) {
            interval = window.setInterval(() => {
                const now = Date.now();
                const delta = Math.floor((now - lastTick) / 1000);
                if (delta > 0) {
                    setElapsedTime(prev => prev + delta);
                    lastTick += delta * 1000;
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isActive]);

    // Mode Timer
    const modeStartRef = useRef<number>(Date.now());

    useEffect(() => {
        let interval: number;
        let lastTick = Date.now();
        if (isActive) {
            interval = window.setInterval(() => {
                const now = Date.now();
                const delta = Math.floor((now - lastTick) / 1000);
                if (delta > 0) {
                    setModeTimer(prev => prev + delta);
                    lastTick += delta * 1000;
                }
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
        const now = Date.now();
        const elapsed = Math.floor((now - modeStartRef.current) / 1000);
        modeStartRef.current = now;

        console.log(`[REST-DEBUG] toggleTimerMode: ${timerMode} -> ${timerMode === 'set' ? 'rest' : 'set'}, elapsed=${elapsed}s, currentSetRef=`, currentSetRef);

        if (timerMode === 'set') {
            // SET -> REST: Mark current set as done with duration
            if (currentSetRef) {
                setSessionExercises(prev => prev.map((ex, i) => {
                    if (i !== currentSetRef.ex) return ex;
                    return {
                        ...ex,
                        sets: ex.sets.map((s, j) => {
                            if (j === currentSetRef.set) {
                                console.log(`[REST-DEBUG] Completing set ${j} of exercise ${i}: setDuration=${(s.setDuration || 0) + elapsed}`);
                                return { ...s, setDuration: (s.setDuration || 0) + elapsed, completed: true };
                            }
                            return s;
                        })
                    };
                }));
            }
            setTimerMode('rest');
        } else {
            // REST -> SET: Record rest time and prepare for next set
            console.log(`[REST-DEBUG] REST->SET: elapsed rest = ${elapsed}s`);

            // Pre-compute where the next set will be (using current state snapshot)
            const snapshot = sessionExercises;
            let nextExIndex = -1;
            let nextSetIndex = -1;
            let willCreateNewSet = false;

            // Look for the first incomplete set without rest attached
            for (let i = 0; i < snapshot.length && nextExIndex === -1; i++) {
                for (let j = 0; j < snapshot[i].sets.length; j++) {
                    const s = snapshot[i].sets[j];
                    if (!s.completed && s.restSeconds === undefined) {
                        nextExIndex = i;
                        nextSetIndex = j;
                        break;
                    }
                }
            }

            if (nextExIndex === -1 && currentSetRef) {
                // No existing incomplete set -> will create new set
                nextExIndex = currentSetRef.ex;
                nextSetIndex = snapshot[currentSetRef.ex].sets.length; // new set will be added at the end
                willCreateNewSet = true;
            }

            console.log(`[REST-DEBUG] Next set target: ex=${nextExIndex}, set=${nextSetIndex}, willCreate=${willCreateNewSet}`);

            // Now update the state
            setSessionExercises(prev => {
                if (!willCreateNewSet) {
                    // Attach rest to existing incomplete set
                    return prev.map((ex, i) => {
                        if (i !== nextExIndex) return ex;
                        return {
                            ...ex,
                            sets: ex.sets.map((s, j) => {
                                if (j === nextSetIndex) {
                                    console.log(`[REST-DEBUG] Attaching rest=${elapsed}s to existing set ${j} of exercise ${i}`);
                                    return { ...s, restSeconds: elapsed };
                                }
                                return s;
                            })
                        };
                    });
                } else {
                    // Create new set with rest
                    return prev.map((ex, i) => {
                        if (i !== nextExIndex) return ex;
                        const previousSet = ex.sets[ex.sets.length - 1];
                        const newSet: LocalTrainingSet = {
                            id: uuidv4(),
                            weight: previousSet ? previousSet.weight : 0,
                            reps: previousSet ? previousSet.reps : 0,
                            completed: false,
                            goalWeight: previousSet?.goalWeight,
                            goalReps: previousSet?.goalReps,
                            restSeconds: elapsed,
                        };
                        console.log(`[REST-DEBUG] Creating new set with rest=${elapsed}s for exercise ${i}`);
                        return { ...ex, sets: [...ex.sets, newSet] };
                    });
                }
            });

            // Update currentSetRef to the target set (outside of the updater, using pre-computed indices)
            setCurrentSetRef({ ex: nextExIndex, set: nextSetIndex });
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

        const exercises: LocalSessionExercise[] = template.exercises.map(tex => {
            const lastW = getLastWeight(tex.exercise.id);
            return {
                exerciseId: tex.exercise.id,
                sets: tex.sets.map(s => ({
                    id: uuidv4(),
                    weight: s.goal_weight > 0 ? s.goal_weight : lastW,
                    reps: s.goal_reps,
                    completed: false,
                    goalWeight: s.goal_weight,
                    goalReps: s.goal_reps,
                }))
            };
        });
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
        setIsActive(false);

        const now = Date.now();
        const elapsedSinceModeStart = Math.floor((now - modeStartRef.current) / 1000);

        if (timerMode === 'set' && currentSetRef) {
            const finalSetDuration = elapsedSinceModeStart;
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
            console.log("Submitting session (set)...", JSON.stringify(apiExercises, null, 2));
            await addSession({ date: new Date().toISOString(), duration_seconds: elapsedTime, exercises: apiExercises });
        } else {
            // We are likely in REST mode or just idle. 
            // If in rest mode, we should add the current rest timer to the current set's rest_seconds
            const finalRestDuration = (timerMode === 'rest') ? elapsedSinceModeStart : 0;

            const apiExercises = sessionExercises.map((ex, i) => ({
                exercise_id: ex.exerciseId,
                sets: ex.sets.map((s, j) => {
                    // Start with accumulated rest
                    let totalRest = s.restSeconds || 0;

                    // If this is the current set we were resting for, add the pending rest time
                    if (currentSetRef && i === currentSetRef.ex && j === currentSetRef.set && timerMode === 'rest') {
                        totalRest += finalRestDuration;
                    }

                    return {
                        weight: s.weight,
                        reps: s.reps,
                        completed: true,
                        rest_seconds: totalRest,
                        set_duration: s.setDuration || 0,
                        goal_weight: s.goalWeight,
                        goal_reps: s.goalReps,
                    };
                })
            }));
            console.log("Submitting session...", JSON.stringify(apiExercises, null, 2));
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
        const lastW = getLastWeight(exerciseId);
        const newSessionExercise: LocalSessionExercise = {
            exerciseId,
            sets: [{ id: uuidv4(), weight: lastW, reps: 0, completed: false }]
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
                weight: previousSet ? previousSet.weight : getLastWeight(ex.exerciseId),
                reps: previousSet ? previousSet.reps : 0,
                completed: false,
                goalWeight: previousSet?.goalWeight,
                goalReps: previousSet?.goalReps,
            };
            return { ...ex, sets: [...ex.sets, newSet] };
        }));
    };

    const updateSet = (exerciseIndex: number, setIndex: number, field: keyof LocalTrainingSet, value: string | number | boolean) => {
        if (timerMode === 'rest') {
            const now = Date.now();
            const elapsed = Math.floor((now - modeStartRef.current) / 1000);

            // Check if they are interacting with an uncompleted set
            const isUncompleted = !sessionExercises[exerciseIndex]?.sets[setIndex]?.completed;

            if (isUncompleted) {
                modeStartRef.current = now;
                setTimerMode('set');
                setModeTimer(0);
                setCurrentSetRef({ ex: exerciseIndex, set: setIndex });

                setSessionExercises(prev => prev.map((ex, i) => i === exerciseIndex ? {
                    ...ex,
                    sets: ex.sets.map((s, j) => j === setIndex ? {
                        ...s,
                        [field]: value,
                        restSeconds: (s.restSeconds || 0) + elapsed
                    } : s)
                } : ex));
            } else {
                // Just update the completed set, don't change mode or currentSetRef
                setSessionExercises(prev => prev.map((ex, i) => i === exerciseIndex ? {
                    ...ex,
                    sets: ex.sets.map((s, j) => j === setIndex ? { ...s, [field]: value } : s)
                } : ex));
            }
        } else {
            // mode is 'set'. Just update the value, do NOT change currentSetRef!
            setSessionExercises(prev => prev.map((ex, i) => i === exerciseIndex ? {
                ...ex,
                sets: ex.sets.map((s, j) => j === setIndex ? { ...s, [field]: value } : s)
            } : ex));
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
