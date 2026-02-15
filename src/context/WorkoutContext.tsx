import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useData } from './DataContext';
import { useNavigate } from 'react-router-dom';

// Interfaces (moved from ActiveSession)
export interface LocalTrainingSet {
    id: string;
    weight: number;
    reps: number;
    completed: boolean;
    restSeconds?: number; // Store rest time taken BEFORE this set
}

export interface LocalSessionExercise {
    exerciseId: number;
    sets: LocalTrainingSet[];
}

interface WorkoutContextType {
    isActive: boolean;
    elapsedTime: number;
    sessionExercises: LocalSessionExercise[];
    isResting: boolean;
    restTimer: number;
    startSession: () => void;
    cancelSession: () => void;
    finishSession: () => Promise<void>;
    addExercise: (exerciseId: number) => void;
    removeExercise: (index: number) => void;
    addSet: (exerciseIndex: number) => void;
    updateSet: (exerciseIndex: number, setIndex: number, field: keyof LocalTrainingSet, value: string | number | boolean) => void;
    removeSet: (exerciseIndex: number, setIndex: number) => void;
}

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

export const WorkoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { addSession, user } = useData();
    const navigate = useNavigate();

    // Session State
    const [isActive, setIsActive] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [sessionExercises, setSessionExercises] = useState<LocalSessionExercise[]>([]);

    // Rest Timer State
    const [isResting, setIsResting] = useState(false);
    const [restTimer, setRestTimer] = useState(0);

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

    // Rest Timer Interaction
    useEffect(() => {
        let interval: number;
        if (isResting) {
            interval = window.setInterval(() => {
                setRestTimer(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isResting]);

    const startSession = () => {
        setIsActive(true);
        setElapsedTime(0);
        setSessionExercises([]);
        setIsResting(false);
        setRestTimer(0);
    };

    const cancelSession = () => {
        if (confirm("Are you sure you want to cancel the workout? All progress will be lost.")) {
            setIsActive(false);
            setSessionExercises([]);
            setIsResting(false);
            setRestTimer(0);
            navigate('/dashboard');
        }
    };

    const finishSession = async () => {
        if (!user) return;

        // Transform local state to API format
        const apiExercises = sessionExercises.map(ex => ({
            exercise_id: ex.exerciseId,
            sets: ex.sets.map(s => ({
                weight: s.weight,
                reps: s.reps,
                completed: true,
                rest_seconds: s.restSeconds
            }))
        }));

        await addSession({
            date: new Date().toISOString(),
            duration_seconds: elapsedTime,
            exercises: apiExercises
        });

        setIsActive(false);
        setIsResting(false);
        setRestTimer(0);
        navigate('/dashboard');
    };

    const addExercise = (exerciseId: number) => {
        setIsResting(true);
        setRestTimer(0);

        const newSessionExercise: LocalSessionExercise = {
            exerciseId,
            sets: [
                { id: uuidv4(), weight: 0, reps: 0, completed: false }
            ]
        };
        setSessionExercises(prev => [...prev, newSessionExercise]);
    };

    const removeExercise = (index: number) => {
        setSessionExercises(prev => prev.filter((_, i) => i !== index));
    };

    const addSet = (exerciseIndex: number) => {
        // Stop current rest if running and save it to the PREVIOUS set? 
        // Or just start a new rest.
        // Logic: User finished a set, clicks "Add Set". Rest timer starts.

        setIsResting(true);
        setRestTimer(0);

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

    const updateSet = (exerciseIndex: number, setIndex: number, field: keyof LocalTrainingSet, value: string | number | boolean) => {
        // If user interacts with a set, stop the rest timer
        if (isResting) {
            setIsResting(false);
            // Optionally save the rest timer value to this set as "rest taken before this set"
            // We just store it in the set currently being edited IF it's the last one?
            // Let's attach it to the set being updated for now if we want to track it.
            setSessionExercises(prev => prev.map((ex, i) => {
                if (i !== exerciseIndex) return ex;
                return {
                    ...ex,
                    sets: ex.sets.map((s, j) => {
                        if (j === setIndex) {
                            // Only assign rest time if it hasn't been assigned yet? 
                            // Or overwrite? Let's assign if undefined.
                            return { ...s, [field]: value, restSeconds: s.restSeconds === undefined ? restTimer : s.restSeconds };
                        }
                        return s;
                    })
                };
            }));
        } else {
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
                isResting,
                restTimer,
                startSession,
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
