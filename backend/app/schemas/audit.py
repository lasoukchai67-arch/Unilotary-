from pydantic import BaseModel
from typing import Optional


class MutationLogResponse(BaseModel):
    log_id: str
    table_name: str
    operation: str
    record_id: str
    old_data: Optional[str] = None
    new_data: Optional[str] = None
    changed_by: str
    client_ip: Optional[str] = None
    changed_at: str
