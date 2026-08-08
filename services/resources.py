from pathlib import Path
import sys


def application_resource_path(*parts: str) -> Path:
    packaged_root = getattr(sys, "_MEIPASS", None)
    if packaged_root is not None:
        return Path(packaged_root).joinpath(*parts)
    return Path(__file__).resolve().parent.parent.joinpath(*parts)
