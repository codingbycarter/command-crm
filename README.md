# Command CRM — Wholesale Desk

The first arm of Command CRM: real estate wholesaling in South Jersey and Philadelphia, built around a private list of investors and buyers.

## What's here

| Path | What it is |
|---|---|
| `index.html` | **Public investor site.** Shows current deals and has the buyers-list sign-up form. |
| `app/` | **Private CRM.** Dashboard, deal pipeline (drag and drop), investors & buyers, seller leads, deal analyzer, buyer matching with deal-blast drafts, outreach templates, follow-ups, compliance checklists, and CSV/JSON import and export. |
| `assets/config.js` | **Your settings.** Business name, markets, license disclosure, contact email, form endpoint. |
| `deals.json` | Deals shown on the public site. Generate it from the CRM (Import / export → Download deals.json). |

Live site (after GitHub Pages is on): `https://codingbycarter.github.io/command-crm/`
CRM: `https://codingbycarter.github.io/command-crm/app/`

## How data works (important)

- CRM records are saved **in your browser** (localStorage). They are not in this repo and not on any server.
- Use **Import / export → Download full backup** regularly. Restore that file on another computer to pick up where you left off.
- The CRM page has `noindex`, so search engines won't list it, but anyone who has the link can open the page. They will only see an empty CRM, because your data stays in your own browser.

## Before you go live

1. Edit `assets/config.js`: business name, **license disclosure with your brokerage details**, contact email.
2. Get your broker's written OK to wholesale (PA Act 52 makes wholesaling licensed activity).
3. For Philadelphia properties: City Residential Property Wholesaler License (L&I).
4. For NJ properties: confirm with a NJ attorney. A PA license doesn't cover NJ.
5. To accept buyer sign-ups, create a free form endpoint (e.g. Formspree) and paste its URL into `formEndpoint`. Until then the form tells visitors it isn't open yet. It doesn't pretend to submit.
6. Replace the sample deal in `deals.json`.

## Editing

Every file is plain HTML/CSS/JavaScript with no build step. Edit any file on GitHub (pencil icon) → Commit, and the site updates in a minute or two.

## Roadmap

- Phase 2: Next.js + Supabase so data syncs across devices with a login.
- Apollo integration for investor sourcing, Gmail sending with approval, calendar sync.
- Add the AI front-desk agency pipeline as a second arm.
