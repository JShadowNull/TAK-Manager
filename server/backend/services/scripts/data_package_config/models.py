from pydantic import BaseModel
from typing import Dict, Any, List

class TakServerConfig(BaseModel):
    count: str
    description0: str
    ipAddress0: str
    port0: str
    protocol0: str
    caLocation0: str
    certPassword0: str

class DataPackageRequest(BaseModel):
    takServerConfig: TakServerConfig
    atakPreferences: Dict[str, Any]
    clientCert: str
    zipFileName: str
    customFiles: List[str]  # List of filenames to include 