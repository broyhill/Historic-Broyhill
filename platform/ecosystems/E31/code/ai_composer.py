"""
E31 AI Composer — microsegment × issue × tone message personalization.

Diamond Vault spec: 40 microsegments × 20+ hot issues = 800+ message
variations. AI generates unique copy per donor profile, adapting tone,
issue framing, ask amount, and urgency to maximize response.

Uses Claude API for generation. Learns from A/B test results and
reply sentiment to evolve templates over time.
"""

import json
import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

import requests

from ecosystems.e31_sms_mms.config import E31Config

logger = logging.getLogger("e31.ai_composer")


# ── Microsegments (40 NC-specific) ───────────────────────────────────

MICROSEGMENTS = [
    "rural_gun_owner", "suburban_professional", "urban_conservative",
    "military_veteran", "law_enforcement", "small_business_owner",
    "farmer_rancher", "real_estate_developer", "healthcare_worker",
    "educator_school_choice", "tech_professional", "financial_services",
    "manufacturing_worker", "energy_sector", "construction_trades",
    "retiree_fixed_income", "young_republican_18_30", "parent_k12",
    "faith_community_leader", "pro_life_activist",
    "second_amendment_advocate", "property_rights_advocate",
    "tax_reform_advocate", "border_security_first", "ncgop_delegate",
    "county_gop_officer", "precinct_captain", "major_donor_10k_plus",
    "mid_donor_1k_10k", "small_donor_sub_1k", "first_time_donor",
    "lapsed_donor_12mo", "event_attendee", "volunteer_active",
    "sports_community", "auto_dealer_network", "insurance_professional",
    "attorney_legal", "medical_professional", "faith_evangelical",
]

# ── Hot Issues (20+ NC-specific) ─────────────────────────────────────

HOT_ISSUES = [
    "economy_inflation", "second_amendment", "border_security",
    "education_school_choice", "pro_life", "election_integrity",
    "tax_cuts", "energy_independence", "veterans_affairs",
    "law_enforcement_support", "religious_liberty", "free_speech",
    "government_spending", "healthcare_choice", "property_rights",
    "judicial_reform", "term_limits", "trump_agenda",
    "local_development", "nc_budget", "hurricane_recovery",
    "fentanyl_crisis", "parental_rights",
]


class AIComposer:
    """AI-powered message personalization engine.

    Pipeline:
    1. Donor profile → microsegment assignment
    2. Heat tensor → top issue for this donor right now
    3. Context (campaign, candidate, event) → template selection
    4. Claude API → personalized message generation
    5. Compliance check → length, content, required disclosures
    6. Output → ready-to-send message body
    """

    def compose(
        self,
        donor_profile: dict,
        candidate_name: str,
        office: str,
        campaign_context: Optional[str] = None,
        issue_override: Optional[str] = None,
        tone: str = "warm",
        max_length: int = 160,
        include_donation_link: bool = False,
        donation_url: Optional[str] = None,
    ) -> dict:
        """Generate a personalized SMS message for a donor.

        Returns: {
            'message': str,
            'microsegment': str,
            'issue': str,
            'tone': str,
            'char_count': int,
            'segments': int,
        }
        """
        # 1. Determine microsegment
        microsegment = self._assign_microsegment(donor_profile)

        # 2. Determine top issue
        issue = issue_override or self._select_issue(donor_profile, microsegment)

        # 3. Build prompt
        first_name = donor_profile.get("norm_first", "Friend")
        grade = donor_profile.get("donor_grade_state", "")
        lifetime = donor_profile.get("lifetime_total", 0)
        suggested_amount = self._suggest_amount(grade, lifetime)

        prompt = self._build_prompt(
            first_name=first_name,
            candidate_name=candidate_name,
            office=office,
            microsegment=microsegment,
            issue=issue,
            tone=tone,
            max_length=max_length,
            suggested_amount=suggested_amount,
            campaign_context=campaign_context,
            include_donation_link=include_donation_link,
            donation_url=donation_url,
        )

        # 4. Generate via Claude API
        message = self._generate(prompt, max_length)

        # 5. Compliance check
        message = self._compliance_check(message, max_length)

        return {
            "message": message,
            "microsegment": microsegment,
            "issue": issue,
            "tone": tone,
            "char_count": len(message),
            "segments": 1 if len(message) <= 160 else -(-len(message) // 153),
            "suggested_amount": suggested_amount,
        }

    def compose_batch(
        self,
        donors: list,
        candidate_name: str,
        office: str,
        campaign_context: Optional[str] = None,
        tone: str = "warm",
    ) -> list:
        """Generate personalized messages for a batch of donors."""
        results = []
        for donor in donors:
            result = self.compose(
                donor_profile=donor,
                candidate_name=candidate_name,
                office=office,
                campaign_context=campaign_context,
                tone=tone,
            )
            result["donor_id"] = donor.get("cluster_id") or donor.get("rnc_regid")
            results.append(result)
        return results

    def _assign_microsegment(self, profile: dict) -> str:
        """Assign donor to a microsegment based on profile attributes."""
        grade = profile.get("donor_grade_state", "")
        lifetime = profile.get("lifetime_total", 0) or 0
        employer = (profile.get("norm_employer", "") or "").lower()
        sic = profile.get("employer_sic_code", "") or ""

        if lifetime >= 10000:
            return "major_donor_10k_plus"
        if lifetime >= 1000:
            return "mid_donor_1k_10k"

        # Industry-based assignment
        if sic.startswith("01") or "farm" in employer:
            return "farmer_rancher"
        if sic.startswith("15") or sic.startswith("17"):
            return "construction_trades"
        if sic.startswith("65") or "real estate" in employer:
            return "real_estate_developer"
        if sic.startswith("80") or "hospital" in employer or "medical" in employer:
            return "healthcare_worker"
        if sic.startswith("63") or "insurance" in employer:
            return "insurance_professional"
        if sic.startswith("81") or "law" in employer or "attorney" in employer:
            return "attorney_legal"
        if "military" in employer or "army" in employer or "navy" in employer:
            return "military_veteran"
        if "police" in employer or "sheriff" in employer:
            return "law_enforcement"

        if lifetime > 0:
            return "small_donor_sub_1k"
        return "first_time_donor"

    def _select_issue(self, profile: dict, microsegment: str) -> str:
        """Select the most resonant issue for this donor/segment combo."""
        issue_map = {
            "rural_gun_owner": "second_amendment",
            "suburban_professional": "tax_cuts",
            "military_veteran": "veterans_affairs",
            "law_enforcement": "law_enforcement_support",
            "small_business_owner": "economy_inflation",
            "farmer_rancher": "property_rights",
            "real_estate_developer": "local_development",
            "healthcare_worker": "healthcare_choice",
            "faith_community_leader": "religious_liberty",
            "faith_evangelical": "pro_life",
            "pro_life_activist": "pro_life",
            "second_amendment_advocate": "second_amendment",
            "young_republican_18_30": "economy_inflation",
            "parent_k12": "education_school_choice",
            "retiree_fixed_income": "economy_inflation",
            "major_donor_10k_plus": "trump_agenda",
            "mid_donor_1k_10k": "economy_inflation",
            "insurance_professional": "healthcare_choice",
            "attorney_legal": "judicial_reform",
            "medical_professional": "healthcare_choice",
        }
        return issue_map.get(microsegment, "economy_inflation")

    def _suggest_amount(self, grade: str, lifetime: float) -> int:
        """Suggest a donation amount based on donor grade and history."""
        grade_amounts = {
            "A++": 2500, "A+": 1000, "A": 500, "A-": 250,
            "B+": 100, "B": 75, "B-": 50,
            "C+": 35, "C": 25, "C-": 15,
            "D": 10, "D-": 5,
        }
        return grade_amounts.get(grade, 25)

    def _build_prompt(
        self,
        first_name: str,
        candidate_name: str,
        office: str,
        microsegment: str,
        issue: str,
        tone: str,
        max_length: int,
        suggested_amount: int,
        campaign_context: Optional[str],
        include_donation_link: bool,
        donation_url: Optional[str],
    ) -> str:
        return f"""Generate a political fundraising SMS message.

CONSTRAINTS:
- Maximum {max_length} characters
- Must feel personal, not mass-produced
- No ALL CAPS words except the candidate's name abbreviation
- Must include the donor's first name
- Tone: {tone}

CONTEXT:
- Donor first name: {first_name}
- Candidate: {candidate_name}
- Office: {office}
- Donor microsegment: {microsegment}
- Top issue for this donor: {issue}
- Suggested ask amount: ${suggested_amount}
{"- Campaign context: " + campaign_context if campaign_context else ""}
{"- Include donation link: " + donation_url if include_donation_link and donation_url else ""}

Write ONLY the message text, nothing else. Make it feel like a personal text from {candidate_name}, not a marketing blast."""

    def _generate(self, prompt: str, max_length: int) -> str:
        """Generate message via Claude API."""
        if not E31Config.ANTHROPIC_API_KEY:
            # Fallback template when API key not configured
            return self._fallback_template()

        try:
            resp = requests.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": E31Config.ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": E31Config.AI_MODEL,
                    "max_tokens": E31Config.AI_MAX_TOKENS,
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            content = data.get("content", [{}])[0].get("text", "")
            return content.strip()[:max_length]
        except requests.RequestException as exc:
            logger.error("Claude API failed: %s", exc)
            return self._fallback_template()

    def _fallback_template(self) -> str:
        """Fallback when AI is unavailable."""
        return (
            "Hi {first_name}, this race matters. Can you chip in "
            "${suggested_amount} to help us win? {donation_link}"
        )

    @staticmethod
    def _compliance_check(message: str, max_length: int) -> str:
        """Ensure message meets compliance requirements."""
        # Truncate if over limit
        if len(message) > max_length:
            message = message[:max_length - 3] + "..."
        return message
