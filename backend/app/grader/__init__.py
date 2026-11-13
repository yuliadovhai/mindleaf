"""The AI grader: a separate Lambda outside the VPC, built from the same image.

It never touches the database. Each run claims written quiz answers from the
API (/api/internal/grading, shared token), grades them with Claude Haiku 5.5 on
Amazon Bedrock, and posts the points back. Anything it cannot grade goes to the
tutor. Nothing here imports app.db, so the Lambda needs no DATABASE_URL.
"""
