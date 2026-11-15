"""Offline R8 evaluation metrics. Reads one bounded numeric request, writes JSON."""
from __future__ import annotations

import json
import sys

MAX_INPUT = 1024 * 1024
MAX_CASES = 10_000
MAX_LATENCY_MS = 86_400_000


def unique_object(pairs: list[tuple]) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate_key")
        result[key] = value
    return result


def build_report(request: object) -> dict:
    keys = {"schemaVersion", "rankings", "totalRerankLatencyMs", "sourcePreserved"}
    if (not isinstance(request, dict) or set(request) != keys
            or type(request["schemaVersion"]) is not int or request["schemaVersion"] != 1
            or not isinstance(request["rankings"], list)
            or not 1 <= len(request["rankings"]) <= MAX_CASES
            or type(request["totalRerankLatencyMs"]) is not int
            or not 0 <= request["totalRerankLatencyMs"] <= MAX_LATENCY_MS
            or type(request["sourcePreserved"]) is not bool):
        raise ValueError("invalid_request")
    rows = request["rankings"]
    count = len(rows)
    for row in rows:
        if not isinstance(row, dict) or set(row) != {"lexical", "reranked"}:
            raise ValueError("invalid_row")
        for key in ("lexical", "reranked"):
            ranking = row[key]
            if (not isinstance(ranking, list) or len(ranking) > min(3, count)
                    or (key == "reranked" and len(ranking) != min(3, count))
                    or any(type(index) is not int or not 0 <= index < count for index in ranking)
                    or len(set(ranking)) != len(ranking)):
                raise ValueError("invalid_ranking")
    # Row i expects candidate i. Candidate numbers are ephemeral, not memory IDs.
    def recall(key: str, limit: int) -> float:
        return sum(index in row[key][:limit] for index, row in enumerate(rows)) / count

    elapsed = request["totalRerankLatencyMs"]
    return {
        "realConfirmedProfileRecords": count,
        "lexicalTop1": recall("lexical", 1),
        "lexicalTop3": recall("lexical", 3),
        "gemmaRerankTop1": recall("reranked", 1),
        "gemmaRerankTop3": recall("reranked", 3),
        "totalRerankLatencyMs": elapsed,
        # Same nonnegative half-up rule as Math.round(elapsed / count).
        "meanRerankLatencyMs": (2 * elapsed + count) // (2 * count),
        "sourcePreserved": request["sourcePreserved"],
        "indexPersisted": False,
    }


def main() -> int:
    if len(sys.argv) != 1:
        raise ValueError("arguments_not_supported")
    raw = sys.stdin.buffer.read(MAX_INPUT + 1)
    if len(raw) > MAX_INPUT:
        raise ValueError("input_limit")
    request = json.loads(raw.decode("utf-8"), object_pairs_hook=unique_object)
    report = build_report(request)
    sys.stdout.buffer.write(json.dumps(report, allow_nan=False, separators=(",", ":")).encode("ascii"))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, UnicodeError, TypeError, RecursionError):
        sys.stderr.buffer.write(b'{"error":"invalid_rerank_report_request"}\n')
        raise SystemExit(2)
