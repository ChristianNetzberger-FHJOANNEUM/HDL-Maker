"""Errors the importer can explain to a caller without a traceback."""


class ScanError(Exception):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)
