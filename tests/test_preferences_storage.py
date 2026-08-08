import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from services.utils import (
    get_scoreboard_preferences,
    scoreboard_preferences_path,
    write_scorebaord_preferences,
)
from services.service_service import load_scoreboard


class PreferencesStorageTests(unittest.TestCase):
    def test_frozen_runtime_reads_svg_from_pyinstaller_resource_root(self):
        with tempfile.TemporaryDirectory() as directory:
            resource_root = Path(directory)
            scoreboard_directory = resource_root / "scoreboard_svgs"
            scoreboard_directory.mkdir()
            (scoreboard_directory / "football.svg").write_text(
                "<svg>packaged-football</svg>", encoding="utf-8"
            )

            with patch.object(sys, "_MEIPASS", directory, create=True):
                self.assertEqual(
                    load_scoreboard("football"), "<svg>packaged-football</svg>"
                )

    def test_frozen_runtime_uses_bundled_preferences_as_defaults(self):
        with tempfile.TemporaryDirectory() as directory:
            resource_root = Path(directory)
            scoreboard_directory = resource_root / "scoreboard_svgs"
            scoreboard_directory.mkdir()
            expected_path = scoreboard_directory / "scoreboard_preferences.json"
            expected_path.write_text("{}", encoding="utf-8")

            with patch.dict(os.environ, {}, clear=True):
                with patch.object(sys, "_MEIPASS", directory, create=True):
                    self.assertEqual(scoreboard_preferences_path(), expected_path)

    def test_user_data_directory_is_initialized_from_bundled_defaults(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.dict(os.environ, {"DAKDASH_DATA_DIR": directory}):
                preferences = get_scoreboard_preferences()
                destination = Path(directory).resolve() / "scoreboard_preferences.json"

                self.assertTrue(destination.is_file())
                self.assertEqual(scoreboard_preferences_path(), destination)
                self.assertIn("football", preferences)

    def test_updates_are_persisted_outside_the_application_bundle(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.dict(os.environ, {"DAKDASH_DATA_DIR": directory}):
                preferences = get_scoreboard_preferences()
                preferences["football"]["home_team_name"] = "EAGLES"

                write_scorebaord_preferences(preferences)

                stored = json.loads(
                    (Path(directory) / "scoreboard_preferences.json").read_text(
                        encoding="utf-8"
                    )
                )
                self.assertEqual(stored["football"]["home_team_name"], "EAGLES")


if __name__ == "__main__":
    unittest.main()
