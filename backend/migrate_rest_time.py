from sqlmodel import Session, text
from backend.database import engine

def migrate_db():
    with Session(engine) as session:
        try:
            # Check if column exists (this is a bit hacky in SQLite but works for simple check)
            # Actually, easiest is just to try adding it and catch error if it exists
            session.exec(text("ALTER TABLE trainingset ADD COLUMN rest_seconds INTEGER DEFAULT 0"))
            session.commit()
            print("Successfully added rest_seconds column.")
        except Exception as e:
            print(f"Migration failed (maybe column exists?): {e}")

if __name__ == "__main__":
    migrate_db()
