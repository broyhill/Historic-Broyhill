"""NC First DonorAtlas adaptation — no Hetzner required."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

E01_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(E01_ROOT / "code"))

import nc_first_donor_explorer as ncf  # noqa: E402


class TaxonomyTests(unittest.TestCase):
    def test_100_nc_counties(self):
        names = ncf.nc_county_set()
        self.assertEqual(len(names), 100)
        self.assertIn("Wake", names)
        self.assertIn("Caldwell", names)
        self.assertIn("Onslow", names)

    def test_person_key_is_cluster_id_integer(self):
        tax = ncf.load_taxonomy()
        self.assertEqual(tax["person_key"], "cluster_id")
        self.assertEqual(tax["person_key_type"], "INTEGER")
        self.assertEqual(tax["state"], "NC")

    def test_issue_families_are_nc_first_not_dump_default(self):
        tax = ncf.load_taxonomy()
        ids = {i["id"] for i in tax["issue_families"]}
        self.assertIn("second_amendment", ids)
        self.assertIn("local_district", ids)
        self.assertNotIn("reproductive_rights", ids)

    def test_pac_is_tattoo_not_spine(self):
        tax = ncf.load_taxonomy()
        pac = next(e for e in tax["entities"] if e["id"] == "pac")
        self.assertEqual(pac["spine"], "tattoo")
        human = next(e for e in tax["entities"] if e["id"] == "individual_donor")
        self.assertEqual(human["spine"], "gold")

    def test_triggers_extend_brain_only(self):
        tax = ncf.load_taxonomy()
        self.assertEqual(tax["triggers"]["catalog"], "brain.triggers")
        self.assertEqual(tax["triggers"]["do_not_create"], "parallel_trigger_table")
        self.assertIn("donor.grade_changed", tax["triggers"]["existing"])


class ContractTests(unittest.TestCase):
    def test_reject_donor_id(self):
        with self.assertRaises(ncf.NCFirstError):
            ncf.reject_donor_id({"donor_id": "abc"})
        with self.assertRaises(ncf.NCFirstError):
            ncf.require_cluster_id("372171")
        self.assertEqual(ncf.require_cluster_id(372171), 372171)

    def test_gold_filters(self):
        self.assertTrue(ncf.is_ncboe_gold("Individual"))
        self.assertFalse(ncf.is_ncboe_gold("Cont to Other Comm"))
        self.assertTrue(ncf.is_fec_gold("H6NC00123"))
        self.assertFalse(ncf.is_fec_gold(None))

    def test_path_map(self):
        self.assertEqual(
            ncf.map_donoratlas_path("GET /api/v1/donors/{donor_id}/profile"),
            "GET /e01/nc-first/donors/{cluster_id}/profile",
        )
        self.assertIn("/tattoo", ncf.map_donoratlas_path("/api/v1/donors/{donor_id}/network"))

    def test_gtm_not_ours(self):
        stack = ncf.load_stack()
        self.assertEqual(stack["gtm_id_do_not_copy"], "G-WTM3XSDRZX")
        self.assertEqual(stack["tech_stack"]["search"]["ours_docs"].split()[0], "E84")


class ExplorerTests(unittest.TestCase):
    def setUp(self):
        self.exp = ncf.NCFirstExplorer.from_shelf()

    def test_canary_present(self):
        prof = self.exp.profile(372171)
        self.assertEqual(prof["txn_count"], 147)
        self.assertEqual(prof["lifetime_total"], 332631.30)
        self.assertEqual(prof["county"], "Caldwell")
        self.assertEqual(prof["person_key"], "cluster_id")

    def test_search_wake_and_sort(self):
        rows = self.exp.search(county="Wake")
        self.assertEqual(len(rows), 1)
        self.assertTrue(rows[0].demo)
        ranked = self.exp.search(sort="lifetime_total")
        self.assertEqual(ranked[0].cluster_id, 372171)

    def test_export_does_not_send(self):
        payload = self.exp.export_list([372171])
        self.assertFalse(payload["send"])
        self.assertEqual(payload["authorization"], "required_for_outbound")

    def test_sheriff_not_collapsed_to_local(self):
        rows = self.exp.search(office_tier="county")
        self.assertEqual(rows[0].office_class, "sheriff")


if __name__ == "__main__":
    unittest.main()
