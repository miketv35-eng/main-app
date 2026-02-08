# System Architecture SOP (Layer 1)

## Overview
This document defines the technical Standard Operating Procedures (SOPs) for the Shift Management System (Magor Logistics).

## Goals
- Provide a robust, mobile-friendly shift management interface.
- Integrate SKAP training tracking, rota generation, and PDF parsing.
- Ensure data consistency via Supabase.

## Architecture Layers

### Layer 1: Architecture (This Document)
- **Role**: Define invariants, data flows, and "How-To" logic.
- **Rule**: If logic changes, update this document first.

### Layer 2: Navigation (Decision Logic)
- **Role**: The AI Agent (you) acting as the router.
- **Logic**:
    1.  Receive User Request.
    2.  Consult `gemini.md` for schemas/rules.
    3.  Consult `architecture/` SOPs for "How-To".
    4.  Execute Tools in `tools/` or modify Code in `src/`.

### Layer 3: Tools (Execution)
- **Role**: Deterministic scripts for verify, build, and deploy.
- **Location**: `tools/`
- **Constraint**: Must use `.env` for secrets.

## Core Workflows

### 1. Data Access
- **Read**: Use `supabase.from('app_data').select(...)` or the helper `sGet` in `src/App.jsx`.
- **Write**: Use `supabase.from('app_data').upsert(...)` or the helper `sSet` in `src/App.jsx`.
- **Invariant**: All shared state (rota, machine status) must be persisted to Supabase, not just LocalStorage.

### 2. AI Integration
- **Endpoint**: `api/claude.js` (Vercel Serverless Function).
- **Client**: `src/App.jsx` calls `/api/claude`.
- **Auth**: Server-side using `process.env.ANTHROPIC_API_KEY`.

### 3. Frontend Development
- **Stack**: React + Vite.
- **Styling**: Inline styles (current) or CSS modules. *Constraint: Maintain specialized styling helper `S` object pattern unless refactoring entire UI.*
- **Mobile**: Ensure touch targets are accessible (min 44px) and layouts stack on small screens.
