"""E01 NC First donor explorer — DonorAtlas shape adapted onto BroyhillGOP canon.

Read-only. Person key is cluster_id INTEGER. No donor_id table. No Hetzner write.
GOLD: NCBOE Individual + FEC cand_id. PAC/party/charity = tattoo.

Dump: ECO_CANONICAL/E01/docs/DONORATLAS_BREAKDOWN_utm_medium_paid_2026-09-04.pdf
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Iterable, Optional

E01_ROOT = Path(__file__).resolve().parent.parent
TAXONOMY_PATH = E01_ROOT / "taxonomies" / "nc_first.yaml"
DIRECTORIES_PATH = E01_ROOT / "directories" / "nc_first_directories.yaml"
STACK_PATH = E01_ROOT / "config" / "nc_first_stack.yaml"

ED_CANARY_CLUSTER_ID = 372171
ED_CANARY_TXNS = 147
ED_CANARY_SUM = 332631.30

DONORATLAS_GTM_DO_NOT_COPY = "G-WTM3XSDRZX"


class NCFirstError(ValueError):
    """NC First explorer contract error."""


def _load_yaml(path: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    try:
        import yaml  # type: ignore
    except ImportError as exc:  # pragma: no cover — tests install pyyaml
        raise NCFirstError(f"pyyaml required to load {path}") from exc
    data = yaml.safe_load(text)
    if not isinstance(data, dict):
        raise NCFirstError(f"{path} is not a mapping")
    return data


def load_taxonomy() -> dict[str, Any]:
    return _load_yaml(TAXONOMY_PATH)


def load_directories() -> dict[str, Any]:
    return _load_yaml(DIRECTORIES_PATH)


def load_stack() -> dict[str, Any]:
    return _load_yaml(STACK_PATH)


def require_cluster_id(value: Any) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise NCFirstError(
            f"person key is cluster_id INTEGER, got {type(value).__name__}={value!r}"
        )
    if value <= 0:
        raise NCFirstError("cluster_id must be a positive INTEGER")
    return value


def reject_donor_id(payload: dict[str, Any]) -> None:
    for key in payload:
        if str(key).lower() in {"donor_id", "org_id"}:
            raise NCFirstError(
                f"rejected {key}: NC First uses cluster_id INTEGER and ein/committee ids"
            )


def is_ncboe_gold(transction_type: Optional[str]) -> bool:
    return (transction_type or "").strip() == "Individual"


def is_fec_gold(cand_id: Optional[str]) -> bool:
    return bool(cand_id and str(cand_id).strip())


def nc_county_set(taxonomy: Optional[dict[str, Any]] = None) -> set[str]:
    tax = taxonomy or load_taxonomy()
    names = tax.get("nc_counties") or []
    if len(names) != 100:
        raise NCFirstError(f"NC First requires 100 counties, got {len(names)}")
    return {str(n) for n in names}


@dataclass
class NCFirstDonor:
    cluster_id: int
    display_name: str
    county: str
    city: str
    state: str
    zip5: str
    employer: str
    lifetime_total: float
    txn_count: int
    last_gift_date: Optional[str]
    office_tier: str
    office_class: str
    grade: str = ""
    source: str = "fixture"
    demo: bool = False

    def __post_init__(self) -> None:
        self.cluster_id = require_cluster_id(self.cluster_id)
        if self.state != "NC":
            raise NCFirstError(f"NC First explorer rejects state={self.state!r}")


@dataclass
class NCFirstExplorer:
    taxonomy: dict[str, Any]
    donors: list[NCFirstDonor] = field(default_factory=list)

    @classmethod
    def from_shelf(cls, rows: Optional[Iterable[dict[str, Any]]] = None) -> "NCFirstExplorer":
        tax = load_taxonomy()
        nc_county_set(tax)
        donors = [NCFirstDonor(**row) for row in (rows or fixture_rows())]
        return cls(taxonomy=tax, donors=donors)

    def search(
        self,
        *,
        q: str = "",
        county: Optional[str] = None,
        zip5: Optional[str] = None,
        min_lifetime: float = 0.0,
        office_tier: Optional[str] = None,
        sort: str = "lifetime_total",
    ) -> list[NCFirstDonor]:
        reject_donor_id({"q": q})
        counties = nc_county_set(self.taxonomy)
        out = []
        needle = q.strip().lower()
        for d in self.donors:
            if d.county not in counties:
                continue
            if county and d.county.lower() != county.lower():
                continue
            if zip5 and d.zip5 != zip5:
                continue
            if d.lifetime_total < min_lifetime:
                continue
            if office_tier and d.office_tier != office_tier:
                continue
            if needle and needle not in d.display_name.lower() and needle not in d.employer.lower():
                continue
            out.append(d)
        key_map = {
            "lifetime_total": lambda d: d.lifetime_total,
            "last_gift_date": lambda d: d.last_gift_date or "",
            "txn_count": lambda d: d.txn_count,
            "zip5": lambda d: d.zip5,
            "county": lambda d: d.county,
        }
        if sort not in key_map:
            raise NCFirstError(f"unknown sort {sort}")
        reverse = sort in {"lifetime_total", "txn_count", "last_gift_date"}
        return sorted(out, key=key_map[sort], reverse=reverse)

    def profile(self, cluster_id: int) -> dict[str, Any]:
        cid = require_cluster_id(cluster_id)
        for d in self.donors:
            if d.cluster_id == cid:
                payload = asdict(d)
                payload["person_key"] = "cluster_id"
                payload["spine"] = "gold"
                return payload
        raise NCFirstError(f"cluster_id {cid} not in explorer")

    def tattoo(self, cluster_id: int) -> dict[str, Any]:
        prof = self.profile(cluster_id)
        return {
            "cluster_id": prof["cluster_id"],
            "spine": "gold",
            "tattoo": {
                "ncboe_individual": True,
                "fec_candidate": prof.get("office_tier") == "federal",
                "pac_party_charity": "tattoo_only",
            },
            "network": [],
            "notes": "Empty network until live tattoo join is authorized. Do not invent edges.",
        }

    def export_list(self, cluster_ids: list[int]) -> dict[str, Any]:
        rows = [self.profile(cid) for cid in cluster_ids]
        return {
            "format": "json",
            "send": False,
            "authorization": "required_for_outbound",
            "rows": rows,
        }


def fixture_rows() -> list[dict[str, Any]]:
    """Canary + labeled DEMO rows. DEMO ids are not live people."""
    return [
        {
            "cluster_id": ED_CANARY_CLUSTER_ID,
            "display_name": "JAMES EDGAR BROYHILL",
            "county": "Caldwell",
            "city": "Lenoir",
            "state": "NC",
            "zip5": "28645",
            "employer": "BROYHILL",
            "lifetime_total": ED_CANARY_SUM,
            "txn_count": ED_CANARY_TXNS,
            "last_gift_date": "2024-10-01",
            "office_tier": "state",
            "office_class": "state_auditor",
            "grade": "A++",
            "source": "canary",
            "demo": False,
        },
        {
            "cluster_id": 999000001,
            "display_name": "DEMO WAKE COUNTY FIXTURE",
            "county": "Wake",
            "city": "Raleigh",
            "state": "NC",
            "zip5": "27601",
            "employer": "DEMO ONLY",
            "lifetime_total": 5400.00,
            "txn_count": 6,
            "last_gift_date": "2026-05-01",
            "office_tier": "state",
            "office_class": "governor",
            "grade": "B",
            "source": "fixture",
            "demo": True,
        },
        {
            "cluster_id": 999000002,
            "display_name": "DEMO ONSLOW SHERIFF FIXTURE",
            "county": "Onslow",
            "city": "Jacksonville",
            "state": "NC",
            "zip5": "28540",
            "employer": "DEMO ONLY",
            "lifetime_total": 1200.00,
            "txn_count": 3,
            "last_gift_date": "2026-03-15",
            "office_tier": "county",
            "office_class": "sheriff",
            "grade": "C",
            "source": "fixture",
            "demo": True,
        },
    ]


def map_donoratlas_path(path: str) -> str:
    """Map DonorAtlas REST onto NC First paths. donor_id → cluster_id."""
    p = path.strip()
    p = p.replace("/api/v1/donors", "/e01/nc-first/donors")
    p = p.replace("/api/v1/organizations", "/e01/nc-first/orgs")
    p = p.replace("/network", "/tattoo")
    p = p.replace("{donor_id}", "{cluster_id}")
    p = p.replace("{org_id}", "{ein}")
    if "donor_id" in p:
        raise NCFirstError("path still contains donor_id")
    return p


def explorer_json() -> str:
    exp = NCFirstExplorer.from_shelf()
    return json.dumps(
        {
            "lane": "E01",
            "person_key": "cluster_id",
            "counties": sorted(nc_county_set(exp.taxonomy)),
            "donors": [asdict(d) for d in exp.search()],
            "gtm_do_not_copy": DONORATLAS_GTM_DO_NOT_COPY,
        },
        indent=2,
    )


if __name__ == "__main__":
    print(explorer_json())
