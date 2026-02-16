import sqlite3
import os

conn = sqlite3.connect(os.path.join(os.path.dirname(__file__), "database.db"))
cursor = conn.cursor()

# List tables
tables = [t[0] for t in cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
print("Tables:", tables)

# Find the training set table
for t in tables:
    cols = [c[1] for c in cursor.execute(f"PRAGMA table_info({t})").fetchall()]
    if "weight" in cols and "reps" in cols:
        print(f"Found training set table: {t}, columns: {cols}")
        if "set_duration" not in cols:
            cursor.execute(f"ALTER TABLE {t} ADD COLUMN set_duration INTEGER DEFAULT 0")
            print(f"  Added set_duration column to {t}")
        else:
            print(f"  set_duration already exists in {t}")

conn.commit()
conn.close()
print("Migration complete!")
