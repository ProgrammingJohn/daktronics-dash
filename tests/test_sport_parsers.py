import unittest

from services.sport_parsers import FrameParseError, parse_scoreboard_frame


class SportParserTests(unittest.TestCase):
    def test_football_uses_numeric_types_and_ui_compatible_keys(self):
        score = parse_scoreboard_frame(
            "football", b"12:00HOME      GUEST     2233146311<>403339"
        )
        self.assertEqual(score["clock"], {"minutes": 12, "seconds": 0})
        self.assertEqual(score["home_score"], 22)
        self.assertEqual(score["away_score"], 33)
        self.assertEqual(score["yards_to_go"], 11)
        self.assertIs(score["home_possesion"], True)

    def test_basketball_frame(self):
        chars = list(" " * 29)
        chars[0:5] = "12:00"
        chars[12:15] = " 22"
        chars[15:18] = " 33"
        chars[18:20] = " 5"
        chars[20:22] = " 4"
        chars[24] = "3"
        chars[27] = "2"
        chars[28] = "1"
        score = parse_scoreboard_frame("basketball", "".join(chars).encode())
        self.assertEqual(score["clock"], {"minutes": 12, "seconds": 0})
        self.assertEqual((score["home_score"], score["away_score"]), (22, 33))
        self.assertIs(score["away_bonus"], True)

    def test_baseball_frame(self):
        score = parse_scoreboard_frame("baseball", b"4,3,7,top,2,1,1,1,0,1")
        self.assertEqual(score["inning_text"], "top 7")
        self.assertEqual(score["strikes_and_balls"], "1 - 2")
        self.assertEqual(
            (score["base_one"], score["base_two"], score["base_three"]),
            (True, False, True),
        )

    def test_truncated_frame_is_rejected(self):
        with self.assertRaises(FrameParseError):
            parse_scoreboard_frame("basketball", b"12:00")
