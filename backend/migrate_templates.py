"""Add WorkoutTemplate, TemplateExercise, TemplateSet tables and goal columns to TrainingSet."""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "database.db")

def migrate():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # Add goal columns to trainingset if not present
    try:
        c.execute("ALTER TABLE trainingset ADD COLUMN goal_weight REAL")
    except sqlite3.OperationalError:
        pass  # Column already exists
    try:
        c.execute("ALTER TABLE trainingset ADD COLUMN goal_reps INTEGER")
    except sqlite3.OperationalError:
        pass
    
    # Create WorkoutTemplate table
    c.execute("""
        CREATE TABLE IF NOT EXISTS workouttemplate (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES user(id),
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Create TemplateExercise table
    c.execute("""
        CREATE TABLE IF NOT EXISTS templateexercise (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            template_id INTEGER NOT NULL REFERENCES workouttemplate(id) ON DELETE CASCADE,
            exercise_id INTEGER NOT NULL REFERENCES exercise(id),
            "order" INTEGER DEFAULT 0
        )
    """)
    
    # Create TemplateSet table
    c.execute("""
        CREATE TABLE IF NOT EXISTS templateset (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            template_exercise_id INTEGER NOT NULL REFERENCES templateexercise(id) ON DELETE CASCADE,
            goal_weight REAL DEFAULT 0,
            goal_reps INTEGER DEFAULT 0
        )
    """)
    
    conn.commit()
    conn.close()
    print("Migration complete!")

if __name__ == "__main__":
    migrate()
