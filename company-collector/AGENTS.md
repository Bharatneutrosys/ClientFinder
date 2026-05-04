# Project Instructions

## Core Rules

- Use plain JavaScript only.
- Keep code modular and simple.
- Avoid TypeScript, Next.js, or larger framework migrations unless explicitly requested.
- Avoid large rewrites unless necessary.
- Prefer small, safe, incremental changes.

## Project Goal

- Main goal: collect USA IT staffing and consulting company data.
- The collector is the core data engine for the project.

## Current Architecture

- The collector writes `companies.json` and `companies.csv`.
- The viewer reads `companies.json`.
- The Express backend handles website scanning to avoid browser CORS issues.
- Website scanning should extract public emails and phone numbers first.
- Keep the mock scanner as a fallback path.

## Scope Guardrails

- Do not add OpenAI or AI model integration unless explicitly requested.
- Do not add TypeScript or Next.js unless explicitly requested.
- Keep the codebase easy to maintain and extend.
