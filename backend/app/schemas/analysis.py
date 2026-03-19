from pydantic import BaseModel, Field
from typing import List, Optional

class CausalStep(BaseModel):
    step: int
    label: str  # e.g., "Global Event", "Logistics", "Wholesale"
    description: str

class EconomicAnalysis(BaseModel):
    commodity: str = Field(..., description="The primary food item affected (e.g., White Onion, Broiler Chicken)")
    impact_severity: int = Field(..., ge=0, le=10, description="0 (None) to 10 (Critical)")
    causal_chain: List[CausalStep] = Field(..., description="The multi-hop journey from news to kitchen")
    time_lag_days: str = Field(..., description="Estimated days until this hits the SME invoice")
    greedflation_score: float = Field(..., description="Likelihood of unjustified price padding (0.0 - 10.0)")
    fair_price_rationale: str = Field(..., description="Logic for what the price SHOULD be")
    counter_arguments: List[str] = Field(..., description="Specific talking points for the owner to use with distributors")