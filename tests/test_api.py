from __future__ import annotations

import unittest

try:
    from main import create_app
except ModuleNotFoundError:
    create_app = None


@unittest.skipIf(create_app is None, "Flask is not installed in this environment")
class ApiTests(unittest.TestCase):
    def setUp(self) -> None:
        app = create_app()
        app.testing = True
        self.client = app.test_client()
        self.client.post("/api/session/stop")

    def tearDown(self) -> None:
        self.client.post("/api/session/stop")

    def test_health_endpoint(self) -> None:
        resp = self.client.get("/api/health")
        self.assertEqual(resp.status_code, 200)
        payload = resp.get_json()
        self.assertEqual(payload["data"]["status"], "ok")

    def test_legacy_manual_flow(self) -> None:
        start = self.client.post(
            "/api/scoreboard-service/start",
            json={"scoreboard": "football", "method": "manual"},
        )
        self.assertEqual(start.status_code, 200)

        update = self.client.post(
            "/api/scoreboard-service/update-score",
            json={
                "score": {
                    "home_score": 14,
                    "away_score": 7,
                    "clock": {"minutes": 2, "seconds": 10},
                    "down": 3,
                    "yards_to_go": 8,
                    "home_possesion": True,
                }
            },
        )
        self.assertEqual(update.status_code, 200)

        score = self.client.get("/api/scoreboard-service/get-score")
        self.assertEqual(score.status_code, 200)
        data = score.get_json()
        self.assertEqual(data["home_score"], 14)
        self.assertEqual(data["away_score"], 7)

    def test_new_manual_endpoint_conflict_in_live_mode(self) -> None:
        start = self.client.post(
            "/api/session/start",
            json={
                "sport": "basketball",
                "control_mode": "live",
                "esp_ip": "127.0.0.1",
                "esp_port": 65500,
            },
        )
        self.assertEqual(start.status_code, 200)

        update = self.client.post("/api/manual-update", json={"home_score": 1})
        self.assertEqual(update.status_code, 409)


if __name__ == "__main__":
    unittest.main()
