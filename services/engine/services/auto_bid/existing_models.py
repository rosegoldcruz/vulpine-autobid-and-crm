"""
Minimal SQLAlchemy model stubs for existing engine tables.
These are needed so SQLAlchemy can resolve foreign keys from auto_bid models.
The actual table definitions live in db/init.sql.
"""

from sqlalchemy import String, Integer, Float, Numeric, Boolean, Text, Date, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
import uuid

from shared.database import Base


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    name: Mapped[str] = mapped_column(String(1000), nullable=False)


class Opportunity(Base):
    __tablename__ = "opportunities"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    name: Mapped[str] = mapped_column(String(1000), nullable=False)


class Document(Base):
    __tablename__ = "documents"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    filename: Mapped[str] = mapped_column(String(1000), nullable=False)
    file_path: Mapped[str] = mapped_column(String(2000), nullable=False)