from __future__ import annotations

import tempfile
import unittest
from io import BytesIO

try:
    from werkzeug.datastructures import FileStorage
    from services.config import BackendConfig
    from services.svg_templates import SvgTemplateService
except ModuleNotFoundError:
    FileStorage = None
    BackendConfig = None
    SvgTemplateService = None


@unittest.skipIf(FileStorage is None, "Werkzeug is not installed in this environment")
class SvgTemplateServiceTests(unittest.TestCase):
    def test_render_substitutes_placeholders_and_ids(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            config = BackendConfig(svg_dir=tmpdir)
            service = SvgTemplateService(config)

            template = (
                "<svg><style>:root{--home_team_light:#111;}</style>"
                "<text id=\"home_score\">0</text>"
                "<text id=\"away_score\">0</text>"
                "<text>{{period}}</text></svg>"
            )
            path = service.get_template_path("test.svg")
            path.write_text(template, encoding="utf-8")

            rendered = service.render(
                "test.svg",
                values={"home_score": 7, "away_score": 3, "period": "Q2"},
                css_vars={"home_team_light": "#abcdef"},
            )

            self.assertIn(">7<", rendered)
            self.assertIn(">3<", rendered)
            self.assertIn(">Q2<", rendered)
            self.assertIn("--home_team_light:#abcdef", rendered)

    def test_render_handles_two_digit_numeric_values(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            config = BackendConfig(svg_dir=tmpdir)
            service = SvgTemplateService(config)

            template = (
                "<svg><style>:root{--home_team_light:#111;}</style>"
                "<text id=\"home_score\">0</text>"
                "<text id=\"away_score\">0</text></svg>"
            )
            path = service.get_template_path("digits.svg")
            path.write_text(template, encoding="utf-8")

            rendered = service.render(
                "digits.svg",
                values={"home_score": 19, "away_score": 10},
                css_vars={"home_team_light": "#abcdef"},
            )

            self.assertIn(">19<", rendered)
            self.assertIn(">10<", rendered)
            self.assertIn("--home_team_light:#abcdef", rendered)

    def test_upload_validation_rejects_script(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            config = BackendConfig(svg_dir=tmpdir)
            service = SvgTemplateService(config)

            upload = FileStorage(
                stream=BytesIO(b"<svg><script>alert(1)</script></svg>"),
                filename="unsafe.svg",
                content_type="image/svg+xml",
            )

            with self.assertRaises(ValueError):
                service.save_upload(upload)


if __name__ == "__main__":
    unittest.main()
