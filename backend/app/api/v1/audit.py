from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import require_role
from app.models.user import User
from app.models.audit import MutationLog
from app.schemas.audit import MutationLogResponse

router = APIRouter(prefix="/audit", tags=["Audit & Governance"])


@router.get("/logs", response_model=List[MutationLogResponse])
def get_audit_logs(
    current_user: User = Depends(require_role("Admin", "Auditor")),
    db: Session = Depends(get_db),
    limit: int = 100
):
    """
    Returns immutable mutation logs for compliance inspection.
    """
    logs = db.query(MutationLog).order_by(MutationLog.changed_at.desc()).limit(limit).all()
    return [
        MutationLogResponse(
            log_id=l.log_id,
            table_name=l.table_name,
            operation=l.operation,
            record_id=l.record_id,
            old_data=l.old_data,
            new_data=l.new_data,
            changed_by=l.changed_by,
            client_ip=l.client_ip,
            changed_at=l.changed_at.strftime("%Y-%m-%d %H:%M:%S")
        ) for l in logs
    ]
