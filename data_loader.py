"""
Data Loader Module for ER Triage Simulation
Loads and processes MIETIC validation samples into Case objects
"""

import pandas as pd
import random
from typing import List, Optional, Dict, Any
from dataclasses import dataclass


@dataclass
class Demographics:
    """Patient demographic information"""
    age: float
    sex: str
    transport: str


@dataclass
class Vitals:
    """Patient vital signs"""
    temp: Optional[float]
    hr: Optional[float]  # heart rate
    rr: Optional[float]  # respiratory rate
    o2: Optional[float]  # oxygen saturation
    sbp: Optional[float]  # systolic blood pressure
    dbp: Optional[float]  # diastolic blood pressure
    pain: Optional[float]


@dataclass
class Case:
    """Complete case information for simulation"""
    id: str
    demographics: Demographics
    complaint: str
    vitals: Vitals
    history: str
    acuity: int
    disposition: str
    outcome: str
    expert_opinions: Dict[str, str]
    final_decision: str


class DataLoader:
    """Loads and manages MIETIC validation samples"""
    
    def __init__(self, csv_path: str):
        """Initialize with path to MIETIC CSV file"""
        self.csv_path = csv_path
        self.cases: List[Case] = []
        self.current_index = 0
        self._load_data()
    
    def _load_data(self):
        """Load and parse the CSV data into Case objects"""
        try:
            # Load CSV with proper encoding
            df = pd.read_csv(self.csv_path, encoding='utf-8-sig')
            
            # Fix column names (remove BOM characters)
            df.columns = df.columns.str.replace('\ufeff', '')
            # Fix the first column name specifically
            if df.columns[0].startswith('锘縮'):
                df.columns = ['subject_id'] + list(df.columns[1:])
            
            # Clean up the data
            df = df.dropna(subset=['subject_id'])  # Remove empty rows
            
            for _, row in df.iterrows():
                case = self._create_case_from_row(row)
                if case:
                    self.cases.append(case)
            
            print(f"Loaded {len(self.cases)} cases from {self.csv_path}")
            
        except Exception as e:
            print(f"Error loading data: {e}")
            raise
    
    def _parse_pain_value(self, pain_value) -> Optional[float]:
        """Parse pain value, handling string values like 'Critical', 'uta', etc."""
        if pd.isna(pain_value):
            return None
        
        try:
            return float(pain_value)
        except (ValueError, TypeError):
            # Handle string values that represent high pain
            pain_str = str(pain_value).lower()
            if 'critical' in pain_str or 'crit' in pain_str:
                return 10.0  # Maximum pain for critical conditions
            elif 'uta' in pain_str or 'unable' in pain_str:
                return 9.0   # Very high pain
            else:
                return None  # Unknown string value
    
    def _create_case_from_row(self, row: pd.Series) -> Optional[Case]:
        """Convert a CSV row to a Case object"""
        try:
            # Extract demographics
            demographics = Demographics(
                age=float(row.get('age', 0)) if pd.notna(row.get('age')) else 0,
                sex=str(row.get('gender', 'Unknown')),
                transport=str(row.get('arrival_transport', 'Unknown'))
            )
            
            # Extract vitals
            vitals = Vitals(
                temp=float(row.get('temperature')) if pd.notna(row.get('temperature')) else None,
                hr=float(row.get('heartrate')) if pd.notna(row.get('heartrate')) else None,
                rr=float(row.get('resprate')) if pd.notna(row.get('resprate')) else None,
                o2=float(row.get('o2sat')) if pd.notna(row.get('o2sat')) else None,
                sbp=float(row.get('sbp')) if pd.notna(row.get('sbp')) else None,
                dbp=float(row.get('dbp')) if pd.notna(row.get('dbp')) else None,
                pain=self._parse_pain_value(row.get('pain'))
            )
            
            # Extract case information
            case_id = f"{row.get('subject_id', 'unknown')}_{row.get('stay_id', 'unknown')}"
            complaint = str(row.get('chiefcomplaint', 'Unknown complaint'))
            history = str(row.get('tiragecase', 'No medical history available'))
            # Handle acuity - some values are strings like 'Critical', 'uta', etc.
            acuity_value = row.get('acuity', 1)
            if pd.notna(acuity_value):
                try:
                    acuity = int(acuity_value)
                except (ValueError, TypeError):
                    # Map string values to numeric acuity levels
                    acuity_str = str(acuity_value).lower()
                    if 'critical' in acuity_str or 'crit' in acuity_str:
                        acuity = 1
                    elif 'uta' in acuity_str or 'unable' in acuity_str:
                        acuity = 1
                    else:
                        acuity = 1  # Default to level 1 for unknown strings
            else:
                acuity = 1
            disposition = str(row.get('disposition', 'Unknown'))
            outcome = str(row.get('tiragecase', 'No outcome information'))
            
            # Extract expert opinions
            expert_opinions = {
                'expert_1': str(row.get('Expert 1 Opinion', 'Unknown')),
                'expert_2': str(row.get('Expert 2 Opinion', 'Unknown')),
                'expert_3': str(row.get('Expert 3 Opinion', 'Unknown'))
            }
            
            final_decision = str(row.get('Final Decision', 'Unknown'))
            
            return Case(
                id=case_id,
                demographics=demographics,
                complaint=complaint,
                vitals=vitals,
                history=history,
                acuity=acuity,
                disposition=disposition,
                outcome=outcome,
                expert_opinions=expert_opinions,
                final_decision=final_decision
            )
            
        except Exception as e:
            print(f"Error creating case from row: {e}")
            return None
    
    def get_random_case(self) -> Optional[Case]:
        """Get a random case from the dataset"""
        if not self.cases:
            return None
        return random.choice(self.cases)
    
    def get_next_case(self) -> Optional[Case]:
        """Get the next case in sequence"""
        if not self.cases or self.current_index >= len(self.cases):
            return None
        
        case = self.cases[self.current_index]
        self.current_index += 1
        return case
    
    def get_case_by_id(self, case_id: str) -> Optional[Case]:
        """Get a specific case by ID"""
        for case in self.cases:
            if case.id == case_id:
                return case
        return None
    
    def get_cases_by_acuity(self, acuity: int) -> List[Case]:
        """Get all cases with a specific acuity level"""
        return [case for case in self.cases if case.acuity == acuity]
    
    def get_cases_by_disposition(self, disposition: str) -> List[Case]:
        """Get all cases with a specific disposition"""
        return [case for case in self.cases if case.disposition.lower() == disposition.lower()]
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get dataset statistics"""
        if not self.cases:
            return {}
        
        acuity_counts = {}
        disposition_counts = {}
        transport_counts = {}
        
        for case in self.cases:
            # Count acuity levels
            acuity_counts[case.acuity] = acuity_counts.get(case.acuity, 0) + 1
            
            # Count dispositions
            disposition_counts[case.disposition] = disposition_counts.get(case.disposition, 0) + 1
            
            # Count transport methods
            transport_counts[case.demographics.transport] = transport_counts.get(case.demographics.transport, 0) + 1
        
        return {
            'total_cases': len(self.cases),
            'acuity_distribution': acuity_counts,
            'disposition_distribution': disposition_counts,
            'transport_distribution': transport_counts,
            'age_range': {
                'min': min(case.demographics.age for case in self.cases),
                'max': max(case.demographics.age for case in self.cases),
                'avg': sum(case.demographics.age for case in self.cases) / len(self.cases)
            }
        }


if __name__ == "__main__":
    # Test the data loader
    loader = DataLoader("MIETIC-validate-samples.csv")
    
    # Print statistics
    stats = loader.get_statistics()
    print("\nDataset Statistics:")
    for key, value in stats.items():
        print(f"{key}: {value}")
    
    # Test getting a random case
    case = loader.get_random_case()
    if case:
        print(f"\nSample Case:")
        print(f"ID: {case.id}")
        print(f"Age: {case.demographics.age}, Sex: {case.demographics.sex}")
        print(f"Complaint: {case.complaint}")
        print(f"Acuity: {case.acuity}")
        print(f"Vitals: HR={case.vitals.hr}, BP={case.vitals.sbp}/{case.vitals.dbp}")
