"""SQLAlchemy engine + session factory (SQLite)."""
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

from . import config
from .models import Base

# check_same_thread=False is required because FastAPI serves requests
# from multiple threads against a single SQLite file.
engine = create_engine(
    config.DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def init_db() -> None:
    """Create all tables if they don't exist yet."""
    Base.metadata.create_all(bind=engine)
    # ``create_all`` intentionally does not alter existing tables. Keep this
    # tiny, additive migration here so installations made with the original
    # archive gain browser-calling fields without losing their SQLite data.
    additions = {
        "accounts": {
            "api_key_sid": "VARCHAR(64) NOT NULL DEFAULT ''",
            "encrypted_api_secret": "TEXT NOT NULL DEFAULT ''",
            "twiml_app_sid": "VARCHAR(64) NOT NULL DEFAULT ''",
            "voice_identity": "VARCHAR(121) NOT NULL DEFAULT 'backoffice'",
        },
        "number_settings": {
            "browser_ringing_enabled": "BOOLEAN NOT NULL DEFAULT 0",
        },
    }
    inspector = inspect(engine)
    with engine.begin() as connection:
        for table, columns in additions.items():
            if not inspector.has_table(table):
                continue
            existing = {column["name"] for column in inspector.get_columns(table)}
            for name, definition in columns.items():
                if name not in existing:
                    connection.execute(text(
                        f"ALTER TABLE {table} ADD COLUMN {name} {definition}"
                    ))


def get_db():
    """FastAPI dependency: yields a request-scoped DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
