from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Dict, Iterable, Optional

from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename

from services.config import BackendConfig

_TEXT_BY_ID_RE = r'(<[^>]*\bid="{key}"[^>]*>)(.*?)(</[^>]+>)'
_CSS_VAR_RE = r'(--{key}\s*:\s*)([^;]+)(;)'


class SvgTemplateService:
    """Manage SVG template storage and render-time substitution."""

    def __init__(self, config: BackendConfig) -> None:
        self._config = config
        self._svg_dir = config.svg_path
        self._svg_dir.mkdir(parents=True, exist_ok=True)

    def list_templates(self) -> list[str]:
        return sorted(path.name for path in self._svg_dir.glob("*.svg") if path.is_file())

    def get_template_path(self, name: str) -> Path:
        filename = secure_filename(name)
        if not filename.lower().endswith(".svg"):
            filename = f"{filename}.svg"
        return self._svg_dir / filename

    def load_template(self, name: str) -> Optional[str]:
        path = self.get_template_path(name)
        if not path.exists():
            return None
        return path.read_text(encoding="utf-8")

    def save_upload(self, upload: FileStorage) -> str:
        if not upload or not upload.filename:
            raise ValueError("missing SVG file")

        filename = secure_filename(upload.filename)
        if not filename.lower().endswith(".svg"):
            raise ValueError("file extension must be .svg")

        data = upload.read()
        if not data:
            raise ValueError("empty upload")
        if len(data) > self._config.max_svg_upload_bytes:
            raise ValueError("file is too large")

        text = data.decode("utf-8", errors="ignore")
        self._validate_svg(text)

        path = self._svg_dir / filename
        path.write_text(text, encoding="utf-8")
        return filename

    def render(
        self,
        name: str,
        *,
        values: Optional[Dict[str, Any]] = None,
        css_vars: Optional[Dict[str, Any]] = None,
    ) -> str:
        template = self.load_template(name)
        if template is None:
            raise FileNotFoundError(name)

        rendered = template
        values = values or {}
        css_vars = css_vars or {}

        rendered = self._apply_placeholders(rendered, values)
        rendered = self._apply_text_by_id(rendered, values)
        rendered = self._apply_css_vars(rendered, css_vars)
        return rendered

    def _apply_placeholders(self, svg: str, values: Dict[str, Any]) -> str:
        result = svg
        for key, value in values.items():
            token = "{{" + str(key) + "}}"
            result = result.replace(token, str(value))
        return result

    def _apply_text_by_id(self, svg: str, values: Dict[str, Any]) -> str:
        result = svg
        for key, value in values.items():
            replacement = str(value)
            pattern = re.compile(_TEXT_BY_ID_RE.format(key=re.escape(str(key))), re.IGNORECASE | re.DOTALL)
            result = pattern.sub(lambda match: f"{match.group(1)}{replacement}{match.group(3)}", result)
        return result

    def _apply_css_vars(self, svg: str, css_vars: Dict[str, Any]) -> str:
        result = svg
        for key, value in css_vars.items():
            replacement = str(value)
            pattern = re.compile(_CSS_VAR_RE.format(key=re.escape(str(key))), re.IGNORECASE)
            result = pattern.sub(lambda match: f"{match.group(1)}{replacement}{match.group(3)}", result)
        return result

    def _validate_svg(self, text: str) -> None:
        if "<script" in text.lower():
            raise ValueError("script tags are not allowed in uploaded SVG files")
        try:
            ET.fromstring(text)
        except ET.ParseError as exc:
            raise ValueError("invalid SVG XML") from exc

    def template_exists(self, name: str) -> bool:
        return self.get_template_path(name).exists()

    def iter_template_files(self) -> Iterable[Path]:
        return self._svg_dir.glob("*.svg")
