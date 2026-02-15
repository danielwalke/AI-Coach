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
