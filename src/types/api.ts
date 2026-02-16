// API Response Types matching Pydantic schemas

export interface User {
    id: number;
    email: string;
    name: string;
    age?: number;
    joined_at: string;
}

export interface AccessToken {
    access_token: string;
    token_type: string;
}

export interface Exercise {
    id: number;
    name: string;
    category: string;
    is_custom: boolean;
    user_id?: number;
}

export interface TrainingSet {
    id?: number; // Optional for creation
    weight: number;
    reps: number;
    completed: boolean;
    rest_seconds?: number;
    set_duration?: number;
    goal_weight?: number;
    goal_reps?: number;
}

export interface SessionExercise {
    id: number;
    exercise: Exercise;
    sets: TrainingSet[];
}

export interface TrainingSession {
    id: number;
    user_id: number;
    date: string;
    duration_seconds: number;
    exercises: SessionExercise[];
}

// Request Data Types

export interface CreateTrainingSession {
    date: string;
    duration_seconds: number;
    exercises: {
        exercise_id: number;
        sets: Omit<TrainingSet, 'id'>[];
    }[];
}

// --- Template Types ---

export interface TemplateSet {
    id: number;
    goal_weight: number;
    goal_reps: number;
}

export interface TemplateExercise {
    id: number;
    exercise: Exercise;
    order: number;
    sets: TemplateSet[];
}

export interface WorkoutTemplate {
    id: number;
    name: string;
    created_at: string;
    updated_at: string;
    exercises: TemplateExercise[];
}

export interface CreateWorkoutTemplate {
    name: string;
    exercises: {
        exercise_id: number;
        sets: { goal_weight: number; goal_reps: number }[];
    }[];
}
