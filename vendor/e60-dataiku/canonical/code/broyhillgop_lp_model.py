"""
BROYHILLGOP CAMPAIGN OPTIMIZATION — LINEAR PROGRAMMING MODEL
=============================================================

A complete mathematical optimization framework for maximizing
campaign donations based on candidate-donor attribute matching.

Author: BroyhillGOP Platform
Version: 1.0
Date: December 2025

MATHEMATICAL FOUNDATION
-----------------------
This model uses Linear Programming (LP) to solve:

    MAXIMIZE: Total Expected Donations
    SUBJECT TO: Budget, Time, Capacity, and Fatigue Constraints

The model dynamically adjusts based on observed performance,
reallocating resources to highest-performing segments.
"""

import numpy as np
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from enum import Enum
from datetime import datetime, timedelta
import json

# =============================================================================
# SECTION 1: ENUMERATIONS AND CONSTANTS
# =============================================================================

class Grade(Enum):
    """13-tier donor grading based on giving amount"""
    A_PLUS = ("A+", 1, 1000000, float('inf'))      # $1M+
    A = ("A", 2, 500000, 999999.99)                 # $500K-$1M
    A_MINUS = ("A-", 3, 300000, 499999.99)          # $300K-$500K
    B_PLUS = ("B+", 4, 200000, 299999.99)           # $200K-$300K
    B = ("B", 5, 100000, 199999.99)                 # $100K-$200K
    B_MINUS = ("B-", 6, 50000, 99999.99)            # $50K-$100K
    C_PLUS = ("C+", 7, 25000, 49999.99)             # $25K-$50K
    C = ("C", 8, 10000, 24999.99)                   # $10K-$25K
    C_MINUS = ("C-", 9, 5000, 9999.99)              # $5K-$10K
    D_PLUS = ("D+", 10, 2500, 4999.99)              # $2.5K-$5K
    D = ("D", 11, 1000, 2499.99)                    # $1K-$2.5K
    D_MINUS = ("D-", 12, 500, 999.99)               # $500-$1K
    U = ("U", 13, 0, 499.99)                        # Under $500

    def __init__(self, label: str, rank: int, min_amt: float, max_amt: float):
        self.label = label
        self.rank = rank
        self.min_amount = min_amt
        self.max_amount = max_amt


class Channel(Enum):
    """Communication channels with cost per touch"""
    EMAIL = ("email", 0.01)
    TEXT = ("text", 0.03)
    RINGLESS_VOICEMAIL = ("rvm", 0.05)
    PHONE_CALL = ("phone", 2.50)
    DIRECT_MAIL = ("mail", 3.50)
    PERSONAL_LETTER = ("letter", 5.00)
    HANDWRITTEN_NOTE = ("handwritten", 8.00)
    EVENT_INVITATION = ("event", 15.00)
    PERSONAL_MEETING = ("meeting", 50.00)

    def __init__(self, code: str, cost: float):
        self.code = code
        self.cost_per_touch = cost


class MessageType(Enum):
    """Message content types"""
    INTRODUCTION = "introduction"
    ISSUE_UPDATE = "issue_update"
    PERSONAL_STORY = "personal_story"
    ENDORSEMENT = "endorsement"
    EVENT_INVITE = "event_invite"
    SOFT_ASK = "soft_ask"
    DIRECT_ASK = "direct_ask"
    URGENCY_ASK = "urgency_ask"
    THANK_YOU = "thank_you"
    SURVEY = "survey"
    NEWSLETTER = "newsletter"
    VOLUNTEER_ASK = "volunteer_ask"


class CampaignPhase(Enum):
    """Campaign lifecycle phases (dynamic allocation)"""
    DISCOVER = ("discover", "Test attributes, find winners")
    CULTIVATE = ("cultivate", "Build relationships")
    ENGAGE = ("engage", "Deepen relationships, small asks")
    HARVEST = ("harvest", "Maximum extraction")

    def __init__(self, code: str, description: str):
        self.code = code
        self.description = description


class CampaignMode(Enum):
    """Campaign intensity mode based on time remaining"""
    CONSERVATIVE = ("conservative", 450, float('inf'), 0.67)   # 15+ months
    BALANCED = ("balanced", 270, 449, 1.0)                      # 9-15 months
    AGGRESSIVE = ("aggressive", 135, 269, 1.5)                  # 4.5-9 months
    URGENT = ("urgent", 60, 134, 2.5)                           # 2-4.5 months
    EMERGENCY = ("emergency", 0, 59, 4.0)                       # <2 months

    def __init__(self, code: str, min_days: int, max_days: int, intensity: float):
        self.code = code
        self.min_days = min_days
        self.max_days = max_days
        self.intensity_multiplier = intensity


# =============================================================================
# SECTION 2: DYNAMIC CAMPAIGN TIMELINE
# =============================================================================

@dataclass
class CampaignTimeline:
    """
    Dynamic timeline calculation based on registration and election dates.
    
    Adjusts campaign intensity, phase allocation, and budget pacing
    based on actual time available.
    """
    registration_date: datetime
    election_date: datetime
    
    def __post_init__(self):
        self.today = datetime.now()
        
        # Core calculations
        self.total_days = (self.election_date - self.registration_date).days
        self.days_remaining = max(1, (self.election_date - self.today).days)
        self.days_elapsed = max(0, (self.today - self.registration_date).days)
        self.percent_complete = self.days_elapsed / self.total_days if self.total_days > 0 else 0
        
        # Determine campaign mode
        self.mode = self._determine_mode()
        self.intensity_multiplier = self.mode.intensity_multiplier
        
        # Calculate phase structure
        self.phases = self._calculate_phases()
        
        # Budget pacing
        self.budget_pacing = self._calculate_budget_pacing()
        
    def _determine_mode(self) -> CampaignMode:
        """Determine campaign intensity mode based on days remaining"""
        for mode in CampaignMode:
            if mode.min_days <= self.days_remaining <= mode.max_days:
                return mode
        return CampaignMode.EMERGENCY
    
    def _calculate_phases(self) -> Dict[CampaignPhase, Dict]:
        """
        Calculate phase allocation based on time remaining.
        
        More time = more discovery/cultivation
        Less time = more engage/harvest
        """
        # Phase allocation percentages by mode
        allocations = {
            CampaignMode.CONSERVATIVE: {
                CampaignPhase.DISCOVER: 0.30,
                CampaignPhase.CULTIVATE: 0.30,
                CampaignPhase.ENGAGE: 0.20,
                CampaignPhase.HARVEST: 0.20
            },
            CampaignMode.BALANCED: {
                CampaignPhase.DISCOVER: 0.25,
                CampaignPhase.CULTIVATE: 0.25,
                CampaignPhase.ENGAGE: 0.25,
                CampaignPhase.HARVEST: 0.25
            },
            CampaignMode.AGGRESSIVE: {
                CampaignPhase.DISCOVER: 0.15,
                CampaignPhase.CULTIVATE: 0.20,
                CampaignPhase.ENGAGE: 0.30,
                CampaignPhase.HARVEST: 0.35
            },
            CampaignMode.URGENT: {
                CampaignPhase.DISCOVER: 0.10,
                CampaignPhase.CULTIVATE: 0.15,
                CampaignPhase.ENGAGE: 0.30,
                CampaignPhase.HARVEST: 0.45
            },
            CampaignMode.EMERGENCY: {
                CampaignPhase.DISCOVER: 0.05,
                CampaignPhase.CULTIVATE: 0.10,
                CampaignPhase.ENGAGE: 0.25,
                CampaignPhase.HARVEST: 0.60
            }
        }
        
        allocation = allocations[self.mode]
        phases = {}
        
        cumulative_days = 0
        for phase in CampaignPhase:
            phase_pct = allocation[phase]
            phase_days = int(self.days_remaining * phase_pct)
            
            phases[phase] = {
                "percentage": phase_pct,
                "days": phase_days,
                "start_day": cumulative_days,
                "end_day": cumulative_days + phase_days,
                "start_date": self.today + timedelta(days=cumulative_days),
                "end_date": self.today + timedelta(days=cumulative_days + phase_days)
            }
            cumulative_days += phase_days
        
        return phases
    
    def _calculate_budget_pacing(self) -> Dict:
        """
        Calculate budget pacing based on timeline.
        
        Longer timelines = gradual ramp
        Shorter timelines = aggressive front-loading
        """
        pacing = {
            CampaignMode.CONSERVATIVE: {
                "first_period_pct": 0.03,
                "final_period_pct": 0.12,
                "ramp_type": "gradual"
            },
            CampaignMode.BALANCED: {
                "first_period_pct": 0.05,
                "final_period_pct": 0.15,
                "ramp_type": "moderate"
            },
            CampaignMode.AGGRESSIVE: {
                "first_period_pct": 0.10,
                "final_period_pct": 0.25,
                "ramp_type": "steep"
            },
            CampaignMode.URGENT: {
                "first_period_pct": 0.15,
                "final_period_pct": 0.35,
                "ramp_type": "aggressive"
            },
            CampaignMode.EMERGENCY: {
                "first_period_pct": 0.20,
                "final_period_pct": 0.50,
                "ramp_type": "emergency"
            }
        }
        
        mode_pacing = pacing[self.mode]
        
        # Calculate periods (divide remaining time into manageable chunks)
        if self.days_remaining > 180:
            period_length = 30  # Monthly
        elif self.days_remaining > 60:
            period_length = 14  # Bi-weekly
        else:
            period_length = 7   # Weekly
        
        num_periods = max(1, self.days_remaining // period_length)
        
        # Generate budget curve
        budget_by_period = []
        first_pct = mode_pacing["first_period_pct"]
        final_pct = mode_pacing["final_period_pct"]
        
        for i in range(num_periods):
            # Exponential ramp from first to final
            progress = i / max(1, num_periods - 1)
            period_pct = first_pct + (final_pct - first_pct) * (progress ** 1.5)
            budget_by_period.append({
                "period": i + 1,
                "days_from_start": i * period_length,
                "budget_percentage": period_pct,
                "cumulative_percentage": sum(b["budget_percentage"] for b in budget_by_period) + period_pct
            })
        
        # Normalize to 100%
        total_raw = sum(b["budget_percentage"] for b in budget_by_period)
        for b in budget_by_period:
            b["budget_percentage"] = b["budget_percentage"] / total_raw
        
        return {
            "period_length_days": period_length,
            "num_periods": num_periods,
            "ramp_type": mode_pacing["ramp_type"],
            "periods": budget_by_period
        }
    
    def get_current_phase(self) -> CampaignPhase:
        """Determine which phase we're currently in"""
        days_into_campaign = (self.today - self.registration_date).days
        
        for phase, config in self.phases.items():
            if config["start_day"] <= days_into_campaign <= config["end_day"]:
                return phase
        
        return CampaignPhase.HARVEST  # Default to harvest if past all phases
    
    def get_period_budget(self, total_budget: float, period: int) -> float:
        """Get budget for a specific period"""
        if period <= 0 or period > len(self.budget_pacing["periods"]):
            return 0
        return total_budget * self.budget_pacing["periods"][period - 1]["budget_percentage"]
    
    def get_grade_filter(self) -> List[Grade]:
        """
        Determine which grades to target based on time remaining.
        
        Less time = focus on higher grades only
        """
        if self.mode == CampaignMode.EMERGENCY:
            return [Grade.A_PLUS, Grade.A, Grade.A_MINUS]
        elif self.mode == CampaignMode.URGENT:
            return [Grade.A_PLUS, Grade.A, Grade.A_MINUS, Grade.B_PLUS, Grade.B]
        elif self.mode == CampaignMode.AGGRESSIVE:
            return [Grade.A_PLUS, Grade.A, Grade.A_MINUS, Grade.B_PLUS, Grade.B, Grade.B_MINUS, Grade.C_PLUS]
        else:
            return list(Grade)  # All grades
    
    def get_contact_test_count(self) -> int:
        """
        Number of contacts before grade change decision.
        
        Less time = fewer test contacts
        """
        if self.mode == CampaignMode.EMERGENCY:
            return 2
        elif self.mode == CampaignMode.URGENT:
            return 3
        elif self.mode == CampaignMode.AGGRESSIVE:
            return 4
        else:
            return 5  # Standard 5-contact test
    
    def get_reallocation_frequency(self) -> int:
        """
        How often to recalculate budget allocation (in days).
        
        Less time = more frequent reallocation
        """
        if self.mode == CampaignMode.EMERGENCY:
            return 1   # Daily
        elif self.mode == CampaignMode.URGENT:
            return 3   # Every 3 days
        elif self.mode == CampaignMode.AGGRESSIVE:
            return 7   # Weekly
        elif self.mode == CampaignMode.BALANCED:
            return 14  # Bi-weekly
        else:
            return 30  # Monthly
    
    def get_strategy_summary(self) -> Dict:
        """Generate summary of timeline-based strategy"""
        return {
            "registration_date": self.registration_date.isoformat(),
            "election_date": self.election_date.isoformat(),
            "days_remaining": self.days_remaining,
            "mode": self.mode.code,
            "intensity_multiplier": self.intensity_multiplier,
            "current_phase": self.get_current_phase().description,
            "grades_targeted": [g.label for g in self.get_grade_filter()],
            "contact_test_count": self.get_contact_test_count(),
            "reallocation_frequency_days": self.get_reallocation_frequency(),
            "phases": {
                phase.code: {
                    "days": config["days"],
                    "percentage": f"{config['percentage']:.0%}",
                    "start_date": config["start_date"].strftime("%Y-%m-%d"),
                    "end_date": config["end_date"].strftime("%Y-%m-%d")
                }
                for phase, config in self.phases.items()
            },
            "budget_pacing": {
                "period_length": f"{self.budget_pacing['period_length_days']} days",
                "num_periods": self.budget_pacing["num_periods"],
                "ramp_type": self.budget_pacing["ramp_type"]
            }
        }


# =============================================================================
# SECTION 3: ECOSYSTEM INTEGRATION LAYER
# =============================================================================
#
# This LP model INTEGRATES with existing BroyhillGOP ecosystem components.
# It does NOT recreate issue definitions - those already exist and are operational.
#
# EXISTING OPERATIONAL SYSTEMS:
# ├── council_of_state_issue_profiles.py (35+ office-specific issues)
# ├── council_of_state_trigger_engine.py (real-time heat maps, auto-triggers)
# ├── volunteer_issue_priorities table (15 core issues, 0-100 scores)
# ├── candidate_issues_positions table (candidate stances)
# ├── News Intelligence Agent (16+ sources, every 15 min)
# └── County heat maps (response tracking by county + issue)
#
# THIS LP MODEL:
# ├── RECEIVES trigger events from council_of_state_trigger_engine.py
# ├── CONSUMES heat scores already being calculated
# ├── OPTIMIZES budget allocation across triggered campaigns
# ├── RECOMMENDS channels based on urgency + donor grade
# └── TRACKS ROI to feed back into the learning system
#
# =============================================================================

class OfficeType(Enum):
    """
    Office types mapped to existing issue profiles.
    Reference: council_of_state_issue_profiles.py
    """
    # Federal
    FEDERAL_SENATE = ("fed_senate", "Federal - US Senate")
    FEDERAL_HOUSE = ("fed_house", "Federal - US House")
    
    # Statewide
    GOVERNOR = ("governor", "Statewide - Governor")
    
    # Council of State (10 offices - each has specialized issues in ecosystem)
    LT_GOVERNOR = ("lt_governor", "Council of State - Lt. Governor")
    ATTORNEY_GENERAL = ("attorney_general", "Council of State - Attorney General")
    TREASURER = ("treasurer", "Council of State - Treasurer")
    AUDITOR = ("auditor", "Council of State - Auditor")
    SEC_STATE = ("sec_state", "Council of State - Secretary of State")
    SUPT_INSTRUCTION = ("supt", "Council of State - Superintendent")
    AG_COMMISSIONER = ("ag_comm", "Council of State - Agriculture Commissioner")
    INSURANCE_COMM = ("insurance", "Council of State - Insurance Commissioner")
    LABOR_COMM = ("labor", "Council of State - Labor Commissioner")
    
    # NC General Assembly (votes matter!)
    STATE_SENATE = ("state_senate", "NC General Assembly - Senate")
    STATE_HOUSE = ("state_house", "NC General Assembly - House")
    
    # Local (county-specific issues)
    COUNTY_COMMISSION = ("county_comm", "Local - County Commission")
    CITY_COUNCIL = ("city_council", "Local - City/Town Council")
    MAYOR = ("mayor", "Local - Mayor")
    SCHOOL_BOARD = ("school_board", "Local - School Board")
    SHERIFF = ("sheriff", "Local - Sheriff")
    DISTRICT_ATTORNEY = ("da", "Local - District Attorney")
    
    # Judicial
    JUDGE = ("judge", "Judicial")

    def __init__(self, code: str, description: str):
        self.code = code
        self.description = description


class NewsIntensity(Enum):
    """News story intensity level - matches trigger engine classifications"""
    BREAKING = ("breaking", 5.0, 4)      # 5x multiplier, 4-hour window
    HIGH = ("high", 3.0, 12)             # 3x multiplier, 12-hour window
    MEDIUM = ("medium", 2.0, 24)         # 2x multiplier, 24-hour window
    LOW = ("low", 1.5, 48)               # 1.5x multiplier, 48-hour window
    BACKGROUND = ("background", 1.0, 168) # Baseline, 7-day relevance

    def __init__(self, code: str, response_multiplier: float, relevance_hours: int):
        self.code = code
        self.response_multiplier = response_multiplier
        self.relevance_hours = relevance_hours


@dataclass
class TriggerEvent:
    """
    A trigger event received from council_of_state_trigger_engine.py
    
    The LP model receives these when heat thresholds are exceeded
    and optimizes budget allocation in response.
    """
    trigger_id: str
    timestamp: datetime
    
    # Issue from existing ecosystem
    issue_slug: str         # e.g., "government_waste", "crt_opposition"
    issue_name: str         # e.g., "Government Waste & Fraud"
    office_type: OfficeType
    
    # Heat data from trigger engine
    heat_score: float       # 0-100
    heat_threshold: float   # From issue profile
    
    # News event that triggered
    news_headline: str
    news_source: str
    news_url: str
    hours_since_published: float
    
    # Targeting from existing profiles
    donor_segment: str      # e.g., "fiscal_conservatives"
    estimated_donor_count: int
    
    # Urgency from trigger engine
    urgency: str            # "immediate", "same_day", "next_day"
    
    # Geographic scope
    counties_affected: List[str] = field(default_factory=list)
    statewide: bool = False
    
    @property
    def response_multiplier(self) -> float:
        """Calculate response multiplier based on heat"""
        if self.heat_score >= 95:
            return 5.0   # CRISIS level
        elif self.heat_score >= 90:
            return 3.5
        elif self.heat_score >= 85:
            return 2.5
        elif self.heat_score >= 80:
            return 2.0
        elif self.heat_score >= 75:
            return 1.5
        return 1.0


class EcosystemIntegration:
    """
    Integration layer between LP Model and existing BroyhillGOP ecosystem.
    
    CONNECTS TO:
    - council_of_state_trigger_engine.py (receives trigger events)
    - CountyIssueIntelligence (gets county weights)
    - News Intelligence Agent (gets heat scores)
    - Donor database (gets issue priorities)
    
    This class translates ecosystem data into LP model inputs.
    """
    
    # Office-specific issues from council_of_state_issue_profiles.py
    # This is a REFERENCE to existing profiles, not a redefinition
    OFFICE_PROFILES = {
        OfficeType.AUDITOR: {
            "office_name": "State Auditor",
            "primary_issues": ["government_waste", "financial_accountability", "performance_audits"],
            "secondary_issues": ["university_accountability", "medicaid_fraud", "pension_oversight"],
            "heat_range": (75, 85),
            "donor_segments": ["fiscal_conservatives", "accountability_advocates", "limited_government_supporters"]
        },
        OfficeType.ATTORNEY_GENERAL: {
            "office_name": "Attorney General",
            "primary_issues": ["crime_prosecution", "election_enforcement", "opioid_crisis", "consumer_protection"],
            "secondary_issues": ["human_trafficking", "gang_violence"],
            "heat_range": (70, 90),
            "donor_segments": ["law_and_order_supporters", "election_integrity_advocates", "public_safety_advocates"]
        },
        OfficeType.TREASURER: {
            "office_name": "State Treasurer",
            "primary_issues": ["state_pension", "esg_investing", "state_investments"],
            "secondary_issues": ["unclaimed_property", "bond_rating"],
            "heat_range": (80, 90),
            "donor_segments": ["anti_woke_capitalists", "pension_recipients", "fiscal_conservatives"]
        },
        OfficeType.SUPT_INSTRUCTION: {
            "office_name": "Superintendent of Public Instruction",
            "primary_issues": ["crt_opposition", "school_choice", "parental_rights", "school_performance"],
            "secondary_issues": ["teacher_pay", "school_safety"],
            "heat_range": (75, 95),  # HOTTEST
            "donor_segments": ["parents", "school_choice_advocates", "anti_crt_activists"]
        },
        OfficeType.AG_COMMISSIONER: {
            "office_name": "Commissioner of Agriculture",
            "primary_issues": ["farm_economy", "food_safety", "rural_nc"],
            "secondary_issues": ["hemp_cannabis", "environmental_regulations"],
            "heat_range": (70, 80),
            "donor_segments": ["farmers", "rural_voters", "agribusiness"]
        },
        OfficeType.INSURANCE_COMM: {
            "office_name": "Commissioner of Insurance",
            "primary_issues": ["insurance_rates", "hurricane_insurance", "health_insurance"],
            "secondary_issues": ["auto_insurance", "insurance_fraud"],
            "heat_range": (70, 85),
            "donor_segments": ["coastal_residents", "healthcare_voters", "business_owners"]
        },
        OfficeType.LABOR_COMM: {
            "office_name": "Commissioner of Labor",
            "primary_issues": ["workplace_safety", "wage_issues", "right_to_work"],
            "secondary_issues": ["apprenticeship", "elevator_safety"],
            "heat_range": (70, 85),
            "donor_segments": ["business_owners", "workers", "right_to_work_advocates"]
        },
        OfficeType.SEC_STATE: {
            "office_name": "Secretary of State",
            "primary_issues": ["voter_id", "election_admin", "business_filing"],
            "secondary_issues": ["securities_fraud", "notary"],
            "heat_range": (65, 95),
            "donor_segments": ["election_integrity_advocates", "business_owners"]
        },
        OfficeType.LT_GOVERNOR: {
            "office_name": "Lt. Governor",
            "primary_issues": ["senate_leadership", "gubernatorial_succession"],
            "secondary_issues": [],
            "heat_range": (75, 85),
            "donor_segments": ["political_insiders", "senate_watchers"]
        },
        OfficeType.GOVERNOR: {
            "office_name": "Governor",
            "primary_issues": ["state_budget", "executive_orders", "hurricane_response"],
            "secondary_issues": ["economic_development", "covid_response"],
            "heat_range": (80, 90),
            "donor_segments": ["all_republicans", "fiscal_conservatives", "freedom_advocates"]
        },
        # NC General Assembly - VOTES MATTER!
        OfficeType.STATE_SENATE: {
            "office_name": "NC State Senate",
            "primary_issues": ["casinos_gambling", "medicaid_expansion", "state_budget", "redistricting"],
            "secondary_issues": ["teacher_pay", "abc_privatization", "toll_roads", "hurricane_helene"],
            "heat_range": (75, 95),
            "donor_segments": ["varies_by_vote"]  # Berger vs Page = casinos!
        },
        OfficeType.STATE_HOUSE: {
            "office_name": "NC State House",
            "primary_issues": ["casinos_gambling", "medicaid_expansion", "state_budget", "school_choice"],
            "secondary_issues": ["parental_rights", "redistricting", "hurricane_helene"],
            "heat_range": (75, 95),
            "donor_segments": ["varies_by_vote"]
        },
        # Local offices
        OfficeType.SHERIFF: {
            "office_name": "Sheriff",
            "primary_issues": ["crime", "drug_enforcement", "second_amendment"],
            "secondary_issues": ["gang_violence", "immigration_enforcement"],
            "heat_range": (80, 95),
            "donor_segments": ["law_and_order_supporters", "second_amendment_advocates"]
        },
        OfficeType.DISTRICT_ATTORNEY: {
            "office_name": "District Attorney",
            "primary_issues": ["crime_prosecution", "drug_crime", "gang_violence"],
            "secondary_issues": ["bail_reform", "plea_deals"],
            "heat_range": (80, 95),
            "donor_segments": ["law_and_order_supporters", "victims_advocates"]
        },
        OfficeType.SCHOOL_BOARD: {
            "office_name": "School Board",
            "primary_issues": ["parental_rights", "crt_opposition", "school_performance"],
            "secondary_issues": ["transgender_policy", "mask_mandates"],
            "heat_range": (85, 95),
            "donor_segments": ["parents", "anti_crt_activists", "religious_conservatives"]
        },
        OfficeType.COUNTY_COMMISSION: {
            "office_name": "County Commission",
            "primary_issues": ["property_tax", "zoning", "economic_development"],
            "secondary_issues": ["public_safety", "infrastructure"],
            "heat_range": (70, 85),
            "donor_segments": ["property_owners", "business_owners", "rural_voters"]
        }
    }
    
    # County classifications (from existing CountyIssueIntelligence)
    RURAL_COUNTIES = [
        "Alleghany", "Ashe", "Avery", "Beaufort", "Bertie", "Bladen", "Camden",
        "Caswell", "Cherokee", "Chowan", "Clay", "Columbus", "Currituck", "Dare",
        "Duplin", "Gates", "Graham", "Greene", "Halifax", "Hertford", "Hoke",
        "Hyde", "Jackson", "Jones", "Lenoir", "Macon", "Madison", "Martin",
        "McDowell", "Mitchell", "Montgomery", "Northampton", "Pamlico", "Pasquotans",
        "Pender", "Perquimans", "Person", "Polk", "Richmond", "Robeson", "Sampson",
        "Scotland", "Stanly", "Stokes", "Surry", "Swain", "Transylvania", "Tyrrell",
        "Vance", "Warren", "Washington", "Watauga", "Wayne", "Wilkes", "Yadkin", "Yancey"
    ]
    
    SUBURBAN_COUNTIES = [
        "Alamance", "Brunswick", "Burke", "Cabarrus", "Caldwell", "Carteret",
        "Catawba", "Cleveland", "Craven", "Davidson", "Davie", "Franklin",
        "Gaston", "Granville", "Harnett", "Haywood", "Henderson", "Iredell",
        "Johnston", "Lee", "Lincoln", "Moore", "Nash", "Onslow", "Orange",
        "Pitt", "Randolph", "Rockingham", "Rowan", "Rutherford", "Union"
    ]
    
    URBAN_COUNTIES = [
        "Buncombe", "Cumberland", "Durham", "Forsyth", "Guilford",
        "Mecklenburg", "New Hanover", "Wake"
    ]
    
    # Issue response weights by county type (from existing ecosystem learning)
    COUNTY_ISSUE_WEIGHTS = {
        "rural": {
            "second_amendment": 1.8, "farm_economy": 2.0, "religious_freedom": 1.6,
            "immigration": 1.5, "abortion": 1.4, "veterans": 1.5,
            "school_choice": 0.9, "crime": 1.0, "parental_rights": 1.3
        },
        "suburban": {
            "second_amendment": 1.3, "farm_economy": 0.8, "religious_freedom": 1.3,
            "immigration": 1.3, "abortion": 1.2, "veterans": 1.3,
            "school_choice": 1.5, "crime": 1.4, "parental_rights": 1.6
        },
        "urban": {
            "second_amendment": 0.8, "farm_economy": 0.4, "religious_freedom": 1.0,
            "immigration": 1.0, "abortion": 1.1, "veterans": 1.0,
            "school_choice": 1.6, "crime": 1.8, "parental_rights": 1.5
        }
    }
    
    def __init__(self, candidate: 'CandidateProfile'):
        self.candidate = candidate
        self.office_type = self._map_office_type(candidate.office_type)
        self.active_triggers: List[TriggerEvent] = []
        
    def _map_office_type(self, office_str: str) -> OfficeType:
        """Map candidate office string to OfficeType enum"""
        mappings = {
            "State Auditor": OfficeType.AUDITOR, "Auditor": OfficeType.AUDITOR,
            "Attorney General": OfficeType.ATTORNEY_GENERAL,
            "Treasurer": OfficeType.TREASURER, "State Treasurer": OfficeType.TREASURER,
            "Superintendent": OfficeType.SUPT_INSTRUCTION,
            "Agriculture Commissioner": OfficeType.AG_COMMISSIONER,
            "Insurance Commissioner": OfficeType.INSURANCE_COMM,
            "Labor Commissioner": OfficeType.LABOR_COMM,
            "Secretary of State": OfficeType.SEC_STATE,
            "Lt. Governor": OfficeType.LT_GOVERNOR, "Lieutenant Governor": OfficeType.LT_GOVERNOR,
            "Governor": OfficeType.GOVERNOR,
            "State Senate": OfficeType.STATE_SENATE, "NC Senate": OfficeType.STATE_SENATE,
            "State House": OfficeType.STATE_HOUSE, "NC House": OfficeType.STATE_HOUSE,
            "Sheriff": OfficeType.SHERIFF,
            "District Attorney": OfficeType.DISTRICT_ATTORNEY, "DA": OfficeType.DISTRICT_ATTORNEY,
            "School Board": OfficeType.SCHOOL_BOARD,
            "County Commission": OfficeType.COUNTY_COMMISSION,
            "City Council": OfficeType.CITY_COUNCIL,
            "Mayor": OfficeType.MAYOR,
            "US Senate": OfficeType.FEDERAL_SENATE,
            "US House": OfficeType.FEDERAL_HOUSE,
        }
        return mappings.get(office_str, OfficeType.STATE_HOUSE)
    
    def get_office_profile(self) -> Dict:
        """Get the issue profile for this candidate's office"""
        return self.OFFICE_PROFILES.get(self.office_type, {})
    
    def get_county_type(self, county: str) -> str:
        """Get county classification"""
        county_clean = county.replace(" County", "")
        if county_clean in self.URBAN_COUNTIES:
            return "urban"
        elif county_clean in self.SUBURBAN_COUNTIES:
            return "suburban"
        return "rural"
    
    def get_county_issue_weight(self, county: str, issue_slug: str) -> float:
        """Get response weight for issue in this county"""
        county_type = self.get_county_type(county)
        return self.COUNTY_ISSUE_WEIGHTS.get(county_type, {}).get(issue_slug, 1.0)
    
    def receive_trigger(self, trigger: TriggerEvent):
        """Receive a trigger event from the ecosystem trigger engine"""
        self.active_triggers.append(trigger)
    
    def calculate_expected_response(self, 
                                    trigger: TriggerEvent, 
                                    county: str) -> Dict:
        """
        Calculate expected response rate for a trigger + county.
        
        Combines:
        - Base rate (15% for triggered campaigns)
        - Heat multiplier (from trigger event)
        - County weight (from ecosystem learning)
        - Time decay (freshness of news)
        """
        base_rate = 0.15  # 3x standard for triggered campaigns
        
        # Heat multiplier
        heat_mult = trigger.response_multiplier
        
        # County weight
        county_mult = self.get_county_issue_weight(county, trigger.issue_slug)
        
        # Time decay
        hours = trigger.hours_since_published
        if hours < 2:
            time_mult = 1.0
        elif hours < 6:
            time_mult = 0.85
        elif hours < 12:
            time_mult = 0.70
        elif hours < 24:
            time_mult = 0.50
        else:
            time_mult = 0.30
        
        expected_rate = min(0.60, base_rate * heat_mult * county_mult * time_mult)
        
        return {
            "expected_response_rate": expected_rate,
            "multipliers": {
                "heat": heat_mult,
                "county": county_mult,
                "time_decay": time_mult
            }
        }
    
    def get_channel_recommendation(self, urgency: str, donor_grade: str) -> List['Channel']:
        """Recommend channels based on trigger urgency and donor grade"""
        if urgency == "immediate":
            if donor_grade in ["A+", "A", "A-"]:
                return [Channel.TEXT, Channel.EMAIL, Channel.PHONE_CALL]
            elif donor_grade in ["B+", "B", "B-"]:
                return [Channel.TEXT, Channel.EMAIL]
            return [Channel.EMAIL]
        
        elif urgency == "same_day":
            if donor_grade in ["A+", "A", "A-"]:
                return [Channel.EMAIL, Channel.PHONE_CALL]
            return [Channel.EMAIL]
        
        return [Channel.EMAIL]  # next_day

# SECTION 4: ATTRIBUTE CATEGORIES (860 FIELDS ORGANIZED)
# =============================================================================

ATTRIBUTE_CATEGORIES = {
    # Category 1: TRIBAL/ETHNIC IDENTITY (35 fields)
    "ethnic": {
        "fields": [
            "ethnic_origin", "surname_ethnicity", "ethnic_org_membership",
            "ethnic_church_membership", "ethnic_festival_participation",
            "language_spoken_at_home", "immigration_generation",
            "ethnic_media_consumption", "ethnic_business_association",
            "cultural_center_membership"
        ],
        "matching_weight": 0.45,  # Greek→Greek extremely powerful
        "examples": ["Greek", "Italian", "Jewish", "Irish", "Polish", 
                    "Hispanic", "Asian", "Armenian", "Lebanese"]
    },

    # Category 2: MILITARY/VETERAN (25 fields)
    "military": {
        "fields": [
            "veteran_status", "branch_of_service", "years_of_service",
            "highest_rank", "unit_type", "special_forces", "combat_veteran",
            "service_era", "military_decorations", "vfw_member",
            "american_legion_member", "military_officers_association",
            "veteran_charity_involvement", "military_family_member",
            "rotc_participation", "service_academy_grad", "national_guard",
            "reserves_status", "discharge_type", "va_benefits",
            "military_reunion_attendance", "military_social_media_groups",
            "pow_mia_supporter", "wounded_warrior_donor", "uso_supporter"
        ],
        "matching_weight": 0.50,  # Fellow veterans donate 50-90% higher
        "examples": ["Army", "Navy", "Marines", "Air Force", "Coast Guard",
                    "Green Beret", "Navy SEAL", "Ranger", "Combat Veteran"]
    },

    # Category 3: RELIGIOUS AFFILIATION (35 fields)
    "religious": {
        "fields": [
            "religion", "denomination", "church_name", "church_city",
            "church_attendance_frequency", "religious_leadership_role",
            "deacon", "elder", "sunday_school_teacher", "choir_member",
            "tithe_estimate", "faith_based_charity_giving",
            "christian_school_donor", "seminary_support", "mission_support",
            "religious_broadcast_viewer", "christian_media_consumption",
            "bible_study_participant", "religious_retreat_attendance",
            "religious_conference_attendance", "pro_life_organization_member",
            "religious_voter_guide_recipient", "faith_and_freedom_coalition",
            "family_research_council", "religious_liberty_supporter",
            "religious_organization_board", "church_building_fund_donor",
            "pastor_relationship", "denominational_convention_delegate",
            "religious_political_activism", "prayer_breakfast_attendee",
            "faith_based_business_network", "christian_chamber_member",
            "religious_homeschool_association", "parochial_school_alumni"
        ],
        "matching_weight": 0.40,  # Same congregation = near-automatic
        "examples": ["Baptist", "Methodist", "Presbyterian", "Catholic",
                    "Lutheran", "Episcopal", "Pentecostal", "Non-denominational",
                    "Jewish", "LDS", "Orthodox"]
    },

    # Category 4: EDUCATION (40 fields)
    "education": {
        "fields": [
            "university_attended", "degree_type", "graduation_year",
            "major_field", "minor_field", "graduate_school", "law_school",
            "medical_school", "mba_program", "fraternity", "sorority",
            "greek_leadership", "athletic_team", "athletic_booster",
            "alumni_association_member", "alumni_donor_level",
            "class_reunion_attendance", "university_board_member",
            "scholarship_donor", "endowment_contributor", "named_scholarship",
            "building_naming_donor", "professor_relationship",
            "university_sports_season_tickets", "tailgate_club_member",
            "university_foundation_board", "academic_honor_society",
            "professional_fraternity", "study_abroad_program",
            "exchange_student", "high_school", "prep_school",
            "boarding_school", "private_school", "parochial_school",
            "homeschool_background", "academic_awards", "valedictorian",
            "national_merit_scholar", "phi_beta_kappa"
        ],
        "matching_weight": 0.35,  # Same school = 2x response rate
        "examples": ["UNC", "NC State", "Duke", "Wake Forest", "ECU",
                    "App State", "UNCC", "Davidson", "Elon"]
    },

    # Category 5: PROFESSIONAL/OCCUPATIONAL (55 fields)
    "professional": {
        "fields": [
            "current_employer", "current_title", "industry", "occupation",
            "years_in_industry", "professional_license", "board_certifications",
            "bar_membership", "medical_license", "cpa_license", "cfa_charter",
            "professional_association_member", "trade_association_member",
            "chamber_of_commerce_member", "rotary_member", "kiwanis_member",
            "lions_club_member", "business_owner", "company_founder",
            "company_revenue", "employee_count", "business_type",
            "franchise_owner", "real_estate_investor", "landlord",
            "property_count", "family_business", "succession_planning",
            "industry_conference_speaker", "industry_award_recipient",
            "linkedin_connections", "linkedin_influence_score",
            "professional_publication_author", "patent_holder",
            "board_of_directors_seats", "advisory_board_seats",
            "startup_investor", "angel_investor", "venture_capital_connection",
            "private_equity_connection", "executive_compensation",
            "stock_options", "retirement_status", "consulting_practice",
            "expert_witness", "media_commentator", "podcast_guest",
            "keynote_speaker", "book_author", "thought_leader",
            "industry_influencer", "professional_mentor", "executive_coach",
            "career_transition", "second_career"
        ],
        "matching_weight": 0.30,  # Same industry supports own
        "examples": ["Attorney", "Physician", "Real Estate", "Finance",
                    "Technology", "Manufacturing", "Agriculture", "Retail",
                    "Construction", "Healthcare"]
    },

    # Category 6: GEOGRAPHIC (30 fields)
    "geographic": {
        "fields": [
            "current_county", "current_city", "current_zip", "precinct",
            "congressional_district", "state_senate_district",
            "state_house_district", "municipal_district", "school_district",
            "years_at_address", "hometown", "birth_state", "birth_county",
            "high_school_county", "college_county", "previous_addresses",
            "vacation_property_locations", "investment_property_locations",
            "work_county", "commute_pattern", "urban_suburban_rural",
            "neighborhood_type", "gated_community", "country_club_community",
            "hoa_membership", "neighborhood_association",
            "local_civic_organization", "county_fair_participant",
            "local_festival_volunteer", "community_foundation_donor"
        ],
        "matching_weight": 0.25,  # Local ties matter
        "examples": ["Wake", "Mecklenburg", "Guilford", "Forsyth", "Durham",
                    "Cumberland", "Buncombe", "New Hanover", "Union", "Gaston"]
    },

    # Category 7: CHARITABLE GIVING (45 fields)
    "charitable": {
        "fields": [
            "total_charitable_giving", "charitable_focus_areas",
            "foundation_board_member", "nonprofit_board_member",
            "united_way_donor", "community_foundation_donor",
            "hospital_donor", "hospital_board_member", "named_hospital_wing",
            "university_donor", "scholarship_fund_donor", "endowment_donor",
            "arts_donor", "symphony_donor", "museum_donor", "theater_donor",
            "public_radio_donor", "public_tv_donor", "library_donor",
            "animal_welfare_donor", "humane_society_donor", "spca_donor",
            "environmental_donor", "conservation_donor", "land_trust_donor",
            "youth_organization_donor", "boys_girls_club_donor",
            "scouting_donor", "ymca_donor", "habitat_for_humanity_donor",
            "food_bank_donor", "homeless_shelter_donor", "disaster_relief_donor",
            "red_cross_donor", "salvation_army_donor", "goodwill_donor",
            "medical_research_donor", "disease_specific_charity_donor",
            "international_aid_donor", "missionary_support_donor",
            "donor_advised_fund", "private_foundation", "charitable_remainder_trust",
            "planned_giving_prospect", "major_gift_history"
        ],
        "matching_weight": 0.35,  # Shows capacity + values
        "examples": ["Education", "Healthcare", "Arts", "Environment",
                    "Youth", "Religious", "Animal Welfare", "Poverty"]
    },

    # Category 8: POLITICAL BEHAVIOR (75 fields)
    "political": {
        "fields": [
            "party_registration", "registration_date", "voter_status",
            "primary_vote_history", "general_vote_history", "voting_frequency",
            "early_voter", "absentee_voter", "poll_worker", "election_judge",
            "precinct_captain", "county_party_member", "state_party_member",
            "convention_delegate", "rnc_delegate", "state_convention_delegate",
            "county_executive_committee", "precinct_chair", "party_officer",
            "campaign_volunteer_history", "door_knocker", "phone_banker",
            "campaign_manager", "campaign_treasurer", "campaign_consultant",
            "yard_sign_host", "bumper_sticker_displayer", "rally_attendee",
            "town_hall_attendee", "meet_and_greet_attendee", "fundraiser_host",
            "bundler", "maxed_out_donor", "pac_contributor", "super_pac_donor",
            "527_contributor", "political_action_committee_member",
            "lobbying_activity", "registered_lobbyist", "government_contractor",
            "appointed_position", "elected_position_history", "candidate_history",
            "political_family", "political_dynasty", "endorsement_giver",
            "political_social_media_activity", "political_content_sharer",
            "petition_signer", "ballot_initiative_supporter", "recall_participant",
            "redistricting_participant", "poll_watcher", "election_observer",
            "recount_volunteer", "voter_registration_drive_volunteer",
            "get_out_the_vote_volunteer", "political_event_organizer",
            "political_club_member", "young_republicans", "college_republicans",
            "teenage_republicans", "republican_women", "republican_men",
            "lincoln_day_dinner_attendee", "reagan_dinner_attendee",
            "trump_rally_attendee", "maga_event_attendee", "tea_party_member",
            "freedom_caucus_supporter", "establishment_supporter",
            "never_trump", "always_trump", "trump_donor", "desantis_donor"
        ],
        "matching_weight": 0.20,  # Already donors, baseline
        "examples": ["Primary Voter", "Convention Delegate", "Precinct Chair",
                    "Bundler", "PAC Contributor", "Rally Attendee"]
    },

    # Category 9: ISSUE PRIORITIES (80 fields - 20 issues × 4 measures)
    "issues": {
        "fields": [
            # Each issue has: priority_score, giving_history, activism_level, social_media_engagement
            "abortion_priority", "abortion_giving", "abortion_activism", "abortion_social",
            "second_amendment_priority", "second_amendment_giving", "second_amendment_activism", "second_amendment_social",
            "tax_reform_priority", "tax_reform_giving", "tax_reform_activism", "tax_reform_social",
            "election_integrity_priority", "election_integrity_giving", "election_integrity_activism", "election_integrity_social",
            "parental_rights_priority", "parental_rights_giving", "parental_rights_activism", "parental_rights_social",
            "school_choice_priority", "school_choice_giving", "school_choice_activism", "school_choice_social",
            "border_security_priority", "border_security_giving", "border_security_activism", "border_security_social",
            "energy_independence_priority", "energy_independence_giving", "energy_independence_activism", "energy_independence_social",
            "crime_law_order_priority", "crime_law_order_giving", "crime_law_order_activism", "crime_law_order_social",
            "religious_freedom_priority", "religious_freedom_giving", "religious_freedom_activism", "religious_freedom_social",
            "free_speech_priority", "free_speech_giving", "free_speech_activism", "free_speech_social",
            "healthcare_priority", "healthcare_giving", "healthcare_activism", "healthcare_social",
            "veterans_affairs_priority", "veterans_affairs_giving", "veterans_affairs_activism", "veterans_affairs_social",
            "agriculture_priority", "agriculture_giving", "agriculture_activism", "agriculture_social",
            "small_business_priority", "small_business_giving", "small_business_activism", "small_business_social",
            "deregulation_priority", "deregulation_giving", "deregulation_activism", "deregulation_social",
            "judicial_reform_priority", "judicial_reform_giving", "judicial_reform_activism", "judicial_reform_social",
            "term_limits_priority", "term_limits_giving", "term_limits_activism", "term_limits_social",
            "balanced_budget_priority", "balanced_budget_giving", "balanced_budget_activism", "balanced_budget_social",
            "national_defense_priority", "national_defense_giving", "national_defense_activism", "national_defense_social"
        ],
        "matching_weight": 0.40,  # Issue alignment critical
        "examples": ["Pro-Life", "2nd Amendment", "Border Security", 
                    "School Choice", "Election Integrity", "Tax Reform"]
    },

    # Category 10: WEALTH INDICATORS (60 fields)
    "wealth": {
        "fields": [
            "estimated_net_worth", "net_worth_confidence", "income_range",
            "income_source", "w2_income", "business_income", "investment_income",
            "rental_income", "retirement_income", "social_security",
            "pension", "trust_income", "inheritance_received", "inheritance_expected",
            "property_count", "primary_residence_value", "primary_residence_equity",
            "vacation_property", "vacation_property_value", "investment_property_count",
            "investment_property_value", "commercial_property", "farm_land",
            "timber_land", "mineral_rights", "oil_gas_royalties",
            "stock_portfolio_estimate", "bond_holdings", "mutual_funds",
            "retirement_accounts", "ira_value", "401k_value", "pension_value",
            "brokerage_accounts", "cryptocurrency_holdings", "art_collection",
            "antique_collection", "wine_collection", "car_collection",
            "boat_ownership", "boat_value", "aircraft_ownership", "aircraft_value",
            "country_club_membership", "country_club_initiation_fee",
            "private_school_tuition", "private_college_tuition",
            "luxury_vehicle_count", "luxury_vehicle_brands", "private_jet_usage",
            "first_class_travel", "luxury_hotel_preferences", "concierge_services",
            "private_banking_client", "wealth_manager", "family_office",
            "estate_planning_complete", "charitable_capacity_score",
            "giving_capacity_score", "lifestyle_indicators_score"
        ],
        "matching_weight": 0.15,  # Capacity, not affinity
        "examples": ["$1M+", "$5M+", "$10M+", "$50M+", "Country Club",
                    "Private Jet", "Multiple Properties", "Family Office"]
    }
}


# =============================================================================
# SECTION 3: DATA CLASSES
# =============================================================================

@dataclass
class CandidateProfile:
    """Candidate profile for matching (500+ fields compressed)"""
    candidate_id: str
    name: str
    office_type: str  # Federal, Statewide, State Legislative, County, Municipal, Judicial
    district: str
    county: str
    
    # Timeline
    registration_date: datetime = field(default_factory=datetime.now)
    election_date: datetime = field(default_factory=lambda: datetime.now() + timedelta(days=365))
    
    # Key matching attributes
    military_veteran: bool = False
    military_branch: Optional[str] = None
    military_unit: Optional[str] = None
    combat_veteran: bool = False
    
    religion: Optional[str] = None
    denomination: Optional[str] = None
    church_name: Optional[str] = None
    
    education_university: Optional[str] = None
    education_fraternity: Optional[str] = None
    education_degree: Optional[str] = None
    
    profession: Optional[str] = None
    industry: Optional[str] = None
    business_owner: bool = False
    
    ethnic_background: Optional[str] = None
    ethnic_organizations: List[str] = field(default_factory=list)
    
    # Issue positions (0-100 priority)
    issue_priorities: Dict[str, int] = field(default_factory=dict)
    
    # Campaign parameters
    budget_total: float = 0.0
    fundraising_goal: float = 0.0


@dataclass
class DonorProfile:
    """Donor profile with 860 fields compressed"""
    donor_id: str
    name: str
    county: str
    
    # 4-Layer Grading
    amount_grade: Grade = Grade.U
    amount_score: float = 0.0  # Actual dollar total
    history_score: int = 0      # 0-100
    intensity_score: int = 0    # 0-100
    recency_score: int = 0      # 0-100
    composite_score: int = 0    # Calculated (H+I+R)/3 or weighted
    
    # Rankings
    state_rank: int = 0
    county_rank: int = 0
    
    # Attribute data (simplified for model)
    attributes: Dict[str, any] = field(default_factory=dict)
    
    # Response history
    total_touches: int = 0
    total_responses: int = 0
    total_donations: int = 0
    total_donated: float = 0.0
    response_rate: float = 0.0
    
    # Calculated fields
    affinity_score: float = 0.0
    predicted_response_rate: float = 0.0
    predicted_gift_amount: float = 0.0


@dataclass
class Segment:
    """A donor segment based on shared attributes"""
    segment_id: str
    name: str
    attribute_category: str
    attribute_value: str
    
    # Segment statistics
    donor_count: int = 0
    total_capacity: float = 0.0
    
    # Observed performance
    touches: int = 0
    responses: int = 0
    donations: int = 0
    amount_raised: float = 0.0
    
    # Calculated rates
    response_rate: float = 0.0
    donation_rate: float = 0.0
    average_gift: float = 0.0
    
    # Variance from baseline
    expected_response_rate: float = 0.0
    variance: float = 0.0  # (actual - expected) / expected
    
    # Budget allocation
    current_budget: float = 0.0
    recommended_budget: float = 0.0


@dataclass
class TouchResult:
    """Result of a campaign touch"""
    donor_id: str
    segment_id: str
    channel: Channel
    message_type: MessageType
    timestamp: datetime
    
    opened: bool = False
    clicked: bool = False
    responded: bool = False
    donated: bool = False
    donation_amount: float = 0.0
    
    cost: float = 0.0


# =============================================================================
# SECTION 4: LINEAR PROGRAMMING MODEL
# =============================================================================

class CampaignOptimizer:
    """
    Linear Programming Campaign Optimizer with Dynamic Timeline
    
    Solves:
        MAXIMIZE: Σ (Xijk × Rijk × Gijk)
        
        Where:
            Xijk = Touches to segment i, channel j, message k
            Rijk = Response rate for segment i, channel j, message k
            Gijk = Average gift for segment i, channel j, message k
            
        SUBJECT TO:
            Σ (Xijk × Cj) ≤ Budget           (Cost constraint)
            Σ Xijk ≤ 3 per donor per month    (Fatigue constraint)
            Σ Xijk ≥ 1 for A+ donors          (Coverage constraint)
            Xijk ≥ 0                          (Non-negativity)
            
    Timeline-Aware:
        - Adjusts phase allocation based on days remaining
        - Modifies intensity based on campaign mode
        - Filters grades based on time available
        - Adjusts reallocation frequency dynamically
    """
    
    def __init__(self, candidate: CandidateProfile):
        self.candidate = candidate
        self.timeline = CampaignTimeline(
            registration_date=candidate.registration_date,
            election_date=candidate.election_date
        )
        self.segments: Dict[str, Segment] = {}
        self.donors: Dict[str, DonorProfile] = {}
        self.touch_history: List[TouchResult] = []
        
        # ECOSYSTEM INTEGRATION (connects to existing issue monitoring)
        self.ecosystem = EcosystemIntegration(candidate)
        
        # Issue-triggered campaign tracking
        self.active_triggers: List[TriggerEvent] = []
        self.trigger_campaign_results: Dict[str, Dict] = {}  # By county+issue
        
        # Model parameters (learned from data)
        self.baseline_response_rates: Dict[Grade, float] = {
            Grade.A_PLUS: 0.45,
            Grade.A: 0.35,
            Grade.A_MINUS: 0.28,
            Grade.B_PLUS: 0.22,
            Grade.B: 0.18,
            Grade.B_MINUS: 0.15,
            Grade.C_PLUS: 0.12,
            Grade.C: 0.10,
            Grade.C_MINUS: 0.08,
            Grade.D_PLUS: 0.06,
            Grade.D: 0.04,
            Grade.D_MINUS: 0.03,
            Grade.U: 0.02
        }
        
        self.baseline_gift_amounts: Dict[Grade, float] = {
            Grade.A_PLUS: 5000.00,
            Grade.A: 2500.00,
            Grade.A_MINUS: 1500.00,
            Grade.B_PLUS: 1000.00,
            Grade.B: 500.00,
            Grade.B_MINUS: 250.00,
            Grade.C_PLUS: 150.00,
            Grade.C: 100.00,
            Grade.C_MINUS: 75.00,
            Grade.D_PLUS: 50.00,
            Grade.D: 35.00,
            Grade.D_MINUS: 25.00,
            Grade.U: 15.00
        }
        
        # Channel effectiveness multipliers (learned)
        self.channel_multipliers: Dict[Channel, float] = {
            Channel.EMAIL: 1.0,
            Channel.TEXT: 1.2,
            Channel.RINGLESS_VOICEMAIL: 0.8,
            Channel.PHONE_CALL: 2.5,
            Channel.DIRECT_MAIL: 1.5,
            Channel.PERSONAL_LETTER: 2.0,
            Channel.HANDWRITTEN_NOTE: 3.0,
            Channel.EVENT_INVITATION: 2.5,
            Channel.PERSONAL_MEETING: 5.0
        }
        
        # Attribute affinity multipliers (learned from candidate match)
        self.affinity_multipliers: Dict[str, float] = {}
        
    def calculate_affinity_score(self, donor: DonorProfile) -> float:
        """
        Calculate donor-candidate affinity score based on matching attributes
        
        Returns: 0-100 score
        """
        score = 0.0
        matches = []
        
        # Military match (50% weight if candidate is veteran)
        if self.candidate.military_veteran:
            donor_military = donor.attributes.get("military", {})
            if donor_military.get("veteran_status"):
                score += 20
                matches.append("veteran")
                if donor_military.get("branch") == self.candidate.military_branch:
                    score += 15
                    matches.append(f"same_branch_{self.candidate.military_branch}")
                if donor_military.get("combat_veteran") and self.candidate.combat_veteran:
                    score += 10
                    matches.append("combat_veteran")
                if donor_military.get("unit_type") == self.candidate.military_unit:
                    score += 5
                    matches.append(f"same_unit_{self.candidate.military_unit}")
        
        # Religious match (40% weight)
        donor_religious = donor.attributes.get("religious", {})
        if donor_religious.get("denomination") == self.candidate.denomination:
            score += 15
            matches.append(f"same_denomination_{self.candidate.denomination}")
        if donor_religious.get("church_name") == self.candidate.church_name:
            score += 10
            matches.append("same_church")
        if donor_religious.get("religion") == self.candidate.religion:
            score += 5
            matches.append(f"same_religion_{self.candidate.religion}")
        
        # Education match (35% weight)
        donor_education = donor.attributes.get("education", {})
        if donor_education.get("university") == self.candidate.education_university:
            score += 15
            matches.append(f"same_university_{self.candidate.education_university}")
        if donor_education.get("fraternity") == self.candidate.education_fraternity:
            score += 5
            matches.append(f"same_fraternity_{self.candidate.education_fraternity}")
        
        # Professional match (30% weight)
        donor_professional = donor.attributes.get("professional", {})
        if donor_professional.get("industry") == self.candidate.industry:
            score += 10
            matches.append(f"same_industry_{self.candidate.industry}")
        if donor_professional.get("profession") == self.candidate.profession:
            score += 5
            matches.append(f"same_profession_{self.candidate.profession}")
        
        # Ethnic match (45% weight - very powerful)
        donor_ethnic = donor.attributes.get("ethnic", {})
        if donor_ethnic.get("ethnic_origin") == self.candidate.ethnic_background:
            score += 25
            matches.append(f"same_ethnicity_{self.candidate.ethnic_background}")
        
        # Geographic match (25% weight)
        if donor.county == self.candidate.county:
            score += 10
            matches.append(f"same_county_{self.candidate.county}")
        
        # Issue alignment (40% weight)
        donor_issues = donor.attributes.get("issues", {})
        issue_matches = 0
        for issue, candidate_priority in self.candidate.issue_priorities.items():
            if candidate_priority >= 70:  # Candidate cares about this
                donor_priority = donor_issues.get(f"{issue}_priority", 0)
                if donor_priority >= 70:
                    issue_matches += 1
        if issue_matches >= 5:
            score += 15
            matches.append(f"strong_issue_alignment_{issue_matches}")
        elif issue_matches >= 3:
            score += 10
            matches.append(f"moderate_issue_alignment_{issue_matches}")
        elif issue_matches >= 1:
            score += 5
            matches.append(f"some_issue_alignment_{issue_matches}")
        
        donor.affinity_score = min(score, 100)
        return donor.affinity_score
    
    def calculate_predicted_response(self, donor: DonorProfile, 
                                     channel: Channel,
                                     message_type: MessageType) -> Tuple[float, float]:
        """
        Calculate predicted response rate and gift amount for a specific touch
        
        Returns: (predicted_response_rate, predicted_gift_amount)
        """
        # Start with baseline for grade
        base_response = self.baseline_response_rates[donor.amount_grade]
        base_gift = self.baseline_gift_amounts[donor.amount_grade]
        
        # Apply affinity multiplier (higher affinity = higher response)
        affinity_multiplier = 1.0 + (donor.affinity_score / 100)
        
        # Apply channel multiplier
        channel_mult = self.channel_multipliers[channel]
        
        # Apply recency factor (recent donors more likely to respond)
        recency_mult = 0.5 + (donor.recency_score / 100)
        
        # Apply intensity factor (high intensity = more likely to respond)
        intensity_mult = 0.7 + (donor.intensity_score / 100) * 0.6
        
        # Apply personal history if available
        history_mult = 1.0
        if donor.total_touches > 0:
            history_mult = max(0.5, donor.response_rate / base_response) if base_response > 0 else 1.0
        
        # Calculate final prediction
        predicted_response = min(0.95, base_response * affinity_multiplier * 
                                 channel_mult * recency_mult * intensity_mult * history_mult)
        
        predicted_gift = base_gift * affinity_multiplier * intensity_mult
        
        return predicted_response, predicted_gift
    
    def build_segments(self, donors: List[DonorProfile]) -> Dict[str, Segment]:
        """
        Build donor segments based on attributes and candidate matching
        """
        self.donors = {d.donor_id: d for d in donors}
        segments = {}
        
        # Calculate affinity for all donors
        for donor in donors:
            self.calculate_affinity_score(donor)
        
        # Create segments by attribute category
        for category, config in ATTRIBUTE_CATEGORIES.items():
            # Get unique values for this category across all donors
            values = set()
            for donor in donors:
                cat_data = donor.attributes.get(category, {})
                for field in config["fields"][:5]:  # Top fields only
                    val = cat_data.get(field)
                    if val and val != "Unknown":
                        values.add(str(val))
            
            # Create segment for each value
            for value in values:
                segment_id = f"{category}_{value}".replace(" ", "_").lower()
                segment = Segment(
                    segment_id=segment_id,
                    name=f"{category.title()}: {value}",
                    attribute_category=category,
                    attribute_value=value,
                    expected_response_rate=self.baseline_response_rates[Grade.C]  # Default
                )
                
                # Count donors in segment
                for donor in donors:
                    cat_data = donor.attributes.get(category, {})
                    for field in config["fields"][:5]:
                        if str(cat_data.get(field)) == value:
                            segment.donor_count += 1
                            segment.total_capacity += self.baseline_gift_amounts[donor.amount_grade]
                            break
                
                if segment.donor_count > 0:
                    segments[segment_id] = segment
        
        # Create grade-based segments
        for grade in Grade:
            segment_id = f"grade_{grade.label}".lower()
            grade_donors = [d for d in donors if d.amount_grade == grade]
            
            segment = Segment(
                segment_id=segment_id,
                name=f"Grade: {grade.label}",
                attribute_category="grade",
                attribute_value=grade.label,
                donor_count=len(grade_donors),
                total_capacity=sum(self.baseline_gift_amounts[grade] for _ in grade_donors),
                expected_response_rate=self.baseline_response_rates[grade]
            )
            segments[segment_id] = segment
        
        self.segments = segments
        return segments
    
    def optimize_allocation(self, 
                           period_budget: float,
                           period: int) -> Dict[str, Dict]:
        """
        Solve LP to find optimal budget allocation across segments/channels
        
        This is the core optimization that maximizes expected donations
        subject to budget and fatigue constraints.
        
        Uses dynamic timeline to adjust strategy based on time remaining.
        
        Returns: Allocation plan by segment
        """
        # Get current phase from timeline
        current_phase = self.timeline.get_current_phase()
        
        # Filter grades based on time remaining
        allowed_grades = self.timeline.get_grade_filter()
        
        allocations = {}
        remaining_budget = period_budget
        
        # Apply intensity multiplier to expectations
        intensity = self.timeline.intensity_multiplier
        
        # Sort segments by expected ROI (adjusted for timeline)
        segment_roi = []
        for seg_id, segment in self.segments.items():
            if segment.donor_count == 0:
                continue
            
            # Skip grades not in allowed list for this timeline
            if segment.attribute_category == "grade":
                grade_in_segment = False
                for grade in allowed_grades:
                    if grade.label in segment.attribute_value:
                        grade_in_segment = True
                        break
                if not grade_in_segment:
                    continue
            
            # Calculate expected ROI for this segment
            expected_response = segment.response_rate if segment.touches > 0 else segment.expected_response_rate
            expected_gift = segment.amount_raised / segment.donations if segment.donations > 0 else 100
            
            # Adjust for variance (positive variance = invest more)
            variance_mult = 1.0 + segment.variance if segment.variance > 0 else max(0.2, 1.0 + segment.variance)
            
            # Apply intensity multiplier (more aggressive when less time)
            expected_roi = (expected_response * expected_gift * variance_mult * intensity) / Channel.EMAIL.cost_per_touch
            segment_roi.append((seg_id, expected_roi, segment))
        
        # Sort by ROI descending
        segment_roi.sort(key=lambda x: x[1], reverse=True)
        
        # Allocate budget by ROI
        for seg_id, roi, segment in segment_roi:
            if remaining_budget <= 0:
                break
            
            # Determine appropriate channels for this segment and phase
            channels = self._select_channels_for_segment(segment, current_phase)
            
            # Calculate allocation for this segment
            # Higher ROI segments get more budget
            total_roi = sum(r[1] for r in segment_roi if r[1] > 0)
            roi_share = roi / total_roi if total_roi > 0 else 0
            
            # Adjust share based on phase (harvest = more aggressive)
            if current_phase == CampaignPhase.HARVEST:
                roi_share *= 1.5
            elif current_phase == CampaignPhase.ENGAGE:
                roi_share *= 1.2
            
            segment_budget = period_budget * roi_share
            segment_budget = min(segment_budget, remaining_budget)
            
            # Calculate touches per channel
            channel_allocation = {}
            for channel in channels:
                # Respect fatigue constraint (adjusted by period length)
                period_days = self.timeline.budget_pacing["period_length_days"]
                max_touches_per_day = 3 / 30  # 3 per month baseline
                max_touches = int(segment.donor_count * max_touches_per_day * period_days)
                
                affordable_touches = segment_budget * 0.3 / channel.cost_per_touch
                touches = min(max_touches, affordable_touches)
                
                if touches > 0:
                    response_rate = segment.response_rate or segment.expected_response_rate
                    channel_allocation[channel.code] = {
                        "touches": int(touches),
                        "cost": touches * channel.cost_per_touch,
                        "expected_responses": touches * response_rate,
                        "expected_donations": touches * response_rate * 0.5,
                        "expected_revenue": touches * response_rate * 0.5 * 
                                           (segment.average_gift if segment.average_gift > 0 else 100)
                    }
            
            if channel_allocation:
                total_cost = sum(c["cost"] for c in channel_allocation.values())
                total_expected = sum(c["expected_revenue"] for c in channel_allocation.values())
                
                allocations[seg_id] = {
                    "segment_name": segment.name,
                    "donor_count": segment.donor_count,
                    "channels": channel_allocation,
                    "total_budget": total_cost,
                    "expected_revenue": total_expected,
                    "expected_roi": total_expected / total_cost if total_cost > 0 else 0,
                    "variance": segment.variance,
                    "recommendation": self._get_recommendation(segment)
                }
                
                remaining_budget -= total_cost
        
        return allocations
    
    def _select_channels_for_segment(self, segment: Segment, 
                                     phase: CampaignPhase) -> List[Channel]:
        """Select appropriate channels based on segment, phase, and timeline mode"""
        
        # Emergency mode = high-touch only
        if self.timeline.mode == CampaignMode.EMERGENCY:
            if "A+" in segment.attribute_value or "A" in segment.attribute_value:
                return [Channel.PERSONAL_MEETING, Channel.PHONE_CALL]
            else:
                return [Channel.PHONE_CALL, Channel.EMAIL]
        
        # Urgent mode = accelerated channel selection
        if self.timeline.mode == CampaignMode.URGENT:
            if "A" in segment.attribute_value:
                return [Channel.PHONE_CALL, Channel.PERSONAL_LETTER, Channel.EMAIL]
            elif "B" in segment.attribute_value:
                return [Channel.PHONE_CALL, Channel.EMAIL, Channel.TEXT]
            else:
                return [Channel.EMAIL, Channel.TEXT]
        
        # Standard grade-based channel selection
        if "A+" in segment.attribute_value or "A" in segment.attribute_value:
            # High-value donors get high-touch channels
            if phase == CampaignPhase.HARVEST:
                return [Channel.PERSONAL_MEETING, Channel.PHONE_CALL, Channel.HANDWRITTEN_NOTE]
            elif phase == CampaignPhase.ENGAGE:
                return [Channel.PHONE_CALL, Channel.PERSONAL_LETTER, Channel.EMAIL]
            else:
                return [Channel.EMAIL, Channel.DIRECT_MAIL, Channel.PHONE_CALL]
        
        elif "B" in segment.attribute_value:
            # Mid-value donors
            if phase == CampaignPhase.HARVEST:
                return [Channel.PHONE_CALL, Channel.DIRECT_MAIL, Channel.EMAIL]
            else:
                return [Channel.EMAIL, Channel.TEXT, Channel.DIRECT_MAIL]
        
        elif "C" in segment.attribute_value:
            # Lower-value donors
            return [Channel.EMAIL, Channel.TEXT, Channel.RINGLESS_VOICEMAIL]
        
        else:
            # Default / attribute-based segments
            return [Channel.EMAIL, Channel.TEXT]
    
    def _get_recommendation(self, segment: Segment) -> str:
        """Generate recommendation based on segment performance"""
        if segment.variance >= 0.4:
            return "INCREASE: Outperforming by 40%+, double investment"
        elif segment.variance >= 0.2:
            return "INCREASE: Strong performance, increase investment 50%"
        elif segment.variance >= 0.0:
            return "HOLD: Meeting expectations, maintain investment"
        elif segment.variance >= -0.2:
            return "MONITOR: Slightly underperforming, watch closely"
        elif segment.variance >= -0.4:
            return "DECREASE: Underperforming, reduce investment 50%"
        else:
            return "PAUSE: Severely underperforming, pause and reassess"
    
    def record_touch(self, result: TouchResult):
        """Record a touch result and update segment statistics"""
        self.touch_history.append(result)
        
        # Update segment statistics
        if result.segment_id in self.segments:
            segment = self.segments[result.segment_id]
            segment.touches += 1
            if result.responded:
                segment.responses += 1
            if result.donated:
                segment.donations += 1
                segment.amount_raised += result.donation_amount
            
            # Recalculate rates
            segment.response_rate = segment.responses / segment.touches if segment.touches > 0 else 0
            segment.donation_rate = segment.donations / segment.touches if segment.touches > 0 else 0
            segment.average_gift = segment.amount_raised / segment.donations if segment.donations > 0 else 0
            
            # Calculate variance from expectation
            if segment.expected_response_rate > 0:
                segment.variance = (segment.response_rate - segment.expected_response_rate) / segment.expected_response_rate
        
        # Update donor statistics
        if result.donor_id in self.donors:
            donor = self.donors[result.donor_id]
            donor.total_touches += 1
            if result.responded:
                donor.total_responses += 1
            if result.donated:
                donor.total_donations += 1
                donor.total_donated += result.donation_amount
            donor.response_rate = donor.total_responses / donor.total_touches if donor.total_touches > 0 else 0
    
    def generate_strategy(self) -> Dict:
        """
        Generate complete campaign strategy based on dynamic timeline
        
        Returns: Full strategy document with period-based plans
        """
        strategy = {
            "candidate": {
                "name": self.candidate.name,
                "office": self.candidate.office_type,
                "district": self.candidate.district,
                "budget_total": self.candidate.budget_total,
                "fundraising_goal": self.candidate.fundraising_goal
            },
            "timeline": self.timeline.get_strategy_summary(),
            "donor_universe": {
                "total_donors": len(self.donors),
                "targeted_grades": [g.label for g in self.timeline.get_grade_filter()],
                "by_grade": {},
                "total_capacity": 0
            },
            "segments": {},
            "period_plans": {},
            "projections": {
                "total_expected_raised": 0,
                "total_expected_donors": 0,
                "total_touches": 0,
                "total_cost": 0,
                "projected_roi": 0
            }
        }
        
        # Summarize donors by grade (only targeted grades)
        allowed_grades = self.timeline.get_grade_filter()
        for grade in Grade:
            grade_donors = [d for d in self.donors.values() if d.amount_grade == grade]
            capacity = sum(self.baseline_gift_amounts[grade] for _ in grade_donors)
            
            is_targeted = grade in allowed_grades
            strategy["donor_universe"]["by_grade"][grade.label] = {
                "count": len(grade_donors),
                "capacity": capacity,
                "targeted": is_targeted
            }
            if is_targeted:
                strategy["donor_universe"]["total_capacity"] += capacity
        
        # Add segment summaries
        for seg_id, segment in self.segments.items():
            strategy["segments"][seg_id] = {
                "name": segment.name,
                "donor_count": segment.donor_count,
                "expected_response_rate": segment.expected_response_rate,
                "observed_response_rate": segment.response_rate,
                "variance": segment.variance
            }
        
        # Generate period-based plans using dynamic timeline
        budget_pacing = self.timeline.budget_pacing
        num_periods = budget_pacing["num_periods"]
        
        for period_info in budget_pacing["periods"]:
            period = period_info["period"]
            period_budget = self.candidate.budget_total * period_info["budget_percentage"]
            
            allocation = self.optimize_allocation(period_budget, period)
            
            period_total_cost = sum(a["total_budget"] for a in allocation.values())
            period_expected_revenue = sum(a["expected_revenue"] for a in allocation.values())
            
            # Determine which phase this period is in
            days_into_campaign = period_info["days_from_start"]
            period_phase = CampaignPhase.DISCOVER
            for phase, config in self.timeline.phases.items():
                if config["start_day"] <= days_into_campaign <= config["end_day"]:
                    period_phase = phase
                    break
            
            strategy["period_plans"][f"period_{period}"] = {
                "period_number": period,
                "days_from_start": period_info["days_from_start"],
                "phase": period_phase.description,
                "budget": period_budget,
                "budget_percentage": f"{period_info['budget_percentage']:.1%}",
                "allocation": allocation,
                "expected_revenue": period_expected_revenue,
                "expected_roi": period_expected_revenue / period_total_cost if period_total_cost > 0 else 0
            }
            
            strategy["projections"]["total_expected_raised"] += period_expected_revenue
            strategy["projections"]["total_cost"] += period_total_cost
        
        strategy["projections"]["projected_roi"] = (
            strategy["projections"]["total_expected_raised"] / 
            strategy["projections"]["total_cost"]
            if strategy["projections"]["total_cost"] > 0 else 0
        )
        
        # Add timeline-specific recommendations
        strategy["recommendations"] = self._generate_timeline_recommendations()
        
        return strategy
    
    def _generate_timeline_recommendations(self) -> List[str]:
        """Generate recommendations based on timeline mode"""
        recommendations = []
        
        mode = self.timeline.mode
        days = self.timeline.days_remaining
        
        if mode == CampaignMode.EMERGENCY:
            recommendations.append(f"EMERGENCY MODE: Only {days} days remaining")
            recommendations.append("Focus exclusively on A+, A, and A- grade donors")
            recommendations.append("Use high-touch channels only (phone, meetings)")
            recommendations.append("Daily budget reallocation based on results")
            recommendations.append("Skip cultivation — move directly to asks")
            recommendations.append("Compress contact test to 2 touches before decisions")
        
        elif mode == CampaignMode.URGENT:
            recommendations.append(f"URGENT MODE: {days} days remaining")
            recommendations.append("Prioritize A and B grade donors")
            recommendations.append("Accelerate through discovery phase")
            recommendations.append("Higher ask frequency than standard")
            recommendations.append("Reallocation every 3 days")
        
        elif mode == CampaignMode.AGGRESSIVE:
            recommendations.append(f"AGGRESSIVE MODE: {days} days remaining")
            recommendations.append("Target A through C+ grades")
            recommendations.append("Shortened cultivation period")
            recommendations.append("Weekly budget reallocation")
            recommendations.append("4-contact test before grade changes")
        
        elif mode == CampaignMode.BALANCED:
            recommendations.append(f"BALANCED MODE: {days} days remaining")
            recommendations.append("Standard phase allocation")
            recommendations.append("Full 5-contact testing")
            recommendations.append("Bi-weekly reallocation")
            recommendations.append("Time to develop donor relationships")
        
        else:  # CONSERVATIVE
            recommendations.append(f"CONSERVATIVE MODE: {days} days remaining")
            recommendations.append("Extended discovery and cultivation")
            recommendations.append("Target all grade levels including U")
            recommendations.append("Monthly reallocation")
            recommendations.append("Focus on relationship building")
            recommendations.append("Opportunity to upgrade donors over time")
        
        return recommendations
    
    def run_contact_test(self, donor: DonorProfile) -> Dict:
        """
        Run the minimum contact test before upgrading/downgrading.
        
        Contact count is determined by timeline mode:
        - Emergency: 2 contacts
        - Urgent: 3 contacts
        - Aggressive: 4 contacts
        - Balanced/Conservative: 5 contacts
        
        Returns: Test results and recommendation
        """
        contact_count = self.timeline.get_contact_test_count()
        
        # Define test plan based on contact count
        full_test_plan = [
            (Channel.EMAIL, MessageType.ISSUE_UPDATE),
            (Channel.TEXT, MessageType.PERSONAL_STORY),
            (Channel.EMAIL, MessageType.SOFT_ASK),
            (Channel.TEXT, MessageType.EVENT_INVITE),
            (Channel.EMAIL, MessageType.DIRECT_ASK)
        ]
        
        # Truncate based on timeline mode
        test_plan = full_test_plan[:contact_count]
        
        results = {
            "donor_id": donor.donor_id,
            "donor_name": donor.name,
            "current_grade": donor.amount_grade.label,
            "timeline_mode": self.timeline.mode.code,
            "contact_count": contact_count,
            "test_plan": [],
            "responses": 0,
            "variance": 0.0,
            "recommendation": ""
        }
        
        baseline = self.baseline_response_rates[donor.amount_grade]
        
        for i, (channel, message) in enumerate(test_plan):
            pred_response, pred_gift = self.calculate_predicted_response(donor, channel, message)
            results["test_plan"].append({
                "contact": i + 1,
                "channel": channel.code,
                "message": message.value,
                "predicted_response_rate": pred_response,
                "predicted_gift": pred_gift
            })
        
        # Calculate expected responses based on predictions
        expected_responses = sum(t["predicted_response_rate"] for t in results["test_plan"])
        
        # Decision matrix adjusted for contact count
        results["expected_responses"] = expected_responses
        
        if contact_count == 5:
            results["decision_matrix"] = {
                "4-5 responses": "UPGRADE grade + budget",
                "3 responses": "UPGRADE budget slightly",
                "2 responses": "HOLD current strategy",
                "1 response": "DOWNGRADE budget",
                "0 responses": "DOWNGRADE grade + pause"
            }
        elif contact_count == 4:
            results["decision_matrix"] = {
                "3-4 responses": "UPGRADE grade + budget",
                "2 responses": "HOLD current strategy",
                "1 response": "DOWNGRADE budget",
                "0 responses": "DOWNGRADE grade + pause"
            }
        elif contact_count == 3:
            results["decision_matrix"] = {
                "2-3 responses": "UPGRADE grade + budget",
                "1 response": "HOLD current strategy",
                "0 responses": "DOWNGRADE budget"
            }
        else:  # 2 contacts
            results["decision_matrix"] = {
                "2 responses": "UPGRADE",
                "1 response": "HOLD",
                "0 responses": "DOWNGRADE"
            }
        
        return results
    
    # =========================================================================
    # ECOSYSTEM TRIGGER INTEGRATION
    # =========================================================================
    # These methods integrate with the existing trigger engine ecosystem.
    # The LP model RECEIVES trigger events and OPTIMIZES budget allocation.
    # =========================================================================
    
    def receive_trigger_event(self, trigger: TriggerEvent):
        """
        Receive a trigger event from council_of_state_trigger_engine.py
        
        Called when a heat threshold is exceeded in the existing monitoring system.
        """
        self.active_triggers.append(trigger)
        self.ecosystem.receive_trigger(trigger)
    
    def optimize_trigger_budget(self, 
                                available_budget: float,
                                triggers: List[TriggerEvent] = None) -> Dict:
        """
        LP optimization for triggered campaigns.
        
        Allocates budget across active triggers based on:
        - Expected ROI (heat × county weight × time decay)
        - Urgency (immediate > same_day > next_day)
        - Budget constraints
        
        Returns: Optimal allocation by trigger
        """
        triggers = triggers or self.active_triggers
        
        if not triggers:
            return {}
        
        allocation = {}
        remaining_budget = available_budget
        
        # Score each trigger
        scored_triggers = []
        for trigger in triggers:
            # Get expected response for statewide or by county
            counties = trigger.counties_affected or [self.candidate.county]
            
            for county in counties:
                expected = self.ecosystem.calculate_expected_response(trigger, county)
                
                # Cost estimate
                cost_per_touch = Channel.EMAIL.cost_per_touch
                donor_count = trigger.estimated_donor_count // len(counties)  # Split across counties
                total_cost = donor_count * cost_per_touch
                
                # Expected revenue
                avg_gift = 150  # Triggered campaigns get higher gifts
                expected_revenue = donor_count * expected["expected_response_rate"] * 0.5 * avg_gift
                
                # ROI
                expected_roi = expected_revenue / total_cost if total_cost > 0 else 0
                
                scored_triggers.append({
                    "trigger": trigger,
                    "county": county,
                    "expected": expected,
                    "cost": total_cost,
                    "donor_count": donor_count,
                    "expected_revenue": expected_revenue,
                    "roi": expected_roi
                })
        
        # Sort by ROI descending, then by urgency
        urgency_order = {"immediate": 0, "same_day": 1, "next_day": 2}
        scored_triggers.sort(key=lambda x: (-x["roi"], urgency_order.get(x["trigger"].urgency, 2)))
        
        # Allocate budget by ROI
        for item in scored_triggers:
            trigger = item["trigger"]
            cost = item["cost"]
            
            if cost <= remaining_budget:
                key = f"{trigger.trigger_id}_{item['county']}"
                allocation[key] = {
                    "trigger_id": trigger.trigger_id,
                    "issue_slug": trigger.issue_slug,
                    "issue_name": trigger.issue_name,
                    "county": item["county"],
                    "heat_score": trigger.heat_score,
                    "urgency": trigger.urgency,
                    "news_headline": trigger.news_headline,
                    "hours_since_news": trigger.hours_since_published,
                    "donor_count": item["donor_count"],
                    "allocated_budget": cost,
                    "expected_response_rate": item["expected"]["expected_response_rate"],
                    "expected_revenue": item["expected_revenue"],
                    "expected_roi": item["roi"],
                    "multipliers": item["expected"]["multipliers"],
                    "channels": [c.code for c in self.ecosystem.get_channel_recommendation(
                        trigger.urgency, "B"  # Default grade
                    )],
                    "recommendation": "LAUNCH" if item["roi"] > 2.0 else "REVIEW"
                }
                remaining_budget -= cost
        
        return allocation
    
    def get_office_issue_profile(self) -> Dict:
        """Get the issue profile for this candidate's office from ecosystem"""
        return self.ecosystem.get_office_profile()
    
    def get_county_issue_weight(self, county: str, issue_slug: str) -> float:
        """Get response weight for an issue in a specific county"""
        return self.ecosystem.get_county_issue_weight(county, issue_slug)
    
    def record_trigger_result(self, trigger_id: str, county: str,
                              touches: int, responses: int, 
                              donations: int, raised: float):
        """
        Record results from a triggered campaign.
        
        Updates county+issue performance tracking for learning.
        """
        key = f"{county}_{trigger_id}"
        if key not in self.trigger_campaign_results:
            self.trigger_campaign_results[key] = {
                "campaigns": 0, "touches": 0, "responses": 0, "donations": 0, "raised": 0.0
            }
        
        perf = self.trigger_campaign_results[key]
        perf["campaigns"] += 1
        perf["touches"] += touches
        perf["responses"] += responses
        perf["donations"] += donations
        perf["raised"] += raised


# =============================================================================
# SECTION 5: STRATEGY GENERATOR
# =============================================================================

def generate_baseline_strategy(candidate: CandidateProfile, 
                               donors: List[DonorProfile]) -> Dict:
    """
    Main entry point: Generate baseline LP strategy for any candidate
    
    Args:
        candidate: CandidateProfile with 500+ fields
        donors: List of DonorProfile with 860 fields each
        
    Returns:
        Complete 12-month optimized campaign strategy
    """
    optimizer = CampaignOptimizer(candidate)
    optimizer.build_segments(donors)
    return optimizer.generate_strategy()


# =============================================================================
# SECTION 6: EXAMPLE USAGE
# =============================================================================

if __name__ == "__main__":
    # Example 1: Standard 12-month campaign
    print("=" * 80)
    print("EXAMPLE 1: STANDARD 12-MONTH CAMPAIGN")
    print("=" * 80)
    
    candidate_standard = CandidateProfile(
        candidate_id="NC-SEN-31-2024",
        name="John Smith",
        office_type="State Senate",
        district="NC Senate District 31",
        county="Wake County",
        registration_date=datetime.now(),
        election_date=datetime.now() + timedelta(days=365),
        military_veteran=True,
        military_branch="Army",
        military_unit="Green Beret",
        combat_veteran=True,
        religion="Christian",
        denomination="Baptist",
        church_name="First Baptist Raleigh",
        education_university="NC State",
        education_fraternity="Sigma Chi",
        profession="Attorney",
        industry="Legal",
        business_owner=True,
        issue_priorities={
            "second_amendment": 90,
            "abortion": 85,
            "border_security": 80,
            "tax_reform": 75,
            "election_integrity": 85
        },
        budget_total=150000,
        fundraising_goal=500000
    )
    
    # Example: Create sample donors (in reality, loaded from database)
    sample_donors = []
    for i in range(100):
        donor = DonorProfile(
            donor_id=f"donor_{i}",
            name=f"Donor {i}",
            county="Wake County" if i % 3 == 0 else "Mecklenburg County",
            amount_grade=list(Grade)[i % 13],
            amount_score=float(i * 1000),
            history_score=50 + (i % 50),
            intensity_score=40 + (i % 60),
            recency_score=30 + (i % 70),
            attributes={
                "military": {"veteran_status": i % 5 == 0, "branch": "Army" if i % 10 == 0 else None},
                "religious": {"denomination": "Baptist" if i % 4 == 0 else "Methodist"},
                "education": {"university": "NC State" if i % 6 == 0 else "UNC"},
                "professional": {"industry": "Legal" if i % 8 == 0 else "Finance"},
                "issues": {
                    "second_amendment_priority": 50 + (i % 50),
                    "abortion_priority": 40 + (i % 60)
                }
            }
        )
        sample_donors.append(donor)
    
    # Generate strategy
    strategy = generate_baseline_strategy(candidate_standard, sample_donors)
    
    # Output summary
    print(f"\nCandidate: {strategy['candidate']['name']}")
    print(f"Office: {strategy['candidate']['office']}")
    print(f"Budget: ${strategy['candidate']['budget_total']:,.2f}")
    print(f"Goal: ${strategy['candidate']['fundraising_goal']:,.2f}")
    print(f"\n--- TIMELINE ---")
    print(f"Days Remaining: {strategy['timeline']['days_remaining']}")
    print(f"Mode: {strategy['timeline']['mode'].upper()}")
    print(f"Intensity Multiplier: {strategy['timeline']['intensity_multiplier']:.2f}x")
    print(f"Current Phase: {strategy['timeline']['current_phase']}")
    print(f"Grades Targeted: {', '.join(strategy['timeline']['grades_targeted'])}")
    print(f"Contact Test Count: {strategy['timeline']['contact_test_count']}")
    print(f"Reallocation Frequency: Every {strategy['timeline']['reallocation_frequency_days']} days")
    
    print(f"\n--- PHASES ---")
    for phase, config in strategy['timeline']['phases'].items():
        print(f"  {phase.upper()}: {config['days']} days ({config['percentage']}) — {config['start_date']} to {config['end_date']}")
    
    print(f"\n--- DONOR UNIVERSE ---")
    print(f"Total Donors: {strategy['donor_universe']['total_donors']:,}")
    print(f"Total Capacity: ${strategy['donor_universe']['total_capacity']:,.2f}")
    
    print(f"\n--- PROJECTIONS ---")
    print(f"Projected to Raise: ${strategy['projections']['total_expected_raised']:,.2f}")
    print(f"Projected ROI: {strategy['projections']['projected_roi']:.1%}")
    
    print(f"\n--- RECOMMENDATIONS ---")
    for rec in strategy['recommendations']:
        print(f"  • {rec}")
    
    # Example 2: Late entry (90 days)
    print("\n" + "=" * 80)
    print("EXAMPLE 2: LATE ENTRY (90 DAYS)")
    print("=" * 80)
    
    candidate_late = CandidateProfile(
        candidate_id="NC-SEN-31-2024-LATE",
        name="Jane Doe",
        office_type="State Senate",
        district="NC Senate District 31",
        county="Wake County",
        registration_date=datetime.now(),
        election_date=datetime.now() + timedelta(days=90),
        military_veteran=False,
        religion="Christian",
        denomination="Methodist",
        profession="Business Owner",
        industry="Retail",
        business_owner=True,
        budget_total=75000,
        fundraising_goal=200000
    )
    
    strategy_late = generate_baseline_strategy(candidate_late, sample_donors)
    
    print(f"\nCandidate: {strategy_late['candidate']['name']}")
    print(f"Days Remaining: {strategy_late['timeline']['days_remaining']}")
    print(f"Mode: {strategy_late['timeline']['mode'].upper()}")
    print(f"Intensity Multiplier: {strategy_late['timeline']['intensity_multiplier']:.2f}x")
    print(f"Grades Targeted: {', '.join(strategy_late['timeline']['grades_targeted'])}")
    print(f"Contact Test Count: {strategy_late['timeline']['contact_test_count']}")
    print(f"\n--- RECOMMENDATIONS ---")
    for rec in strategy_late['recommendations']:
        print(f"  • {rec}")
    
    # Example 3: Emergency (30 days)
    print("\n" + "=" * 80)
    print("EXAMPLE 3: EMERGENCY MODE (30 DAYS)")
    print("=" * 80)
    
    candidate_emergency = CandidateProfile(
        candidate_id="NC-SEN-31-2024-EMERGENCY",
        name="Bob Wilson",
        office_type="State House",
        district="NC House District 42",
        county="Forsyth County",
        registration_date=datetime.now(),
        election_date=datetime.now() + timedelta(days=30),
        budget_total=25000,
        fundraising_goal=75000
    )
    
    strategy_emergency = generate_baseline_strategy(candidate_emergency, sample_donors)
    
    print(f"\nCandidate: {strategy_emergency['candidate']['name']}")
    print(f"Days Remaining: {strategy_emergency['timeline']['days_remaining']}")
    print(f"Mode: {strategy_emergency['timeline']['mode'].upper()}")
    print(f"Intensity Multiplier: {strategy_emergency['timeline']['intensity_multiplier']:.2f}x")
    print(f"Grades Targeted: {', '.join(strategy_emergency['timeline']['grades_targeted'])}")
    print(f"Contact Test Count: {strategy_emergency['timeline']['contact_test_count']}")
    print(f"Reallocation Frequency: Every {strategy_emergency['timeline']['reallocation_frequency_days']} day(s)")
    print(f"\n--- RECOMMENDATIONS ---")
    for rec in strategy_emergency['recommendations']:
        print(f"  • {rec}")
