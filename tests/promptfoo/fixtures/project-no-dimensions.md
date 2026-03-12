# Simulated Project Context: Python/FastAPI Project with No Review Dimensions

## Project Structure

Python FastAPI backend with SQLAlchemy ORM.

```
src/
  routes/         ← FastAPI route handlers
  models/         ← SQLAlchemy models
  migrations/     ← Alembic database migrations
  services/       ← Business logic
  tests/          ← pytest test files
requirements.txt
alembic.ini
```

## Key Dependencies (requirements.txt)

```
fastapi==0.104.1
sqlalchemy==2.0.23
alembic==1.12.1
pydantic==2.5.0
pytest==7.4.3
httpx==0.25.2
```

## Review Dimensions State

`.claude/review-dimensions/` directory does **not exist**.

No review dimensions have been installed for this project. Running `/review-init-sdlc`
would scan the project and propose dimensions based on the detected stack (FastAPI, SQLAlchemy,
Alembic migrations, pytest).

## review-prepare.js Output (JSON manifest)

```json
{
  "scope": "all",
  "baseBranch": "main",
  "changedFiles": [
    "src/routes/users.py",
    "src/models/user.py",
    "src/migrations/versions/abc123_add_user_table.py",
    "src/tests/test_users.py"
  ],
  "dimensions": [],
  "errors": [
    "No review dimensions found. Run /review-init-sdlc to create tailored dimensions for this project."
  ]
}
```
