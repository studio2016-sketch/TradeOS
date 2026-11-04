"""Regression fixtures exercise the exact assertions used by the production workflow."""
import json
import pathlib
import textwrap
import unittest

WORKFLOW = pathlib.Path(__file__).resolve().parents[1] / ".github/workflows/knowledge-graph-production.yml"
script = WORKFLOW.read_text().split('          graph=get("/api/knowledge-graph?symbol=NVDA")\n', 1)[1]
GRAPH_ASSERTIONS = textwrap.dedent(script.split('          cert=get("/api/research-certification")', 1)[0])

def validate(graph):
    exec(compile(GRAPH_ASSERTIONS, str(WORKFLOW), "exec"), {"graph": graph, "json": json, "print": lambda *args: None})

def fixture(mode="INDEPENDENT_SOURCE_GRAPH_ACTIVE"):
    return {
        "status": mode, "certifiedPredictiveRelationships": False,
        "corporateRelationships": [], "nodes": [], "edges": [],
        "independentGraph": {
            "policy": {"graphImpliesPrediction": False, "sourceCountMeansIndependentOriginFamilies": True, "minimumIndependentSourcesForCertification": 2},
            "edges": [{"predictiveAuthority": False}],
        },
    }

class GraphAuditContract(unittest.TestCase):
    def test_supported_modes_pass(self):
        for mode in ["RESEARCH_LINEAGE_ONLY", "INDEPENDENT_SOURCE_GRAPH_ACTIVE"]:
            with self.subTest(mode=mode):
                validate(fixture(mode))

    def test_unknown_or_unavailable_modes_fail(self):
        for mode in ["UNAVAILABLE", "CERTIFIED", None]:
            with self.subTest(mode=mode), self.assertRaises(AssertionError):
                validate(fixture(mode))

    def test_predictive_certification_fails(self):
        for value in [True, None, "false"]:
            graph = fixture()
            graph["certifiedPredictiveRelationships"] = value
            with self.subTest(value=value), self.assertRaises(AssertionError):
                validate(graph)

    def test_active_mode_requires_independent_graph(self):
        graph = fixture()
        del graph["independentGraph"]
        with self.assertRaises(AssertionError):
            validate(graph)

    def test_missing_or_unsafe_policies_fail(self):
        for key, value in [("graphImpliesPrediction", True), ("graphImpliesPrediction", None), ("sourceCountMeansIndependentOriginFamilies", False), ("minimumIndependentSourcesForCertification", 1)]:
            graph = fixture()
            graph["independentGraph"]["policy"][key] = value
            with self.subTest(key=key, value=value), self.assertRaises(AssertionError):
                validate(graph)

    def test_missing_edges_and_predictive_edges_fail(self):
        for edges in [None, [{}], [{"predictiveAuthority": True}], [{"predictiveAuthority": "false"}]]:
            graph = fixture()
            graph["independentGraph"]["edges"] = edges
            with self.subTest(edges=edges), self.assertRaises(AssertionError):
                validate(graph)

    def test_unsourced_corporate_relationship_fails(self):
        graph = fixture()
        graph["corporateRelationships"] = [{"publishedAt": "2026-11-04", "verificationStatus": "UNVERIFIED"}]
        with self.assertRaises(AssertionError):
            validate(graph)

if __name__ == "__main__":
    unittest.main()
