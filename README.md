# CV Agent Starter (Step 1)

Features:
- Language selection (EN/FR/DE/NL) for preview & export
- PII masking toggles
- HTML preview and PDF export (Chromium/Playwright)
- Single CV JSON schema powering all templates

## Quickstart
1) Install Node.js (v18+ recommended)
2) Unzip this project
3) In the project folder:
   ```bash
   npm install
   npx playwright install chromium
   cp .env.example .env  # set your Azure Translator env vars
   npm run dev
   ```
4) Open http://localhost:3000 and click **Preview** then **Export PDF**.

Configure Azure Translator in `.env` to enable live translation.
