"""
State Machine for Auto Bid projects.
Manages transitions between stages and overall project status.
"""

from enum import Enum
from datetime import datetime, timezone
from typing import Optional, List
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
import uuid

from services.auto_bid.models import AutoBidProject, AuditEvent


class ProjectStatus(str, Enum):
    CREATED = "CREATED"
    WAITING_FOR_DOCUMENTS = "WAITING_FOR_DOCUMENTS"
    PREFLIGHT = "PREFLIGHT"
    EXTRACTING = "EXTRACTING"
    BOM_GENERATED = "BOM_GENERATED"
    SKU_MAPPING = "SKU_MAPPING"
    EXCEPTIONS_REVIEW = "EXCEPTIONS_REVIEW"
    PRICING = "PRICING"
    QA = "QA"
    PROPOSAL_GENERATED = "PROPOSAL_GENERATED"
    COMPLETE = "COMPLETE"
    FAILED = "FAILED"


class WorkflowStage(str, Enum):
    UPLOAD = "UPLOAD"
    PREFLIGHT = "PREFLIGHT"
    EXTRACT = "EXTRACT"
    BOM = "BOM"
    SKU_MAP = "SKU_MAP"
    EXCEPTIONS = "EXCEPTIONS"
    PRICE = "PRICE"
    QA = "QA"
    PROPOSAL = "PROPOSAL"


# Ordered list of stages
STAGE_ORDER = [
    WorkflowStage.UPLOAD,
    WorkflowStage.PREFLIGHT,
    WorkflowStage.EXTRACT,
    WorkflowStage.BOM,
    WorkflowStage.SKU_MAP,
    WorkflowStage.EXCEPTIONS,
    WorkflowStage.PRICE,
    WorkflowStage.QA,
    WorkflowStage.PROPOSAL,
]

# Valid status transitions
VALID_TRANSITIONS = {
    ProjectStatus.CREATED: [ProjectStatus.WAITING_FOR_DOCUMENTS, ProjectStatus.FAILED],
    ProjectStatus.WAITING_FOR_DOCUMENTS: [ProjectStatus.PREFLIGHT, ProjectStatus.FAILED],
    ProjectStatus.PREFLIGHT: [ProjectStatus.EXTRACTING, ProjectStatus.FAILED],
    ProjectStatus.EXTRACTING: [ProjectStatus.BOM_GENERATED, ProjectStatus.FAILED],
    ProjectStatus.BOM_GENERATED: [ProjectStatus.SKU_MAPPING, ProjectStatus.FAILED],
    ProjectStatus.SKU_MAPPING: [ProjectStatus.EXCEPTIONS_REVIEW, ProjectStatus.FAILED],
    ProjectStatus.EXCEPTIONS_REVIEW: [ProjectStatus.PRICING, ProjectStatus.FAILED],
    ProjectStatus.PRICING: [ProjectStatus.QA, ProjectStatus.FAILED],
    ProjectStatus.QA: [ProjectStatus.PROPOSAL_GENERATED, ProjectStatus.PRICING, ProjectStatus.FAILED],
    ProjectStatus.PROPOSAL_GENERATED: [ProjectStatus.COMPLETE, ProjectStatus.FAILED],
    ProjectStatus.COMPLETE: [],
    ProjectStatus.FAILED: [ProjectStatus.CREATED],  # Allow re-start from failed
}

# Mapping from status to the stage it corresponds to
STATUS_TO_STAGE = {
    ProjectStatus.CREATED: WorkflowStage.UPLOAD,
    ProjectStatus.WAITING_FOR_DOCUMENTS: WorkflowStage.UPLOAD,
    ProjectStatus.PREFLIGHT: WorkflowStage.PREFLIGHT,
    ProjectStatus.EXTRACTING: WorkflowStage.EXTRACT,
    ProjectStatus.BOM_GENERATED: WorkflowStage.BOM,
    ProjectStatus.SKU_MAPPING: WorkflowStage.SKU_MAP,
    ProjectStatus.EXCEPTIONS_REVIEW: WorkflowStage.EXCEPTIONS,
    ProjectStatus.PRICING: WorkflowStage.PRICE,
    ProjectStatus.QA: WorkflowStage.QA,
    ProjectStatus.PROPOSAL_GENERATED: WorkflowStage.PROPOSAL,
    ProjectStatus.COMPLETE: WorkflowStage.PROPOSAL,
    ProjectStatus.FAILED: WorkflowStage.UPLOAD,
}


class TransitionError(Exception):
    """Raised when an invalid state transition is attempted."""
    pass


def can_transition(current: ProjectStatus, target: ProjectStatus) -> bool:
    """Check if a transition is valid."""
    return target in VALID_TRANSITIONS.get(current, [])


def get_next_stage(current: WorkflowStage) -> Optional[WorkflowStage]:
    """Get the next stage in the workflow."""
    try:
        idx = STAGE_ORDER.index(current)
        if idx + 1 < len(STAGE_ORDER):
            return STAGE_ORDER[idx + 1]
    except ValueError:
        pass
    return None


def get_stage_progress(current: WorkflowStage) -> dict:
    """Get progress info for a stage."""
    try:
        idx = STAGE_ORDER.index(current)
    except ValueError:
        idx = 0
    return {
        "current_stage": current.value,
        "current_index": idx,
        "total_stages": len(STAGE_ORDER),
        "completed_stages": idx,
        "progress_percent": round((idx / len(STAGE_ORDER)) * 100, 1),
        "remaining_stages": [s.value for s in STAGE_ORDER[idx + 1:]],
        "all_stages": [s.value for s in STAGE_ORDER],
    }


async def transition_status(
    db: AsyncSession,
    project_id: uuid.UUID,
    new_status: ProjectStatus,
    actor: str = "system",
    reason: str = "",
) -> AutoBidProject:
    """Transition a project to a new status. Records audit event."""
    result = await db.execute(
        select(AutoBidProject).where(AutoBidProject.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise ValueError(f"Project {project_id} not found")

    current_status = ProjectStatus(project.status)
    if not can_transition(current_status, new_status):
        raise TransitionError(
            f"Cannot transition from {current_status.value} to {new_status.value}"
        )

    old_status = project.status
    old_stage = project.current_stage
    project.status = new_status.value
    project.current_stage = STATUS_TO_STAGE.get(new_status, WorkflowStage.UPLOAD).value

    if new_status == ProjectStatus.FAILED:
        project.failed_at = datetime.now(timezone.utc)
    if new_status == ProjectStatus.COMPLETE:
        pass  # Celebration

    # Update stage history
    history = project.stage_history or []
    history.append({
        "stage": project.current_stage,
        "status": new_status.value,
        "entered_at": datetime.now(timezone.utc).isoformat(),
        "actor": actor,
        "reason": reason,
    })
    project.stage_history = history

    # Audit event
    audit = AuditEvent(
        auto_bid_project_id=project_id,
        actor=actor,
        action="stage_transition",
        entity_type="auto_bid_project",
        entity_id=project_id,
        old_values={"status": old_status, "stage": old_stage},
        new_values={"status": new_status.value, "stage": project.current_stage},
        reason=reason,
    )
    db.add(audit)

    await db.flush()
    logger.info(f"Project {project_id} transitioned: {old_status} → {new_status.value}")
    return project


async def advance_stage(
    db: AsyncSession,
    project_id: uuid.UUID,
    actor: str = "system",
    reason: str = "",
) -> AutoBidProject:
    """Advance the project to the next stage in the workflow."""
    result = await db.execute(
        select(AutoBidProject).where(AutoBidProject.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise ValueError(f"Project {project_id} not found")

    current_status = ProjectStatus(project.status)
    # Map current status to the next one
    status_sequence = [
        ProjectStatus.CREATED,
        ProjectStatus.WAITING_FOR_DOCUMENTS,
        ProjectStatus.PREFLIGHT,
        ProjectStatus.EXTRACTING,
        ProjectStatus.BOM_GENERATED,
        ProjectStatus.SKU_MAPPING,
        ProjectStatus.EXCEPTIONS_REVIEW,
        ProjectStatus.PRICING,
        ProjectStatus.QA,
        ProjectStatus.PROPOSAL_GENERATED,
        ProjectStatus.COMPLETE,
    ]
    try:
        idx = status_sequence.index(current_status)
        if idx + 1 < len(status_sequence):
            next_status = status_sequence[idx + 1]
            return await transition_status(db, project_id, next_status, actor, reason)
        else:
            return project  # Already at COMPLETE
    except ValueError:
        raise TransitionError(f"Unknown status: {current_status}")