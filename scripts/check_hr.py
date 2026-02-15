import sqlite3

conn = sqlite3.connect('backend/database.db')

# List tables
tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
print("Tables:", tables)

# Find heart rate table
for t in tables:
    if 'heart' in t.lower():
        print(f"\nHeart rate table: {t}")
        rows = conn.execute(f"SELECT MIN(timestamp), MAX(timestamp), COUNT(*) FROM [{t}]").fetchone()
        print(f"  Min timestamp: {rows[0]}")
        print(f"  Max timestamp: {rows[1]}")
        print(f"  Count: {rows[2]}")
        
        # Show latest 5
        sample = conn.execute(f"SELECT timestamp, heart_rate FROM [{t}] ORDER BY timestamp DESC LIMIT 5").fetchall()
        print(f"  Latest 5:")
        for s in sample:
            print(f"    {s[0]} -> {s[1]} bpm")
        
        # Show earliest 5
        sample2 = conn.execute(f"SELECT timestamp, heart_rate FROM [{t}] ORDER BY timestamp LIMIT 5").fetchall()
        print(f"  Earliest 5:")
        for s in sample2:
            print(f"    {s[0]} -> {s[1]} bpm")

conn.close()
