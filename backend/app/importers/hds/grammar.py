"""Parser for the HDL Designer textual diagram envelope.

The files examined in ``libs/sbus_rtc_lib`` are nested records of the form
``(TypeName key value ...)``, with ``*N`` object labels and ``&N`` references.
This parser keeps every field. It does not guess the meaning of a record.
"""

from __future__ import annotations

from dataclasses import dataclass, field


class HdsSyntaxError(Exception):
    def __init__(self, message: str, line: int) -> None:
        self.line = line
        super().__init__(f"line {line}: {message}")


@dataclass
class Atom:
    text: str
    line: int


@dataclass
class Ref:
    target: int
    line: int


@dataclass
class Array:
    items: list[Node]
    line: int


@dataclass
class Record:
    type_name: str
    fields: list[tuple[str, Node]] = field(default_factory=list)
    object_id: int | None = None
    line: int = 1

    def first(self, key: str) -> Node | None:
        for name, value in self.fields:
            if name == key:
                return value
        return None

    def all(self, key: str) -> list[Node]:
        return [value for name, value in self.fields if name == key]


Node = Atom | Ref | Array | Record


@dataclass
class Document:
    fields: list[tuple[str, Node]]
    objects: dict[int, Record]

    def first(self, key: str) -> Node | None:
        for name, value in self.fields:
            if name == key:
                return value
        return None


def parse_document(text: str) -> Document:
    tokens = _tokenize(text)
    parser = _Parser(tokens)
    fields: list[tuple[str, Node]] = []
    while not parser.done():
        fields.append(parser.field())
    return Document(fields=fields, objects=parser.objects)


def walk(node: Node):
    if isinstance(node, Record):
        yield node
        for _, value in node.fields:
            yield from walk(value)
    elif isinstance(node, Array):
        for item in node.items:
            yield from walk(item)


def atom_text(node: Node | None) -> str | None:
    if isinstance(node, Atom):
        return node.text
    return None


class _Parser:
    def __init__(self, tokens: list[tuple[str, str, int]]) -> None:
        self.tokens = tokens
        self.index = 0
        self.objects: dict[int, Record] = {}

    def done(self) -> bool:
        return self.index >= len(self.tokens)

    def field(self) -> tuple[str, Node]:
        token = self._peek()
        if token[0] != "atom":
            raise HdsSyntaxError(f"expected a field name, found {token[0]}", token[2])
        self.index += 1
        return token[1], self.value()

    def value(self) -> Node:
        kind, text, line = self._peek()
        if kind == "str" or kind == "atom":
            self.index += 1
            return Atom(text, line)
        if kind == "ref":
            self.index += 1
            return Ref(int(text), line)
        if kind == "obj":
            self.index += 1
            record = self.record()
            record.object_id = int(text)
            self.objects[record.object_id] = record
            return record
        if kind == "(":
            return self.record()
        if kind == "[":
            return self.array()
        raise HdsSyntaxError(f"unexpected {kind}", line)

    def record(self) -> Record:
        kind, _, line = self._peek()
        if kind != "(":
            raise HdsSyntaxError("expected '('", line)
        self.index += 1
        name_kind, name, name_line = self._peek()
        if name_kind != "atom":
            raise HdsSyntaxError("expected a record type", name_line)
        self.index += 1
        fields: list[tuple[str, Node]] = []
        while True:
            if self.done():
                raise HdsSyntaxError(f"record {name} is not closed", name_line)
            current = self._peek()
            if current[0] == ")":
                self.index += 1
                break
            fields.append(self.field())
        return Record(type_name=name, fields=fields, line=name_line)

    def array(self) -> Array:
        kind, _, line = self._peek()
        if kind != "[":
            raise HdsSyntaxError("expected '['", line)
        self.index += 1
        items: list[Node] = []
        while True:
            if self.done():
                raise HdsSyntaxError("array is not closed", line)
            if self._peek()[0] == "]":
                self.index += 1
                break
            items.append(self.value())
        return Array(items, line)

    def _peek(self) -> tuple[str, str, int]:
        if self.done():
            raise HdsSyntaxError("unexpected end of file", self.tokens[-1][2] if self.tokens else 1)
        return self.tokens[self.index]


def _tokenize(text: str) -> list[tuple[str, str, int]]:
    tokens: list[tuple[str, str, int]] = []
    index = 0
    line = 1
    length = len(text)
    while index < length:
        char = text[index]
        if char == "\n":
            line += 1
            index += 1
            continue
        if char.isspace():
            index += 1
            continue
        if char == '"':
            index += 1
            buf: list[str] = []
            while index < length:
                if text[index] == "\\" and index + 1 < length:
                    buf.append(text[index + 1])
                    if text[index + 1] == "\n":
                        line += 1
                    index += 2
                    continue
                if text[index] == '"':
                    index += 1
                    break
                if text[index] == "\n":
                    line += 1
                buf.append(text[index])
                index += 1
            tokens.append(("str", "".join(buf), line))
            continue
        if char in "()[]":
            tokens.append((char, char, line))
            index += 1
            continue
        if char in "*&" and index + 1 < length and text[index + 1].isdigit():
            end = index + 1
            while end < length and text[end].isdigit():
                end += 1
            kind = "obj" if char == "*" else "ref"
            tokens.append((kind, text[index + 1 : end], line))
            index = end
            continue
        end = index
        while end < length and not text[end].isspace() and text[end] not in "()[]\"":
            end += 1
        tokens.append(("atom", text[index:end], line))
        index = end
    return tokens
