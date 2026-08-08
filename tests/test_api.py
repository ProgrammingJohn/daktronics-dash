import unittest
from unittest import mock

from main import app
from services.runtime import runtime


class ApiTests(unittest.TestCase):
    def setUp(self):
        runtime.stop()
        self.client = app.test_client()

    def tearDown(self):
        runtime.stop()

    def test_status_has_stable_connection_shape(self):
        response = self.client.get("/api/scoreboard-service/status")
        self.assertEqual(response.status_code, 200)
        required = {"status", "transport", "source", "revision", "source_age_ms"}
        self.assertLessEqual(required, set(response.get_json()))
        discovery = response.get_json()["discovery"]
        self.assertEqual(
            set(discovery),
            {"phase", "active", "attempts", "method",
             "requested_host", "resolved_host"},
        )

    def test_score_without_service_is_explicit(self):
        response = self.client.get("/api/scoreboard-service/get-score")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.get_json()["error"], "Scoreboard service is not running")

    def test_manual_service_updates_flat_score(self):
        started = self.client.post(
            "/api/scoreboard-service/start",
            json={"scoreboard": "football", "method": "manual"},
        )
        self.assertEqual(started.status_code, 200)
        updated = self.client.post(
            "/api/scoreboard-service/update-score",
            json={"score": {"home_score": 7, "away_score": 3}},
        )
        self.assertEqual(updated.status_code, 200)
        response = self.client.get("/api/scoreboard-service/get-score")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"home_score": 7, "away_score": 3})

    @mock.patch.object(runtime, "start_manual", return_value=False)
    def test_manual_start_reports_failed_replacement(self, start_manual):
        response = self.client.post(
            "/api/scoreboard-service/start",
            json={"scoreboard": "football", "method": "manual"},
        )
        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.get_json()["error"],
            "Previous scoreboard service did not stop",
        )

    def test_synced_start_requires_device_identity(self):
        response = self.client.post(
            "/api/scoreboard-service/start",
            json={
                "scoreboard": "football",
                "method": "synced",
                "ip": "10.93.37.138",
                "port": 1234,
            },
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["error"], "Device ID is required")

    @mock.patch.object(runtime, "start_synced", return_value=True)
    def test_synced_start_without_ip_uses_discovery(self, start_synced):
        response = self.client.post(
            "/api/scoreboard-service/start",
            json={
                "scoreboard": "football",
                "method": "synced",
                "port": 1234,
                "device_id": "wt32-aabbccddeeff",
            },
        )
        self.assertEqual(response.status_code, 200)
        start_synced.assert_called_once_with(
            "football", None, 1234, "wt32-aabbccddeeff"
        )

    def test_synced_start_rejects_invalid_port(self):
        for port in ("not-a-port", 0, 70000):
            with self.subTest(port=port):
                response = self.client.post(
                    "/api/scoreboard-service/start",
                    json={
                        "scoreboard": "football",
                        "method": "synced",
                        "ip": "10.93.37.138",
                        "port": port,
                        "device_id": "wt32-aabbccddeeff",
                    },
                )
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.get_json()["error"], "Valid port is required")


if __name__ == "__main__":
    unittest.main()
