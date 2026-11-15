import json
import unittest
from unittest.mock import patch

import obsidian_note_formatter as formatter


def job():
    return {"id": "synthetic", "label": "Recuerdo registrado", "topic": "Tema ficticio",
            "content": "```text\nñ 😀\n```", "states": ["Vigencia: archived"],
            "provenance": "Fuente ficticia", "storage": "memory/records.json", "technicalJson": "{}"}


class NoteFormatterTests(unittest.TestCase):
    def test_renders_text_and_extends_backtick_fences_without_io(self):
        request = {"schemaVersion": 1, "notes": [job()]}
        with patch("builtins.open", side_effect=AssertionError("No file I/O")):
            result = formatter.render_batch(request)
        self.assertIn("````text\n```text\nñ 😀\n```\n````", result[0]["markdown"])
        self.assertIn("Vigencia: archived", result[0]["markdown"])
        self.assertEqual(result[0]["id"], "synthetic")

    def test_rejects_wrong_schema_duplicate_ids_and_unknown_fields(self):
        for request in ({"schemaVersion": True, "notes": []},
                        {"schemaVersion": 2, "notes": []},
                        {"schemaVersion": 1, "notes": [job(), job()]},
                        {"schemaVersion": 1, "notes": [], "path": "not-a-command"},
                        {"schemaVersion": 1, "notes": [{**job(), "extra": True}]}):
            with self.subTest(request=request), self.assertRaises(ValueError):
                formatter.render_batch(request)

    def test_validates_the_whole_batch_before_rendering(self):
        with patch.object(formatter, "render_note", side_effect=AssertionError("No partial batch")):
            with self.assertRaises(ValueError):
                formatter.render_batch({"schemaVersion": 1, "notes": [job(), {**job(), "id": "bad", "states": [42]}]})

    def test_empty_batch_and_request_count_limit(self):
        self.assertEqual(formatter.render_batch({"schemaVersion": 1, "notes": []}), [])
        with self.assertRaises(ValueError):
            formatter.render_batch({"schemaVersion": 1, "notes": [job()] * 1001})

    def test_duplicate_json_keys_are_rejected(self):
        with self.assertRaises(ValueError):
            json.loads('{"schemaVersion":1,"schemaVersion":1}', object_pairs_hook=formatter.unique_object)

    def test_paths_are_literal_data_and_no_extra_dependencies_are_needed(self):
        value = job()
        value["storage"] = "C:/private/do-not-open.json"
        with patch("builtins.open", side_effect=AssertionError("No path access")):
            rendered = formatter.render_batch({"schemaVersion": 1, "notes": [value]})[0]["markdown"]
        self.assertIn("C:/private/do-not-open.json", rendered)


if __name__ == "__main__":
    unittest.main()
