"""E30 dual-grade email router.

Routes emails by donor grade (state vs county) to the appropriate
template tier and personalization depth.  County-grade campaigns (sheriff,
commissioner, school board) use county grade; statewide campaigns use
state grade.

Grade mapping follows the BroyhillGOP 13-tier donor grading system:
  A++ → PERSONALIZED_VIP (handcrafted, 1/week max)
  A+  → PERSONALIZED_VIP
  A   → HIGH_VALUE (personalized merge, 2/week max)
  A-  → HIGH_VALUE
  B+  → STANDARD_SEGMENTED (3/week max)
  B   → STANDARD_SEGMENTED
  B-  → STANDARD_SEGMENTED
  C+  → MASS_OPTIMIZED (4/week max)
  C   → MASS_OPTIMIZED
  C-  → MASS_OPTIMIZED
  D+  → MINIMAL (5/week max)
  D   → MINIMAL
  D-  → MINIMAL
  U   → MINIMAL (ungraded)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from ecosystems.e30_email.contracts import EmailTemplate


# ---------------------------------------------------------------------------
# Grade → template mapping
# ---------------------------------------------------------------------------

TEMPLATE_BY_GRADE: Dict[str, EmailTemplate] = {
    "A++": EmailTemplate.PERSONALIZED_VIP,
    "A+":  EmailTemplate.PERSONALIZED_VIP,
    "A":   EmailTemplate.HIGH_VALUE,
    "A-":  EmailTemplate.HIGH_VALUE,
    "B+":  EmailTemplate.STANDARD_SEGMENTED,
    "B":   EmailTemplate.STANDARD_SEGMENTED,
    "B-":  EmailTemplate.STANDARD_SEGMENTED,
    "C+":  EmailTemplate.MASS_OPTIMIZED,
    "C":   EmailTemplate.MASS_OPTIMIZED,
    "C-":  EmailTemplate.MASS_OPTIMIZED,
    "D+":  EmailTemplate.MINIMAL,
    "D":   EmailTemplate.MINIMAL,
    "D-":  EmailTemplate.MINIMAL,
    "U":   EmailTemplate.MINIMAL,
}

# Max emails per week by grade tier
MAX_EMAILS_PER_WEEK: Dict[str, int] = {
    "A++": 1,
    "A+":  1,
    "A":   2,
    "A-":  2,
    "B+":  3,
    "B":   3,
    "B-":  3,
    "C+":  4,
    "C":   4,
    "C-":  4,
    "D+":  5,
    "D":   5,
    "D-":  5,
    "U":   5,
}

# Personalization depth by grade
PERSONALIZATION_FIELDS: Dict[str, List[str]] = {
    "A++": ["first_name", "last_name", "donation_history", "personal_note",
            "handwritten_signature", "last_donation", "days_since_donation"],
    "A+":  ["first_name", "last_name", "donation_history", "personal_note",
            "last_donation"],
    "A":   ["first_name", "last_name", "donation_history", "last_donation"],
    "A-":  ["first_name", "last_name", "last_donation"],
    "B+":  ["first_name", "last_name"],
    "B":   ["first_name", "last_name"],
    "B-":  ["first_name"],
    "C+":  ["first_name"],
    "C":   [],
    "C-":  [],
    "D+":  [],
    "D":   [],
    "D-":  [],
    "U":   [],
}

# Campaign types that use county grade
LOCAL_CAMPAIGN_TYPES = frozenset({
    "local", "county", "sheriff", "commissioner",
    "school_board", "clerk", "register_of_deeds", "da",
})


# ---------------------------------------------------------------------------
# Recipient with dual grading
# ---------------------------------------------------------------------------

@dataclass
class GradedRecipient:
    """Email recipient enriched with dual grading info."""
    donor_id: str
    email: str
    full_name: str
    county: str
    grade_state: str
    rank_state: int
    grade_county: str
    rank_county: int
    total_donations: float = 0.0
    last_donation_date: Optional[str] = None


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

def resolve_grade(recipient: GradedRecipient, campaign_type: str) -> str:
    """Pick the right grade based on campaign scope."""
    if campaign_type.lower() in LOCAL_CAMPAIGN_TYPES:
        return recipient.grade_county
    return recipient.grade_state


def resolve_template(grade: str) -> EmailTemplate:
    return TEMPLATE_BY_GRADE.get(grade, EmailTemplate.MINIMAL)


def resolve_max_per_week(grade: str) -> int:
    return MAX_EMAILS_PER_WEEK.get(grade, 5)


def resolve_personalization_fields(grade: str) -> List[str]:
    return PERSONALIZATION_FIELDS.get(grade, [])


def build_batches(recipients: List[GradedRecipient],
                  campaign_type: str) -> Dict[EmailTemplate, List[GradedRecipient]]:
    """Group recipients into batches by template tier."""
    batches: Dict[EmailTemplate, List[GradedRecipient]] = {
        t: [] for t in EmailTemplate
    }
    for r in recipients:
        grade = resolve_grade(r, campaign_type)
        template = resolve_template(grade)
        batches[template].append(r)
    return batches


def build_recipient_query(campaign_type: str,
                          target_grades: List[str],
                          county: Optional[str] = None,
                          limit: int = 10_000) -> tuple[str, list[Any]]:
    """Build parameterised SQL query for email list.

    Returns (sql, params) — NEVER uses string formatting for values.
    """
    grade_placeholders = ", ".join(["%s"] * len(target_grades))

    if campaign_type.lower() in LOCAL_CAMPAIGN_TYPES and county:
        sql = f"""
            SELECT cluster_id, email, full_name, county, total_donations,
                   donor_grade_state, donor_rank_state,
                   donor_grade_county, donor_rank_county,
                   last_donation_date
            FROM core.donor_profile
            WHERE county = %s
              AND donor_grade_county IN ({grade_placeholders})
              AND email IS NOT NULL
              AND email != ''
            ORDER BY donor_rank_county ASC
            LIMIT %s
        """
        params: list[Any] = [county] + target_grades + [limit]
    else:
        sql = f"""
            SELECT cluster_id, email, full_name, county, total_donations,
                   donor_grade_state, donor_rank_state,
                   donor_grade_county, donor_rank_county,
                   last_donation_date
            FROM core.donor_profile
            WHERE donor_grade_state IN ({grade_placeholders})
              AND email IS NOT NULL
              AND email != ''
            ORDER BY donor_rank_state ASC
            LIMIT %s
        """
        params = target_grades + [limit]

    return sql, params
