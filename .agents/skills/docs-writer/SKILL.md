---
name: docs-writer
description: Use this skill for writing, reviewing, and editing documentation for the Rez trading agent project. Covers API docs, architecture, README, and code comments.
user-invocable: true
---

# `docs-writer` skill instructions

As an expert technical writer for the Rez autonomous trading system, your goal
is to produce documentation that is accurate, clear, and helpful for developers
and users. Rez is an AI-powered trading agent for the Hyperliquid exchange.

## Project Structure

- `src/` - Python backend
  - `src/server.py` - FastAPI server with REST endpoints
  - `src/agent/` - Trading agent logic and decision making
  - `src/trading/` - Hyperliquid API integration
- `frontend/` - Next.js dashboard
  - `frontend/app/` - Next.js app router pages and API routes
  - `frontend/components/` - React components
  - `frontend/lib/` - Utilities and helpers
- `docs/` - Architecture and technical documentation
- `README.md` - Project overview

## Step 1: Understand the goal and create a plan

1. **Clarify the request:** Understand what documentation is needed.
   - API endpoint documentation?
   - Architecture explanation?
   - User guide for the dashboard?
   - Code comments or docstrings?

2. **Differentiate the task:** Determine if writing new content or editing existing.

3. **Formulate a plan:** Create a step-by-step plan for the documentation.

## Step 2: Investigate and gather information

1. **Read the code:** Examine the relevant source files to ensure accuracy.
   - For backend APIs: Read `src/server.py` for endpoint definitions
   - For trading logic: Read `src/agent/` and `src/trading/`
   - For frontend: Read `frontend/app/` and `frontend/components/`

2. **Identify files:** Locate existing documentation that needs updates.
   - `README.md` - Main project overview
   - `docs/ARCHITECTURE.md` - System architecture
   - Inline docstrings in Python files

3. **Check dependencies:** If documenting an endpoint, trace its full flow
   from frontend API route to backend handler.

## Step 3: Write or edit the documentation

### Style Guidelines

- **Be concise:** Developers prefer brief, scannable docs
- **Use examples:** Show actual API requests/responses or code snippets
- **Stay accurate:** Always verify against the actual code implementation
- **Use proper formatting:**
  - Markdown headers for sections
  - Code blocks with language hints (```python, ```typescript)
  - Tables for API parameters

### For API Documentation

Include for each endpoint:
- HTTP method and path
- Request body schema (with types)
- Response format
- Example request/response
- Error cases

### For Architecture Documentation

- Explain the "why" not just the "what"
- Include data flow diagrams when helpful
- Document key design decisions

### For Code Docstrings

Follow existing patterns:
- Python: Google-style docstrings
- TypeScript: JSDoc comments

## Step 4: Verify and finalize

1. **Review accuracy:** Re-read source code to verify documentation matches
2. **Check links:** Ensure any file references or links are valid
3. **Test examples:** If documenting APIs, verify examples actually work
