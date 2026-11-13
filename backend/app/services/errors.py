"""Domain errors raised by services; app.main maps them to HTTP responses."""


class NotFound(Exception):
    """The record does not exist or is not visible to the caller (same answer).

    The detail defaults to "not found"; a few endpoints use a specific code.
    """

    def __init__(self, code: str = "not found") -> None:
        super().__init__(code)
        self.code = code


class StudentNotFound(Exception):
    """A request body references a student that is missing or not the tutor's."""


class StudentArchived(Exception):
    """A new lesson cannot be scheduled for an archived student."""


class Forbidden(Exception):
    """The caller's role may not do this (403)."""


class Conflict(Exception):
    """A business rule forbids the change (409 with a machine-readable code)."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code
