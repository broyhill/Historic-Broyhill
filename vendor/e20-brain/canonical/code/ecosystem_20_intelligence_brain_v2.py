#!/usr/bin/env python3
"""
============================================================================
ECOSYSTEM 20: INTELLIGENCE BRAIN - COMPLETE INTEGRATION v2.0
============================================================================

Central Decision Engine for ALL BroyhillGOP Platform Operations

UPDATED: January 4, 2026
- Added E5.1 Volunteer Intelligence Integration
- Added Star Rating Processing
- Added Lead Source Workflows
- Added Burnout Prevention
- Added Donor-Volunteer Coordination
- Added Candidate History Analysis

INTEGRATIONS:
├── E1:  Donor Intelligence (donor scores, grades, predictions)
├── E3:  Candidate Intelligence (committees, matching)
├── E4:  Activist Network (organization memberships)
├── E5:  Volunteer Management (shifts, scheduling)
├── E5.1: Volunteer Intelligence (stars, sources, history) ⭐ NEW
├── E7:  Issue Tracking (constituent matching)
├── E8:  Communications Library (content selection)
├── E15: Contact Directory (target selection)
├── E30: Email System (campaign execution)
├── E31: SMS System (alerts, P2P)
├── E32: Phone Banking (call campaigns)
├── E42: News Intelligence (crisis detection)
└── All other ecosystems via Event Bus

CORE PRINCIPLE: Every touchpoint → DONATE or VOLUNTEER

============================================================================
"""

import redis
import json
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Set
from dataclasses import dataclass, field
from enum import Enum
import requests
import psycopg2
from psycopg2.extras import RealDictCursor
import os

# ============================================================================
# LOGGING SETUP
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('ecosystem20.intelligence_brain')


# ============================================================================
# CONFIGURATION
# ============================================================================

class BrainConfig:
    """Intelligence Brain configuration"""
    
    # Database
    DATABASE_URL = os.getenv("DATABASE_URL", 
        "postgresql://postgres.isbgjpnbocdkeslofofa:BroyhillGOP2024!@aws-0-us-east-1.pooler.supabase.com:6543/postgres")
    
    # Redis Event Bus
    REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_DB = int(os.getenv("REDIS_DB", "0"))
    
    # API Endpoints
    LIBRARY_API = os.getenv("LIBRARY_API", "http://localhost:8008")
    EMAIL_API = os.getenv("EMAIL_API", "http://localhost:8030")
    SMS_API = os.getenv("SMS_API", "http://localhost:8031")
    PHONE_API = os.getenv("PHONE_API", "http://localhost:8032")
    
    # =========================================
    # DECISION THRESHOLDS
    # =========================================
    
    # Crisis Response
    CRISIS_URGENCY_THRESHOLD = 8          # 0-10 scale
    CRISIS_RESPONSE_TIME_SEC = 180        # 3 minutes
    
    # Donor Thresholds
    VIP_DONATION_THRESHOLD = 3500         # Federal max-out
    MAJOR_DONOR_THRESHOLD = 1000
    
    # Volunteer Thresholds
    BURNOUT_RISK_THRESHOLD = 0.70         # 70% risk triggers intervention
    DROPOUT_RISK_THRESHOLD = 0.60         # 60% risk triggers retention
    VOLUNTEER_GRADE_BLOCK = ['V-D', 'V-D-', 'V-F']  # Block from critical tasks
    ELITE_VOLUNTEER_GRADES = ['V-A++', 'V-A+', 'V-A']
    
    # Lead Response
    PRIORITY_1_RESPONSE_HOURS = 24        # RNC/NCGOP weekly files
    PRIORITY_2_RESPONSE_HOURS = 48        # Campaign signups
    NEW_LEAD_FOLLOWUP_DAYS = 7            # Days to complete follow-up sequence


# ============================================================================
# EVENT TYPES - ALL ECOSYSTEMS
# ============================================================================

class EventType(Enum):
    """All event types the Brain listens for and emits"""
    
    # DONOR EVENTS (E1)
    DONOR_CREATED = 'donor.created'
    DONOR_GRADE_CHANGED = 'donor.grade_changed'
    DONOR_MAXOUT = 'donor.maxout_detected'
    DONOR_CHURN_RISK = 'donor.churn_risk_high'
    DONOR_UPGRADED = 'donor.upgraded'
    DONOR_LAPSED = 'donor.lapsed'
    
    # DONATION EVENTS (E2)
    DONATION_RECEIVED = 'donation.received'
    DONATION_RECURRING_STARTED = 'donation.recurring_started'
    DONATION_RECURRING_FAILED = 'donation.recurring_failed'
    
    # VOLUNTEER EVENTS (E5 + E5.1) ⭐ NEW
    VOLUNTEER_CREATED = 'volunteer.created'
    VOLUNTEER_GRADE_CHANGED = 'volunteer.grade_changed'
    VOLUNTEER_STAR_UPGRADED = 'volunteer.star_upgraded'
    VOLUNTEER_BURNOUT_RISK = 'volunteer.burnout_risk_high'
    VOLUNTEER_DROPOUT_RISK = 'volunteer.dropout_risk_high'
    VOLUNTEER_SHIFT_COMPLETED = 'volunteer.shift_completed'
    VOLUNTEER_SHIFT_NOSHOW = 'volunteer.shift_noshow'
    VOLUNTEER_BECAME_DONOR = 'volunteer.became_donor'
    VOLUNTEER_FUTURE_LEADER = 'volunteer.future_leader_identified'
    VOLUNTEER_SUPER_STATUS = 'volunteer.super_volunteer_achieved'
    
    # LEAD SOURCE EVENTS (E5.1) ⭐ NEW
    LEAD_BATCH_IMPORTED = 'lead.batch_imported'
    LEAD_NEW_PRIORITY1 = 'lead.new_priority1'
    LEAD_VERIFIED = 'lead.verified'
    LEAD_CONVERTED = 'lead.converted_to_active'
    
    # AI SCOUT EVENTS (E5.1) ⭐ NEW
    SCOUT_DISCOVERY = 'scout.activist_discovered'
    SCOUT_OFFICER_FOUND = 'scout.officer_found'
    SCOUT_BATCH_COMPLETE = 'scout.batch_complete'
    
    # NEWS EVENTS (E42)
    NEWS_ARTICLE_FOUND = 'news.article_found'
    NEWS_CRISIS_DETECTED = 'news.crisis_detected'
    NEWS_POSITIVE_COVERAGE = 'news.positive_coverage'
    NEWS_CANDIDATE_MENTION = 'news.candidate_mentioned'
    
    # CAMPAIGN EVENTS (E30-32)
    EMAIL_SENT = 'email.sent'
    EMAIL_OPENED = 'email.opened'
    EMAIL_CLICKED = 'email.clicked'
    SMS_SENT = 'sms.sent'
    SMS_REPLIED = 'sms.replied'
    CALL_COMPLETED = 'call.completed'
    
    # CONTENT EVENTS (E8)
    CONTENT_UPLOADED = 'library.content_uploaded'
    CONTENT_PERFORMANCE = 'library.performance_update'
    
    # BRAIN DECISIONS
    DECISION_MADE = 'brain.decision_made'
    CAMPAIGN_TRIGGERED = 'brain.campaign_triggered'
    WORKFLOW_STARTED = 'brain.workflow_started'
    ENFORCEMENT_BLOCKED = 'brain.enforcement_blocked'


# ============================================================================
# GRADE ENFORCEMENT RULES
# ============================================================================

DONOR_GRADE_RULES = {
    'A++': {
        'max_emails_per_week': 999,
        'max_sms_per_week': 999,
        'can_receive_calls': True,
        'vip_treatment': True,
        'candidate_alert': True,
    },
    'A+': {
        'max_emails_per_week': 5,
        'max_sms_per_week': 3,
        'can_receive_calls': True,
        'vip_treatment': True,
        'candidate_alert': True,
    },
    'A': {
        'max_emails_per_week': 4,
        'max_sms_per_week': 2,
        'can_receive_calls': True,
        'vip_treatment': False,
        'candidate_alert': False,
    },
    'B+': {'max_emails_per_week': 3, 'max_sms_per_week': 2, 'can_receive_calls': True},
    'B': {'max_emails_per_week': 3, 'max_sms_per_week': 1, 'can_receive_calls': True},
    'B-': {'max_emails_per_week': 2, 'max_sms_per_week': 1, 'can_receive_calls': True},
    'C+': {'max_emails_per_week': 2, 'max_sms_per_week': 1, 'can_receive_calls': False},
    'C': {'max_emails_per_week': 2, 'max_sms_per_week': 0, 'can_receive_calls': False},
    'C-': {'max_emails_per_week': 1, 'max_sms_per_week': 0, 'can_receive_calls': False},
    'D+': {'max_emails_per_week': 1, 'max_sms_per_week': 0, 'can_receive_calls': False},
    'D': {'max_emails_per_week': 0, 'max_sms_per_week': 0, 'can_receive_calls': False},
    'D-': {'max_emails_per_week': 0, 'max_sms_per_week': 0, 'can_receive_calls': False},
    'F': {'max_emails_per_week': 0, 'max_sms_per_week': 0, 'can_receive_calls': False, 'blocked': True},
}

VOLUNTEER_GRADE_RULES = {
    'V-A++': {
        'can_lead_teams': True,
        'critical_tasks': True,
        'vip_events': True,
        'candidate_introduction': True,
        'max_hours_per_week': 40,
    },
    'V-A+': {
        'can_lead_teams': True,
        'critical_tasks': True,
        'vip_events': True,
        'candidate_introduction': True,
        'max_hours_per_week': 30,
    },
    'V-A': {
        'can_lead_teams': True,
        'critical_tasks': True,
        'vip_events': False,
        'candidate_introduction': False,
        'max_hours_per_week': 25,
    },
    'V-B+': {'can_lead_teams': False, 'critical_tasks': True, 'max_hours_per_week': 20},
    'V-B': {'can_lead_teams': False, 'critical_tasks': True, 'max_hours_per_week': 20},
    'V-B-': {'can_lead_teams': False, 'critical_tasks': False, 'max_hours_per_week': 15},
    'V-C+': {'can_lead_teams': False, 'critical_tasks': False, 'max_hours_per_week': 12},
    'V-C': {'can_lead_teams': False, 'critical_tasks': False, 'max_hours_per_week': 10},
    'V-C-': {'can_lead_teams': False, 'critical_tasks': False, 'max_hours_per_week': 8, 'supervised_only': True},
    'V-D+': {'can_lead_teams': False, 'critical_tasks': False, 'max_hours_per_week': 5, 'supervised_only': True},
    'V-D': {'can_lead_teams': False, 'critical_tasks': False, 'max_hours_per_week': 0, 'blocked': True},
    'V-D-': {'can_lead_teams': False, 'critical_tasks': False, 'max_hours_per_week': 0, 'blocked': True},
    'V-F': {'blocked': True, 'reason': 'Do not assign'},
}

STAR_RATING_RULES = {
    0: {'multiplier': 1.0, 'priority': 'standard'},
    1: {'multiplier': 1.5, 'priority': 'high', 'vip_list': True},
    2: {'multiplier': 2.5, 'priority': 'critical', 'vip_list': True, 'leadership_track': True},
}


# ============================================================================
# INTELLIGENCE BRAIN CLASS
# ============================================================================

class IntelligenceBrain:
    """
    Central Decision Engine - The "Brain" of BroyhillGOP Platform
    
    RESPONSIBILITIES:
    1. Monitor ALL events from ALL ecosystems
    2. Enforce grade rules (donor AND volunteer)
    3. Coordinate donor-volunteer relationships
    4. Trigger automated workflows
    5. Process lead sources
    6. Detect and prevent burnout
    7. Track performance and learn
    
    CORE PRINCIPLE:
    Every decision must lead toward DONATE or VOLUNTEER
    """
    
    def __init__(self):
        """Initialize Intelligence Brain"""
        self.redis = redis.Redis(
            host=BrainConfig.REDIS_HOST,
            port=BrainConfig.REDIS_PORT,
            db=BrainConfig.REDIS_DB,
            decode_responses=True
        )
        self.pubsub = self.redis.pubsub()
        self.running = False
        self.active_workflows = {}
        
        logger.info("🧠 Intelligence Brain v2.0 initialized")
        logger.info("   • E5.1 Volunteer Intelligence: INTEGRATED")
        logger.info("   • Star Rating System: ACTIVE")
        logger.info("   • Lead Source Tracking: ACTIVE")
        logger.info("   • Burnout Prevention: ACTIVE")
    
    def connect_database(self):
        """Connect to Supabase DataHub"""
        return psycopg2.connect(BrainConfig.DATABASE_URL)
    
    # ========================================================================
    # EVENT SUBSCRIPTION - ALL ECOSYSTEMS
    # ========================================================================
    
    def subscribe_to_events(self):
        """Subscribe to ALL relevant event channels"""
        channels = [
            # Main event bus
            'broyhillgop.events',
            
            # Donor events (E1, E2)
            'donor.created',
            'donor.grade_changed',
            'donor.maxout_detected',
            'donor.churn_risk_high',
            'donation.received',
            
            # Volunteer events (E5, E5.1) ⭐ NEW
            'volunteer.created',
            'volunteer.grade_changed',
            'volunteer.star_upgraded',
            'volunteer.burnout_risk_high',
            'volunteer.dropout_risk_high',
            'volunteer.shift_completed',
            'volunteer.shift_noshow',
            'volunteer.future_leader_identified',
            'volunteer.super_volunteer_achieved',
            
            # Lead source events (E5.1) ⭐ NEW
            'lead.batch_imported',
            'lead.new_priority1',
            
            # AI Scout events (E5.1) ⭐ NEW
            'scout.activist_discovered',
            'scout.officer_found',
            
            # News events (E42)
            'news.crisis_detected',
            'news.positive_coverage',
            'news.candidate_mentioned',
            
            # Campaign events (E30-32)
            'email.sent',
            'email.opened',
            'email.clicked',
            'sms.replied',
            'call.completed',
            
            # Library events (E8)
            'library.content_uploaded',
            'library.performance_update',
        ]
        
        self.pubsub.subscribe(*channels)
        logger.info(f"📡 Subscribed to {len(channels)} event channels")
        logger.info("   Including: volunteer.*, lead.*, scout.* (E5.1)")
    
    # ========================================================================
    # MAIN EVENT ROUTER
    # ========================================================================
    
    def handle_event(self, message):
        """Route events to appropriate handlers"""
        try:
            event = json.loads(message['data'])
            event_type = event.get('event_type', message.get('channel'))
            
            logger.info(f"📥 Event: {event_type}")
            
            # =====================================
            # DONOR EVENTS (E1, E2)
            # =====================================
            if event_type in ['donor.grade_changed', 'donor.upgraded']:
                self.handle_donor_grade_change(event)
            
            elif event_type == 'donor.maxout_detected':
                self.handle_vip_maxout(event)
            
            elif event_type == 'donor.churn_risk_high':
                self.handle_donor_churn_risk(event)
            
            elif event_type == 'donation.received':
                self.handle_donation(event)
            
            # =====================================
            # VOLUNTEER EVENTS (E5, E5.1) ⭐ NEW
            # =====================================
            elif event_type == 'volunteer.created':
                self.handle_volunteer_created(event)
            
            elif event_type == 'volunteer.grade_changed':
                self.handle_volunteer_grade_change(event)
            
            elif event_type == 'volunteer.star_upgraded':
                self.handle_star_upgrade(event)
            
            elif event_type == 'volunteer.burnout_risk_high':
                self.handle_burnout_risk(event)
            
            elif event_type == 'volunteer.dropout_risk_high':
                self.handle_dropout_risk(event)
            
            elif event_type == 'volunteer.shift_noshow':
                self.handle_volunteer_noshow(event)
            
            elif event_type == 'volunteer.future_leader_identified':
                self.handle_future_leader(event)
            
            elif event_type == 'volunteer.super_volunteer_achieved':
                self.handle_super_volunteer(event)
            
            # =====================================
            # LEAD SOURCE EVENTS (E5.1) ⭐ NEW
            # =====================================
            elif event_type == 'lead.batch_imported':
                self.handle_lead_batch_imported(event)
            
            elif event_type == 'lead.new_priority1':
                self.handle_priority1_lead(event)
            
            # =====================================
            # AI SCOUT EVENTS (E5.1) ⭐ NEW
            # =====================================
            elif event_type == 'scout.activist_discovered':
                self.handle_scout_discovery(event)
            
            elif event_type == 'scout.officer_found':
                self.handle_officer_discovered(event)
            
            # =====================================
            # NEWS EVENTS (E42)
            # =====================================
            elif event_type == 'news.crisis_detected':
                self.handle_crisis(event)
            
            elif event_type == 'news.positive_coverage':
                self.handle_positive_news(event)
            
            # =====================================
            # CAMPAIGN EVENTS (E30-32)
            # =====================================
            elif event_type == 'email.opened':
                self.track_engagement(event)
            
            else:
                logger.debug(f"Unhandled event type: {event_type}")
        
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON in event")
        except Exception as e:
            logger.error(f"Event handling error: {e}")
    
    # ========================================================================
    # VOLUNTEER INTELLIGENCE HANDLERS (E5.1) ⭐ NEW
    # ========================================================================
    
    def handle_volunteer_created(self, event):
        """Process new volunteer creation"""
        volunteer_id = event.get('volunteer_id')
        source_code = event.get('source_code')
        
        logger.info(f"👤 NEW VOLUNTEER: {event.get('name')}")
        logger.info(f"   Source: {source_code}")
        
        # Check if they're also a donor
        donor_id = self.check_donor_match(event.get('email'), event.get('phone'))
        
        if donor_id:
            # DONOR-VOLUNTEER detected!
            logger.info(f"   💎 DONOR-VOLUNTEER MATCH FOUND!")
            self.create_donor_volunteer_link(volunteer_id, donor_id)
            
            # Publish special event
            self.publish_event(
                'volunteer.became_donor_volunteer',
                volunteer_id=volunteer_id,
                donor_id=donor_id,
                source=source_code
            )
        
        # Start welcome sequence based on source priority
        priority = self.get_source_priority(source_code)
        if priority == 1:
            self.trigger_workflow('volunteer_welcome_p1', volunteer_id=volunteer_id)
        else:
            self.trigger_workflow('volunteer_welcome_standard', volunteer_id=volunteer_id)
    
    def handle_volunteer_grade_change(self, event):
        """Handle volunteer grade changes - enforce rules"""
        volunteer_id = event.get('volunteer_id')
        old_grade = event.get('old_grade')
        new_grade = event.get('new_grade')
        
        logger.info(f"📊 VOLUNTEER GRADE CHANGE: {old_grade} → {new_grade}")
        
        # Check if downgraded to blocked grade
        if new_grade in BrainConfig.VOLUNTEER_GRADE_BLOCK:
            logger.warning(f"   ⛔ Volunteer {volunteer_id} now BLOCKED from critical tasks")
            self.enforce_volunteer_block(volunteer_id, new_grade)
        
        # Check if upgraded to elite
        if new_grade in BrainConfig.ELITE_VOLUNTEER_GRADES and old_grade not in BrainConfig.ELITE_VOLUNTEER_GRADES:
            logger.info(f"   🌟 Volunteer promoted to ELITE status!")
            self.trigger_workflow('volunteer_elite_welcome', volunteer_id=volunteer_id)
    
    def handle_star_upgrade(self, event):
        """Handle star rating upgrade - major event!"""
        volunteer_id = event.get('volunteer_id')
        old_stars = event.get('old_star_level', 0)
        new_stars = event.get('new_star_level')
        categories = event.get('star_categories', [])
        
        star_display = '⭐' * new_stars
        logger.info(f"🌟 STAR UPGRADE: {star_display}")
        logger.info(f"   Volunteer: {event.get('name')}")
        logger.info(f"   Categories: {', '.join(categories)}")
        
        # Double star is VIP
        if new_stars >= 2:
            logger.info(f"   🎖️ DOUBLE STAR - Adding to VIP list")
            self.add_to_vip_volunteer_list(volunteer_id)
            
            # Check if future leader
            future_leader_cats = ['NCYR_STATE_OFFICER', 'NCYR_COUNTY_OFFICER', 
                                  'COLLEGE_REPUBLICAN_OFFICER', 'TEENAGE_REPUBLICAN_OFFICER']
            if any(cat in categories for cat in future_leader_cats):
                self.publish_event(
                    'volunteer.future_leader_identified',
                    volunteer_id=volunteer_id,
                    categories=categories
                )
        
        # Alert relevant staff
        self.send_staff_alert(
            f"⭐ Star Upgrade: {event.get('name')} is now {star_display}",
            priority='high' if new_stars >= 2 else 'normal'
        )
    
    def handle_burnout_risk(self, event):
        """Handle high burnout risk - PROTECT THE VOLUNTEER"""
        volunteer_id = event.get('volunteer_id')
        risk_score = event.get('burnout_risk')
        
        logger.warning(f"🔥 BURNOUT RISK DETECTED!")
        logger.warning(f"   Volunteer: {event.get('name')}")
        logger.warning(f"   Risk Score: {risk_score:.1%}")
        
        # Immediate actions
        actions = []
        
        if risk_score >= 0.85:
            # Critical - force rest
            actions.append('MANDATORY_REST_WEEK')
            self.enforce_volunteer_rest(volunteer_id, days=7)
        elif risk_score >= 0.70:
            # High - reduce hours
            actions.append('REDUCE_HOURS_50PCT')
            self.reduce_volunteer_hours(volunteer_id, reduction=0.5)
        
        # Always send appreciation
        actions.append('SEND_APPRECIATION')
        self.trigger_workflow('volunteer_appreciation', volunteer_id=volunteer_id)
        
        logger.info(f"   Actions: {', '.join(actions)}")
        
        # Publish decision
        self.publish_event(
            'brain.burnout_intervention',
            volunteer_id=volunteer_id,
            risk_score=risk_score,
            actions=actions
        )
    
    def handle_dropout_risk(self, event):
        """Handle high dropout risk - RETENTION WORKFLOW"""
        volunteer_id = event.get('volunteer_id')
        risk_score = event.get('dropout_risk')
        
        logger.warning(f"📉 DROPOUT RISK DETECTED!")
        logger.warning(f"   Volunteer: {event.get('name')}")
        logger.warning(f"   Risk Score: {risk_score:.1%}")
        
        # Trigger retention workflow
        self.trigger_workflow('volunteer_retention', 
            volunteer_id=volunteer_id,
            risk_level='high' if risk_score >= 0.80 else 'medium'
        )
    
    def handle_volunteer_noshow(self, event):
        """Handle volunteer no-show - track and respond"""
        volunteer_id = event.get('volunteer_id')
        shift_id = event.get('shift_id')
        noshow_count = event.get('noshow_count', 1)
        
        logger.info(f"❌ VOLUNTEER NO-SHOW: {event.get('name')}")
        logger.info(f"   Total no-shows: {noshow_count}")
        
        if noshow_count >= 3:
            logger.warning(f"   ⚠️ 3+ no-shows - triggering re-engagement")
            self.trigger_workflow('volunteer_reengagement', volunteer_id=volunteer_id)
        elif noshow_count == 1:
            # First no-show - friendly check-in
            self.trigger_workflow('volunteer_checkin', volunteer_id=volunteer_id)
    
    def handle_future_leader(self, event):
        """Handle future leader identification - SPECIAL CULTIVATION"""
        volunteer_id = event.get('volunteer_id')
        categories = event.get('categories', [])
        
        logger.info(f"🌟 FUTURE LEADER IDENTIFIED!")
        logger.info(f"   Name: {event.get('name')}")
        logger.info(f"   Categories: {', '.join(categories)}")
        
        # Add to leadership pipeline
        self.add_to_leadership_pipeline(volunteer_id, categories)
        
        # Special cultivation track
        self.trigger_workflow('future_leader_cultivation', 
            volunteer_id=volunteer_id,
            categories=categories
        )
        
        # Alert party leadership
        self.send_staff_alert(
            f"🌟 Future Leader: {event.get('name')} ({', '.join(categories)})",
            priority='high',
            recipients=['state_chair', 'volunteer_director']
        )
    
    def handle_super_volunteer(self, event):
        """Handle super volunteer achievement - 5+ campaigns"""
        volunteer_id = event.get('volunteer_id')
        total_campaigns = event.get('total_campaigns')
        total_hours = event.get('total_lifetime_hours')
        
        logger.info(f"🦸 SUPER VOLUNTEER ACHIEVED!")
        logger.info(f"   Name: {event.get('name')}")
        logger.info(f"   Campaigns: {total_campaigns}")
        logger.info(f"   Lifetime Hours: {total_hours:,.0f}")
        
        # Add to elite team
        self.add_to_elite_team(volunteer_id)
        
        # Recognition workflow
        self.trigger_workflow('super_volunteer_recognition', 
            volunteer_id=volunteer_id,
            campaigns=total_campaigns,
            hours=total_hours
        )
    
    # ========================================================================
    # LEAD SOURCE HANDLERS (E5.1) ⭐ NEW
    # ========================================================================
    
    def handle_lead_batch_imported(self, event):
        """Handle new lead batch import - weekly files"""
        batch_id = event.get('batch_id')
        source_code = event.get('source_code')
        total_records = event.get('total_records')
        new_records = event.get('new_records')
        
        logger.info(f"📦 LEAD BATCH IMPORTED: {source_code}")
        logger.info(f"   Total: {total_records} | New: {new_records}")
        
        # Determine priority
        priority_1_sources = ['RNC_VOLUNTEER_WEEKLY', 'NCGOP_WEBSITE', 
                             'TRUMP_2024_VOLUNTEER', 'NRSC_VOLUNTEER', 'NRCC_VOLUNTEER']
        
        if source_code in priority_1_sources:
            logger.info(f"   🔴 PRIORITY 1 - Triggering immediate outreach")
            self.trigger_workflow('lead_priority1_outreach', 
                batch_id=batch_id,
                source=source_code,
                count=new_records
            )
        else:
            logger.info(f"   🟡 Standard priority - Queued for outreach")
            self.trigger_workflow('lead_standard_outreach',
                batch_id=batch_id,
                source=source_code,
                count=new_records
            )
        
        # Update source statistics
        self.update_source_stats(source_code, total_records, new_records)
    
    def handle_priority1_lead(self, event):
        """Handle individual Priority 1 lead - immediate action"""
        volunteer_id = event.get('volunteer_id')
        source_code = event.get('source_code')
        
        logger.info(f"🔴 PRIORITY 1 LEAD: {event.get('name')}")
        logger.info(f"   Source: {source_code}")
        logger.info(f"   Response deadline: {BrainConfig.PRIORITY_1_RESPONSE_HOURS}h")
        
        # Check for phone number - enables faster contact
        has_cell = event.get('cell_phone') is not None
        has_email = event.get('email') is not None
        
        # Determine best contact method
        if has_cell:
            # SMS welcome within 24 hours
            self.trigger_workflow('lead_sms_welcome', volunteer_id=volunteer_id)
        elif has_email:
            # Email welcome immediately
            self.trigger_workflow('lead_email_welcome', volunteer_id=volunteer_id)
        
        # Set follow-up reminder
        self.create_followup_task(
            volunteer_id=volunteer_id,
            due_hours=BrainConfig.PRIORITY_1_RESPONSE_HOURS,
            task_type='new_lead_followup'
        )
    
    # ========================================================================
    # AI SCOUT HANDLERS (E5.1) ⭐ NEW
    # ========================================================================
    
    def handle_scout_discovery(self, event):
        """Handle AI Scout activist discovery"""
        discovery_id = event.get('discovery_id')
        confidence = event.get('confidence_score', 0)
        
        logger.info(f"🤖 AI SCOUT DISCOVERY")
        logger.info(f"   Name: {event.get('first_name')} {event.get('last_name')}")
        logger.info(f"   Organization: {event.get('org_name')}")
        logger.info(f"   Confidence: {confidence:.0f}%")
        
        # High confidence - auto-create volunteer record
        if confidence >= 80:
            logger.info(f"   ✅ High confidence - Auto-creating record")
            self.create_volunteer_from_scout(discovery_id)
        # Medium confidence - queue for review
        elif confidence >= 60:
            logger.info(f"   📋 Medium confidence - Queued for review")
            self.queue_scout_for_review(discovery_id, priority='normal')
        # Low confidence - log only
        else:
            logger.info(f"   ⚠️ Low confidence - Logged for manual review")
            self.queue_scout_for_review(discovery_id, priority='low')
    
    def handle_officer_discovered(self, event):
        """Handle AI Scout officer/leader discovery - DOUBLE STAR CANDIDATE"""
        discovery_id = event.get('discovery_id')
        position = event.get('position_title')
        organization = event.get('org_name')
        
        logger.info(f"🎖️ OFFICER DISCOVERED!")
        logger.info(f"   Name: {event.get('first_name')} {event.get('last_name')}")
        logger.info(f"   Position: {position}")
        logger.info(f"   Organization: {organization}")
        
        # Officers get expedited processing
        self.queue_scout_for_review(discovery_id, priority='high')
        
        # Alert volunteer coordinator
        self.send_staff_alert(
            f"🎖️ Officer Found: {event.get('first_name')} {event.get('last_name')} - {position} at {organization}",
            priority='high',
            recipients=['volunteer_coordinator']
        )
    
    # ========================================================================
    # DONOR-VOLUNTEER COORDINATION ⭐ NEW
    # ========================================================================
    
    def check_donor_match(self, email: str, phone: str) -> Optional[str]:
        """Check if volunteer matches existing donor"""
        conn = self.connect_database()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT donor_id FROM donors
                    WHERE email = %s OR phone = %s
                    LIMIT 1
                """, (email, phone))
                result = cur.fetchone()
                return result['donor_id'] if result else None
        finally:
            conn.close()
    
    def create_donor_volunteer_link(self, volunteer_id: str, donor_id: str):
        """Link volunteer and donor records"""
        conn = self.connect_database()
        try:
            with conn.cursor() as cur:
                # Update volunteer record
                cur.execute("""
                    UPDATE volunteer_intelligence
                    SET is_donor = true,
                        is_donor_volunteer = true,
                        donor_id = %s,
                        updated_at = NOW()
                    WHERE volunteer_id = %s
                """, (donor_id, volunteer_id))
                
                # Get donor grade
                cur.execute("""
                    SELECT donor_grade FROM donors WHERE donor_id = %s
                """, (donor_id,))
                result = cur.fetchone()
                if result:
                    cur.execute("""
                        UPDATE volunteer_intelligence
                        SET donor_grade = %s
                        WHERE volunteer_id = %s
                    """, (result[0], volunteer_id))
                
                conn.commit()
                logger.info(f"   ✅ Donor-volunteer link created")
        finally:
            conn.close()
    
    # ========================================================================
    # GRADE ENFORCEMENT
    # ========================================================================
    
    def enforce_volunteer_block(self, volunteer_id: str, grade: str):
        """Block volunteer from critical task assignments"""
        conn = self.connect_database()
        try:
            with conn.cursor() as cur:
                # Cancel any pending critical assignments
                cur.execute("""
                    UPDATE volunteer_shifts
                    SET status = 'cancelled',
                        cancellation_reason = 'Grade enforcement: ' || %s,
                        cancelled_at = NOW()
                    WHERE volunteer_id = %s
                      AND status = 'scheduled'
                      AND is_critical = true
                """, (grade, volunteer_id))
                
                conn.commit()
                
                # Log enforcement
                self.log_enforcement(
                    entity_type='volunteer',
                    entity_id=volunteer_id,
                    action='block_critical_tasks',
                    reason=f'Grade {grade} in blocked list'
                )
        finally:
            conn.close()
    
    def enforce_volunteer_rest(self, volunteer_id: str, days: int):
        """Enforce mandatory rest period"""
        conn = self.connect_database()
        rest_until = datetime.now() + timedelta(days=days)
        
        try:
            with conn.cursor() as cur:
                # Set rest period
                cur.execute("""
                    UPDATE volunteer_intelligence
                    SET rest_until = %s,
                        rest_reason = 'Burnout prevention',
                        updated_at = NOW()
                    WHERE volunteer_id = %s
                """, (rest_until, volunteer_id))
                
                # Cancel scheduled shifts
                cur.execute("""
                    UPDATE volunteer_shifts
                    SET status = 'cancelled',
                        cancellation_reason = 'Mandatory rest period',
                        cancelled_at = NOW()
                    WHERE volunteer_id = %s
                      AND status = 'scheduled'
                      AND shift_date <= %s
                """, (volunteer_id, rest_until.date()))
                
                conn.commit()
                logger.info(f"   📅 Rest enforced until {rest_until.date()}")
        finally:
            conn.close()
    
    def reduce_volunteer_hours(self, volunteer_id: str, reduction: float):
        """Reduce volunteer's maximum hours"""
        conn = self.connect_database()
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE volunteer_intelligence
                    SET max_hours_override = COALESCE(
                        (SELECT max_hours_per_week FROM volunteer_grade_rules 
                         WHERE grade = volunteer_grade) * %s,
                        10
                    ),
                    hours_override_reason = 'Burnout prevention',
                    hours_override_until = NOW() + INTERVAL '2 weeks',
                    updated_at = NOW()
                    WHERE volunteer_id = %s
                """, (1 - reduction, volunteer_id))
                conn.commit()
        finally:
            conn.close()
    
    # ========================================================================
    # EXISTING HANDLERS (ENHANCED)
    # ========================================================================
    
    def handle_crisis(self, event):
        """Handle crisis detection - IMMEDIATE RESPONSE"""
        urgency = event.get('urgency', 0)
        
        logger.warning(f"🚨 CRISIS DETECTED!")
        logger.info(f"   Article: {event.get('article_title')}")
        logger.info(f"   Urgency: {urgency}/10")
        
        if urgency < BrainConfig.CRISIS_URGENCY_THRESHOLD:
            logger.info(f"   ⏸️ Below threshold, monitoring only")
            return
        
        logger.info(f"   ✅ GO DECISION: Crisis response")
        
        candidate_id = event.get('candidate_id')
        issue = event.get('issue', 'general')
        
        # Request crisis content
        content = self.request_content(
            candidate_id=candidate_id,
            occasion='crisis',
            issue=issue,
            channel='EMAIL'
        )
        
        if content:
            # Select targets - high-grade donors
            targets = self.select_donor_targets(
                candidate_id=candidate_id,
                grades=['A++', 'A+', 'A']
            )
            
            self.trigger_email_campaign(
                candidate_id=candidate_id,
                content_uuid=content['content_uuid'],
                recipients=targets,
                priority='urgent',
                context='crisis_response'
            )
    
    def handle_vip_maxout(self, event):
        """Handle VIP max-out - CANDIDATE ALERT"""
        logger.info(f"💎 VIP MAX-OUT!")
        logger.info(f"   Donor: {event.get('donor_name')}")
        logger.info(f"   Amount: ${event.get('amount'):,}")
        
        candidate_id = event.get('candidate_id')
        donor_id = event.get('donor_id')
        
        # Alert candidate via SMS
        self.send_candidate_alert(
            candidate_id=candidate_id,
            message=f"🚨 VIP: {event.get('donor_name')} MAXED OUT ${event.get('amount'):,.0f}! CALL: {event.get('donor_phone')}"
        )
        
        # Send VIP thank you
        self.trigger_workflow('vip_thank_you', 
            donor_id=donor_id,
            candidate_id=candidate_id
        )
        
        # Check if donor is also volunteer
        volunteer_id = self.get_volunteer_by_donor(donor_id)
        if volunteer_id:
            logger.info(f"   🎖️ VIP is also a DONOR-VOLUNTEER!")
            # Special VIP donor-volunteer recognition
            self.trigger_workflow('vip_donor_volunteer_recognition',
                donor_id=donor_id,
                volunteer_id=volunteer_id,
                candidate_id=candidate_id
            )
    
    def handle_positive_news(self, event):
        """Handle positive news - FUNDRAISING OPPORTUNITY"""
        logger.info(f"📰 POSITIVE COVERAGE!")
        logger.info(f"   Article: {event.get('article_title')}")
        
        candidate_id = event.get('candidate_id')
        
        content = self.request_content(
            candidate_id=candidate_id,
            occasion='momentum',
            channel='EMAIL'
        )
        
        if content:
            # Target active donors AND volunteers
            donor_targets = self.select_donor_targets(
                candidate_id=candidate_id,
                grades=['A+', 'A', 'B+', 'B']
            )
            
            # Also get donor-volunteers for special treatment
            donor_volunteer_targets = self.select_donor_volunteer_targets(
                candidate_id=candidate_id
            )
            
            self.trigger_email_campaign(
                candidate_id=candidate_id,
                content_uuid=content['content_uuid'],
                recipients=donor_targets,
                priority='normal',
                context='positive_news_fundraising'
            )
    
    def handle_donor_grade_change(self, event):
        """Handle donor grade change - enforce rules"""
        donor_id = event.get('donor_id')
        old_grade = event.get('old_grade')
        new_grade = event.get('new_grade')
        
        logger.info(f"📊 DONOR GRADE: {old_grade} → {new_grade}")
        
        rules = DONOR_GRADE_RULES.get(new_grade, {})
        
        if rules.get('blocked'):
            logger.warning(f"   ⛔ Donor {donor_id} now BLOCKED")
            self.enforce_donor_block(donor_id)
        
        # Check if also a volunteer
        volunteer_id = self.get_volunteer_by_donor(donor_id)
        if volunteer_id:
            # Update volunteer record with new donor grade
            self.update_volunteer_donor_grade(volunteer_id, new_grade)
    
    def handle_donation(self, event):
        """Handle donation received"""
        amount = event.get('amount', 0)
        donor_id = event.get('donor_id')
        
        # Check if donor is also volunteer
        volunteer_id = self.get_volunteer_by_donor(donor_id)
        
        if volunteer_id and amount >= BrainConfig.MAJOR_DONOR_THRESHOLD:
            logger.info(f"💰 DONOR-VOLUNTEER made ${amount:,.0f} donation!")
            # Tag as potential fundraiser host
            self.tag_potential_host(volunteer_id, amount)
    
    # ========================================================================
    # HELPER METHODS
    # ========================================================================
    
    def publish_event(self, event_type: str, **kwargs):
        """Publish event to Redis bus"""
        event = {
            'event_type': event_type,
            'ecosystem': 20,
            'timestamp': datetime.utcnow().isoformat(),
            **kwargs
        }
        self.redis.publish('broyhillgop.events', json.dumps(event))
    
    def trigger_workflow(self, workflow_name: str, **params):
        """Trigger automated workflow"""
        workflow_id = f"wf_{workflow_name}_{int(datetime.utcnow().timestamp())}"
        
        self.publish_event(
            'brain.workflow_started',
            workflow_id=workflow_id,
            workflow_name=workflow_name,
            params=params
        )
        
        self.active_workflows[workflow_id] = {
            'name': workflow_name,
            'started_at': datetime.utcnow(),
            'params': params
        }
        
        logger.info(f"   🔄 Workflow triggered: {workflow_name}")
        return workflow_id
    
    def request_content(self, candidate_id: str, occasion: str, 
                       channel: str = 'EMAIL', issue: str = None) -> Optional[Dict]:
        """Request content from Library (E8)"""
        try:
            response = requests.post(
                f"{BrainConfig.LIBRARY_API}/api/request_content",
                json={
                    'candidate_id': candidate_id,
                    'occasion': occasion,
                    'issue': issue,
                    'channel': channel,
                    'limit': 1
                },
                timeout=5
            )
            if response.status_code == 200:
                data = response.json()
                if data['total_found'] > 0:
                    return data['content_items'][0]
            return None
        except Exception as e:
            logger.error(f"Content request failed: {e}")
            return None
    
    def select_donor_targets(self, candidate_id: str, 
                            grades: List[str] = None,
                            limit: int = 10000) -> List[str]:
        """Select donor targets"""
        conn = self.connect_database()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                sql = """
                    SELECT donor_id FROM donors
                    WHERE candidate_id = %s AND is_active = true
                """
                params = [candidate_id]
                
                if grades:
                    placeholders = ','.join(['%s'] * len(grades))
                    sql += f" AND donor_grade IN ({placeholders})"
                    params.extend(grades)
                
                sql += " ORDER BY donor_score DESC LIMIT %s"
                params.append(limit)
                
                cur.execute(sql, params)
                return [row['donor_id'] for row in cur.fetchall()]
        finally:
            conn.close()
    
    def select_donor_volunteer_targets(self, candidate_id: str) -> List[str]:
        """Select donor-volunteer targets"""
        conn = self.connect_database()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT vi.volunteer_id, vi.donor_id
                    FROM volunteer_intelligence vi
                    WHERE vi.is_donor_volunteer = true
                    ORDER BY vi.composite_score DESC
                """)
                return [row['donor_id'] for row in cur.fetchall()]
        finally:
            conn.close()
    
    def get_volunteer_by_donor(self, donor_id: str) -> Optional[str]:
        """Get volunteer ID for a donor"""
        conn = self.connect_database()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT volunteer_id FROM volunteer_intelligence
                    WHERE donor_id = %s
                """, (donor_id,))
                result = cur.fetchone()
                return result['volunteer_id'] if result else None
        finally:
            conn.close()
    
    def get_source_priority(self, source_code: str) -> int:
        """Get priority level for lead source"""
        conn = self.connect_database()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT priority_level FROM volunteer_sources
                    WHERE source_code = %s
                """, (source_code,))
                result = cur.fetchone()
                return result['priority_level'] if result else 5
        finally:
            conn.close()
    
    def trigger_email_campaign(self, candidate_id: str, content_uuid: str,
                              recipients: List[str], priority: str = 'normal',
                              context: str = None) -> str:
        """Trigger email campaign"""
        campaign_id = f"camp_{int(datetime.utcnow().timestamp())}"
        
        self.publish_event(
            'brain.campaign_triggered',
            campaign_id=campaign_id,
            candidate_id=candidate_id,
            content_uuid=content_uuid,
            channel='EMAIL',
            recipients_count=len(recipients),
            priority=priority,
            context=context
        )
        
        return campaign_id
    
    def send_candidate_alert(self, candidate_id: str, message: str):
        """Send SMS alert to candidate"""
        self.publish_event(
            'sms.send_alert',
            candidate_id=candidate_id,
            message=message,
            priority='urgent'
        )
    
    def send_staff_alert(self, message: str, priority: str = 'normal',
                        recipients: List[str] = None):
        """Send alert to staff"""
        self.publish_event(
            'staff.alert',
            message=message,
            priority=priority,
            recipients=recipients or ['default']
        )
    
    def log_enforcement(self, entity_type: str, entity_id: str, 
                       action: str, reason: str):
        """Log enforcement action"""
        conn = self.connect_database()
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO enforcement_log
                    (entity_type, entity_id, action, reason, created_at)
                    VALUES (%s, %s, %s, %s, NOW())
                """, (entity_type, entity_id, action, reason))
                conn.commit()
        except Exception as e:
            logger.error(f"Enforcement log failed: {e}")
        finally:
            conn.close()
    
    def track_engagement(self, event):
        """Track engagement"""
        logger.debug(f"📊 Engagement tracked")
    
    # Placeholder methods for full implementation
    def add_to_vip_volunteer_list(self, volunteer_id: str): pass
    def add_to_leadership_pipeline(self, volunteer_id: str, categories: List[str]): pass
    def add_to_elite_team(self, volunteer_id: str): pass
    def create_followup_task(self, volunteer_id: str, due_hours: int, task_type: str): pass
    def update_source_stats(self, source_code: str, total: int, new: int): pass
    def create_volunteer_from_scout(self, discovery_id: str): pass
    def queue_scout_for_review(self, discovery_id: str, priority: str): pass
    def update_volunteer_donor_grade(self, volunteer_id: str, grade: str): pass
    def enforce_donor_block(self, donor_id: str): pass
    def tag_potential_host(self, volunteer_id: str, amount: float): pass
    def handle_donor_churn_risk(self, event): pass
    
    # ========================================================================
    # MAIN LOOP
    # ========================================================================
    
    def start_monitoring(self):
        """Start event monitoring loop"""
        self.subscribe_to_events()
        self.running = True
        
        logger.info("🎧 Intelligence Brain listening...")
        
        try:
            for message in self.pubsub.listen():
                if not self.running:
                    break
                if message['type'] == 'message':
                    self.handle_event(message)
        except KeyboardInterrupt:
            logger.info("Stopping...")
        finally:
            self.stop()
    
    def stop(self):
        """Stop monitoring"""
        self.running = False
        if self.pubsub:
            self.pubsub.close()
        logger.info("👋 Intelligence Brain stopped")


# ============================================================================
# MAIN
# ============================================================================

def main():
    """Main entry point"""
    print("=" * 70)
    print("🧠 INTELLIGENCE BRAIN - ECOSYSTEM 20 v2.0")
    print("=" * 70)
    print()
    print("INTEGRATIONS:")
    print("  • E1:  Donor Intelligence")
    print("  • E5.1: Volunteer Intelligence ⭐ NEW")
    print("  • E8:  Communications Library")
    print("  • E42: News Intelligence")
    print("  • E30-32: Campaign Execution")
    print()
    print("FEATURES:")
    print("  • Star Rating Processing")
    print("  • Lead Source Tracking")
    print("  • Burnout Prevention")
    print("  • Donor-Volunteer Coordination")
    print()
    
    brain = IntelligenceBrain()
    
    try:
        brain.redis.ping()
        print("✅ Redis connected")
    except Exception as e:
        print(f"❌ Redis failed: {e}")
        print("   Brain will still process direct calls")
    
    print()
    print("🎧 Listening for events...")
    print()
    brain.start_monitoring()


if __name__ == "__main__":
    main()
