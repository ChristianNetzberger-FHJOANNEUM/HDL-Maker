"""Hierarchy checks for editable designs.

An instance may refer to another editable diagram by id. A reference that
reaches the diagram already being walked is a cycle. A missing id is reported
and is not replaced with a guessed interface.
"""

from __future__ import annotations

from collections.abc import Callable

from app.models.design import Diagnostic
from app.models.editable import EditableDiagram
from app.storage.diagram_store import DiagramStoreError


def hierarchy_checks(diagram: EditableDiagram, load: Callable[[str], EditableDiagram]) -> list[Diagnostic]:
    findings: list[Diagnostic] = []
    seen_messages: set[str] = set()

    def report(diagnostic: Diagnostic) -> None:
        if diagnostic.message in seen_messages:
            return
        seen_messages.add(diagnostic.message)
        findings.append(diagnostic)

    def walk(diagram_id: str, stack: list[str], via: str) -> None:
        if diagram_id in stack:
            report(
                Diagnostic(
                    severity="error",
                    code="recursive_hierarchy",
                    message=f"Instance '{via}' refers back to a design that is already above it in the hierarchy.",
                )
            )
            return
        if diagram_id == diagram.id:
            current = diagram
        else:
            try:
                current = load(diagram_id)
            except DiagramStoreError:
                report(
                    Diagnostic(
                        severity="info",
                        code="child_missing",
                        message=f"Instance '{via}' refers to diagram '{diagram_id}', which is not in the workspace.",
                    )
                )
                return
        stack.append(diagram_id)
        for instance in current.instances:
            if instance.child_diagram_id:
                walk(instance.child_diagram_id, stack, instance.name)
        stack.pop()

    for instance in diagram.instances:
        if instance.child_diagram_id:
            walk(instance.child_diagram_id, [diagram.id], instance.name)
    return findings
