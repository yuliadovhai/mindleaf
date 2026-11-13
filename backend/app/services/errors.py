"""Domain errors raised by services; app.main maps them to HTTP responses."""


class NotFound(Exception):
    """The record does not exist or belongs to another tutor (same answer)."""


class StudentNotFound(Exception):
    """A request body references a student that is missing or not the tutor's."""


class StudentArchived(Exception):
    """A new lesson cannot be scheduled for an archived student."""
