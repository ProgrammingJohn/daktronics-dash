from __future__ import annotations

import unittest

from services.sport_parsers import SportParsers


class SportParsersTests(unittest.TestCase):
    def setUp(self) -> None:
        self.parsers = SportParsers()

    def test_parse_basketball_legacy_string(self) -> None:
        raw = "12:34HOME      GUEST     1054075312"
        parsed = self.parsers.parse("basketball", raw)
        self.assertEqual(parsed["sport"], "basketball")
        self.assertEqual(parsed["clock"]["minutes"], "12")
        self.assertEqual(parsed["clock"]["seconds"], "34")
        self.assertGreaterEqual(parsed["home_score"], 0)
        self.assertGreaterEqual(parsed["away_score"], 0)

    def test_parse_baseball_csv(self) -> None:
        raw = "3,4,6,bot,2,3,1,1,0,1"
        parsed = self.parsers.parse("baseball", raw)
        self.assertEqual(parsed["home_score"], 3)
        self.assertEqual(parsed["away_score"], 4)
        self.assertEqual(parsed["inning"], 6)
        self.assertEqual(parsed["inning_half"], "bot")
        self.assertTrue(parsed["base_one"])
        self.assertFalse(parsed["base_two"])
        self.assertTrue(parsed["base_three"])

    def test_parse_football_legacy_string(self) -> None:
        raw = "12:00HOME      GUEST     2233146311 >403330"
        parsed = self.parsers.parse("football", raw)
        self.assertEqual(parsed["sport"], "football")
        self.assertIn("clock", parsed)
        self.assertIn("home_possesion", parsed)
        self.assertIn(parsed["possession"], {"home", "away"})


if __name__ == "__main__":
    unittest.main()
