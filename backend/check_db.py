import sqlite3

def check_db():
    print("Checking database for rest_seconds values...")
    conn = sqlite3.connect('backend/data/database.db')
    cursor = conn.cursor()
    
    # Check table schema
    cursor.execute("PRAGMA table_info(trainingset)")
    columns = cursor.fetchall()
    print("Columns in TrainingSet:")
    for col in columns:
        print(f" - {col[1]} ({col[2]})")

    # Fetch recent sets
    cursor.execute("SELECT id, session_exercise_id, reps, weight, rest_seconds, set_duration FROM trainingset ORDER BY id DESC LIMIT 20")
    rows = cursor.fetchall()
    print("\nRecent TrainingSets:")
    print("ID | SesExID | Reps | Weight | RestSecs | SetDuration")
    for row in rows:
        print(f"{row[0]} | {row[1]} | {row[2]} | {row[3]} | {row[4]} | {row[5]}")

    conn.close()

if __name__ == "__main__":
    check_db()
