# Shift Rotar — Magor Brewery Logistics 

Shift management tool for FLMs at Magor Brewery (AB InBev / Budweiser Brewing Group).

## Features
- 4x4 Continental shift rota generation with operator availability
- 131-task SKAP training tracker
- TMS loading data upload and analysis
- Production line plan parsing (PDF upload via AI)
- Staffing plan integration (weekly XLSX)
- Shift handover system with AI-powered summaries
- Print-ready handover documents

## Tech Stack
- React 18 + Vite
- SheetJS (XLSX parsing)
- Anthropic Claude API (PDF parsing & AI summaries)
- localStorage (Supabase migration planned)

## Setup
```bash
npm install
npm run dev
```

## Deploy
Connected to Vercel for automatic deployment on push to main.
