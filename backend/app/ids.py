"""Stable ids derived from library identity and HDL names."""

from __future__ import annotations

import hashlib


def stable_id(prefix: str, *parts: str) -> str:
    digest = hashlib.sha256("\n".join(parts).encode("utf-8")).hexdigest()[:16]
    return f"{prefix}_{digest}"
