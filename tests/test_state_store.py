from __future__ import annotations

import unittest

from services.state_store import StateStore


class StateStoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.store = StateStore()
        self.store.initialize_session("football", "live", esp_ip="127.0.0.1", esp_port=1234)

    def test_live_updates_drive_active_state_in_live_mode(self) -> None:
        status, state = self.store.apply_live_update(
            {
                "sport": "football",
                "home_score": 7,
                "away_score": 3,
            },
            raw_source_data="raw",
            protocol_mode="legacy",
        )
        self.assertEqual(status, "ok")
        self.assertEqual(state["home_score"], 7)
        self.assertEqual(state["source"], "esp32")

    def test_live_updates_are_stored_when_manual_mode_is_enabled(self) -> None:
        self.store.set_control_mode("manual")
        manual_before = self.store.get_state()["home_score"]

        status, state = self.store.apply_live_update(
            {
                "sport": "football",
                "home_score": 99,
            },
            raw_source_data="raw",
            protocol_mode="legacy",
        )

        self.assertEqual(status, "stored")
        self.assertEqual(state["home_score"], manual_before)
        self.assertEqual(self.store.get_live_state()["home_score"], 99)

    def test_manual_updates_blocked_while_live_mode(self) -> None:
        with self.assertRaises(RuntimeError):
            self.store.apply_manual_update({"home_score": 1})


if __name__ == "__main__":
    unittest.main()
