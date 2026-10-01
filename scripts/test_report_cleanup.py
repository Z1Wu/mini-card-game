import unittest
import io
import json
from unittest.mock import patch
from urllib.error import HTTPError
from importlib.util import spec_from_file_location, module_from_spec
from pathlib import Path
spec = spec_from_file_location("cleanup", Path(__file__).with_name("filter-report-cleanup.py"))
cleanup = module_from_spec(spec)
spec.loader.exec_module(cleanup)
deletion_candidates = cleanup.deletion_candidates


class ReportRetentionTests(unittest.TestCase):
    def test_protects_open_pr_desktop_and_mobile(self):
        names = ["pr-144-36832703742", "pr-144-36832703742-mobile", "pr-142-123"]
        self.assertEqual(list(deletion_candidates(names, [{"number": 144}])), ["pr-142-123"])

    def test_closed_pr_reports_can_be_cleaned(self):
        self.assertEqual(list(deletion_candidates(["pr-144-123\n"], [])), ["pr-144-123"])

    def test_ignores_unexpected_and_unsafe_paths(self):
        self.assertEqual(list(deletion_candidates(["../pr-144-123", "pr-14-123", "other"], [{"number": 14}])), [])

    def test_invalid_api_data_fails_closed(self):
        with self.assertRaises((KeyError, TypeError)):
            list(deletion_candidates(["pr-144-123"], [{}]))


    def test_api_pagination_without_gh_cli(self):
        batches = [[{"number": n} for n in range(1, 101)], [{"number": 144}]]
        with patch.object(cleanup, "urlopen", side_effect=[
            io.BytesIO(json.dumps(batch).encode()) for batch in batches
        ]) as fetch:
            result = cleanup.fetch_open_prs("Z1Wu/mini-card-game", "test-token")
        self.assertEqual(len(result), 101)
        self.assertEqual(result[-1], {"number": 144})
        self.assertIn("page=2", fetch.call_args[0][0].full_url)

    def test_api_failure_propagates_before_cleanup(self):
        with patch.object(cleanup, "urlopen", side_effect=HTTPError("url", 403, "Forbidden", {}, None)):
            with self.assertRaises(HTTPError):
                cleanup.fetch_open_prs("Z1Wu/mini-card-game", "test-token")


if __name__ == "__main__":
    unittest.main()
