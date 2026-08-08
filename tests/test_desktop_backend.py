import tempfile
import unittest
from pathlib import Path


class DesktopBackendTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.dist_path = Path(self.temporary_directory.name)
        (self.dist_path / "assets").mkdir()
        (self.dist_path / "index.html").write_text(
            '<main id="operator">DakDash operator</main>', encoding="utf-8"
        )
        (self.dist_path / "viewer.html").write_text(
            '<main id="viewer">DakDash viewer</main>', encoding="utf-8"
        )
        (self.dist_path / "assets" / "operator.js").write_text(
            "window.dakdash = true;", encoding="utf-8"
        )

    def tearDown(self):
        self.temporary_directory.cleanup()

    def test_serves_operator_viewer_and_built_assets(self):
        from desktop_backend import create_desktop_app

        client = create_desktop_app(self.dist_path).test_client()

        operator_response = client.get("/")
        viewer_response = client.get("/viewer.html")
        asset_response = client.get("/assets/operator.js")

        self.assertEqual(operator_response.status_code, 200)
        self.assertIn(b'DakDash operator', operator_response.data)
        self.assertEqual(viewer_response.status_code, 200)
        self.assertIn(b'DakDash viewer', viewer_response.data)
        self.assertEqual(asset_response.status_code, 200)
        self.assertEqual(asset_response.data, b"window.dakdash = true;")
        operator_response.close()
        viewer_response.close()
        asset_response.close()

    def test_registers_existing_scoreboard_api(self):
        from desktop_backend import create_desktop_app

        response = create_desktop_app(self.dist_path).test_client().get(
            "/api/scoreboard-service/status"
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("status", response.get_json())


if __name__ == "__main__":
    unittest.main()
