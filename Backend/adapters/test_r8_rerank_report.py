import copy
import json
import unittest

import r8_rerank_report as reporter


def fixture():
    return {"schemaVersion": 1, "rankings": [
        {"lexical": [1, 0], "reranked": [2, 0, 1]},
        {"lexical": [], "reranked": [1, 2, 0]},
        {"lexical": [2], "reranked": [3, 1, 0]},
        {"lexical": [0, 1, 2], "reranked": [3, 2, 1]},
    ], "totalRerankLatencyMs": 10, "sourcePreserved": True}


class RerankReportTests(unittest.TestCase):
    def test_known_recall_and_half_up_mean(self):
        original = fixture()
        saved = copy.deepcopy(original)
        result = reporter.build_report(original)
        self.assertEqual(result, {
            "realConfirmedProfileRecords": 4, "lexicalTop1": 0.25, "lexicalTop3": 0.5,
            "gemmaRerankTop1": 0.5, "gemmaRerankTop3": 0.75,
            "totalRerankLatencyMs": 10, "meanRerankLatencyMs": 3,
            "sourcePreserved": True, "indexPersisted": False,
        })
        self.assertEqual(original, saved)

    def test_empty_lexical_and_false_preservation_remain_visible(self):
        request = {"schemaVersion": 1, "rankings": [{"lexical": [], "reranked": [0]}],
                   "totalRerankLatencyMs": 0, "sourcePreserved": False}
        result = reporter.build_report(request)
        self.assertEqual(result["lexicalTop3"], 0)
        self.assertEqual(result["gemmaRerankTop1"], 1)
        self.assertFalse(result["sourcePreserved"])
        self.assertEqual(result["meanRerankLatencyMs"], 0)

    def test_closed_schema_and_limits(self):
        for key, value in [("schemaVersion", True), ("rankings", []), ("rankings", [None]),
                           ("totalRerankLatencyMs", -1), ("totalRerankLatencyMs", 0.5),
                           ("totalRerankLatencyMs", True), ("totalRerankLatencyMs", 86_400_001),
                           ("sourcePreserved", "true"), ("privateText", "not_allowed")]:
            with self.subTest(key=key, value=value):
                request = fixture()
                request[key] = value
                with self.assertRaises(ValueError):
                    reporter.build_report(request)
        with self.assertRaises(ValueError):
            reporter.build_report(None)
        request = fixture()
        request["rankings"] *= 2501
        with self.assertRaises(ValueError):
            reporter.build_report(request)

    def test_invalid_rankings_fail_before_any_report(self):
        for ranking in [[0, 0, 1], [-1, 0, 1], [True, 0, 1], [1.0, 0, 2],
                        [0, 1, 4], [0, 1, 2, 3], ["0", 1, 2], [[0], 1, 2], None]:
            for key in ["lexical", "reranked"]:
                with self.subTest(key=key, ranking=ranking):
                    request = fixture()
                    request["rankings"][-1][key] = ranking
                    with self.assertRaises(ValueError):
                        reporter.build_report(request)
        request = fixture()
        request["rankings"][0]["reranked"] = [0, 1]
        with self.assertRaises(ValueError):
            reporter.build_report(request)

    def test_duplicate_json_keys_rejected(self):
        with self.assertRaises(ValueError):
            json.loads('{"schemaVersion":1,"schemaVersion":1}', object_pairs_hook=reporter.unique_object)


if __name__ == "__main__":
    unittest.main()
