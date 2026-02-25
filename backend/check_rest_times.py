"""Phase 1: Direct DB check for rest_seconds values in trainingset table."""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "database.db")

def check_rest_times():
    print(f"Connecting to: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. Check schema
    cursor.execute("PRAGMA table_info(trainingset)")
    columns = cursor.fetchall()
    print("\n=== TrainingSet Schema ===")
    col_names = []
    for col in columns:
        col_names.append(col[1])
        print(f"  {col[1]:20s} {col[2]:10s} default={col[4]}")

    has_rest = "rest_seconds" in col_names
    has_dur = "set_duration" in col_names
    print(f"\n  rest_seconds column exists: {has_rest}")
    print(f"  set_duration column exists: {has_dur}")

    if not has_rest:
        print("\n*** CRITICAL: rest_seconds column is MISSING from DB! ***")
        conn.close()
        return

    # 2. Count rows with non-zero rest_seconds
    cursor.execute("SELECT COUNT(*) FROM trainingset WHERE rest_seconds > 0")
    count_nonzero = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM trainingset")
    count_total = cursor.fetchone()[0]
    print(f"\n=== Rest Seconds Stats ===")
    print(f"  Total sets: {count_total}")
    print(f"  Sets with rest_seconds > 0: {count_nonzero}")

    # 3. Show ALL sets with rest_seconds (even 0)
    cursor.execute("""
        SELECT ts.id, ts.session_exercise_id, ts.weight, ts.reps, 
               ts.rest_seconds, ts.set_duration, ts.completed,
               se.exercise_id, e.name
        FROM trainingset ts
        JOIN sessionexercise se ON ts.session_exercise_id = se.id
        JOIN exercise e ON se.exercise_id = e.id
        ORDER BY ts.session_exercise_id, ts.id
    """)
    rows = cursor.fetchall()
    print(f"\n=== All Training Sets ({len(rows)} rows) ===")
    print(f"{'ID':>4} | {'SesExID':>7} | {'Exercise':20s} | {'Weight':>6} | {'Reps':>4} | {'RestSec':>7} | {'SetDur':>6} | {'Done':>4}")
    print("-" * 90)
    for row in rows:
        print(f"{row[0]:4d} | {row[1]:7d} | {row[8]:20s} | {row[2]:6.1f} | {row[3]:4d} | {row[4]:7d} | {row[5]:6d} | {row[6]:4d}")

    # 4. Check sessions
    cursor.execute("""
        SELECT ts2.id, ts2.date, ts2.duration_seconds, ts2.user_id,
               COUNT(DISTINCT se.id) as exercises,
               COUNT(tset.id) as total_sets,
               SUM(CASE WHEN tset.rest_seconds > 0 THEN 1 ELSE 0 END) as sets_with_rest
        FROM trainingsession ts2
        LEFT JOIN sessionexercise se ON se.session_id = ts2.id
        LEFT JOIN trainingset tset ON tset.session_exercise_id = se.id
        GROUP BY ts2.id
        ORDER BY ts2.id
    """)
    sessions = cursor.fetchall()
    print(f"\n=== Sessions Summary ===")
    print(f"{'ID':>4} | {'Date':20s} | {'Duration':>8} | {'Exercises':>9} | {'Sets':>4} | {'WithRest':>8}")
    print("-" * 70)
    for s in sessions:
        print(f"{s[0]:4d} | {s[1]:20s} | {s[2]:8d} | {s[3]:9d} | {s[5]:4d} | {s[6]:8d}")

    conn.close()
    print("\nDone.")

if __name__ == "__main__":
    check_rest_times()
