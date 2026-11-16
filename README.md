# Mortgage Money Map

An interactive, plain-English map of the **US secondary mortgage market**: who pays whom, who owns what, and who takes which risk. Built for complete beginners.

**Live:** https://jclekkas.github.io/mortgage-money-map/

## What's inside

1. **Money map (follow the money):** 43 clickable players in six lanes (making loans, plumbing & insurers, guarantors & issuers, the securities, trading & settlement, investors) with about 80 animated money and paper flows.
   - **Views:** Everything, Agency, Non-agency (private-label), Credit risk transfer (CRT), Servicing.
   - **Overlays:** Money flows, Who owns what, Who takes which risk (credit, prepayment, interest rate, liquidity).
   - **2008 then vs now** switch that marks what broke and what changed.
2. **Ownership tracker:** a persistent "Owns the loan now / Owns the bond now" bar in the top bar, plus a step-through timeline for each route: Fannie Mae swap, cash window, Ginnie Mae, private-label, CRT and servicing rights. The legend separates owns the loan / owns the security / owns only the risk / owns servicing rights / handles cash for a fee. The current loan owner glows on the map.
3. **Who owns it?** A timeline and an ownership ledger comparing the loan with the bond, step by step.
4. **Follow one payment:** an animated split of a monthly payment into principal, investor coupon, servicing fee, g-fee, mortgage insurance and escrow, with conventional (Fannie Mae) and FHA (Ginnie Mae) examples and a month slider.
5. **Who takes which risk:** a risk matrix with explanations.
6. **2008: then vs now:** what broke, plus the rule changes (HERA, conservatorship, Dodd-Frank, CFPB, QM/ATR, risk retention, CRT, UMBS).
7. **Glossary** (55 terms, searchable) and a **10-question quiz**.
8. **Replayable guided tour** (Replay tour button or `G`), light and dark themes, and a mobile layout.

Style: the official term comes first, with the everyday analogy in parentheses, e.g. "Guarantee fee, g-fee (insurance premium)". Every firm is followed by its role, e.g. "Fannie Mae (the agency guarantor)".

## Disclaimer

This is an educational tool. Real company names appear only to show which kinds of firms play each role. No affiliation, endorsement or inside knowledge is implied. Market-size figures are rounded public figures marked "approx."; other dollar amounts are illustrative examples. Nothing here describes any firm's actual terms, results or conduct, and nothing here is investment advice.

## Develop

```bash
npm ci
npm run dev      # local dev server
npm run build    # type-check + build; dist/index.html is a single self-contained file (works offline / from file://)
node smoke.mjs   # headless checks at 1440x900 and 390x844 (needs Chrome at /usr/bin/google-chrome)
```

Stack: Vite + React 18 + TypeScript, no runtime dependencies beyond React, and system fonts only. It deploys to GitHub Pages through `.github/workflows/deploy.yml`.

## Arrows and the warehouse loop

- With nothing selected, the map shows only the current ownership step's flows. Click a box to see only that player's flows; unrelated boxes dim. Arrows run in channels between the lanes so they never cross a box. Colors: money green, paper blue, fees amber, risk purple, rules and records dashed gray. A label that doesn't fit appears when you hover its arrow.
- Warehouse lines (the lender's credit line) are a first-class flow. Banks such as JPMorgan Chase, Wells Fargo, Citi, Texas Capital and Customers Bank (the warehouse lenders) fund the closing. The loan is pledged and the document custodian holds the note, then the loan is sold and the proceeds repay the line. Approx. figures: 95–98% advance rate, 2–4 weeks on the line, SOFR + 1.5–2.5%. The map also covers MSR financing lines, gestation repo, and Fannie Mae and Freddie Mac early funding.
- The new ownership role, "Holds as collateral (C)", means a security interest, not ownership.

## Credit checks and refresh opportunities

- **Credit refreshes overlay** (Money map → Overlay): every player that holds or carries risk on an existing loan gets a refresh gauge. The filled dot shows how often borrowers' credit is checked today and the hollow ring shows how often it plausibly could be. The orange glow and the "+$…/yr est." figure show the yearly whitespace (files × price × extra refreshes per year). Markers show where pulls happen: H = hard pull, S = soft pull, D = depersonalized data, $ = paid for pulls (Equifax, Experian and TransUnion, the credit bureaus; FICO and VantageScore, the score makers). Clicking a box or marker opens a card that covers who pulls, why, the pull type, the FCRA permissible purpose, refresh today vs plausible, TAM/SAM/realistic, and whether inputs are sourced or estimated.
- **Below the map:** a ranked "Top refresh opportunities" list (click to highlight the player) and a loan-life strip (application → closing → sale → years 1–30). Filled dots are checks that happen today; hollow dots are refreshes that could happen.
- **Credit checks page:** all 26 use cases, TAM/SAM/realistic by segment, and assumption sliders that recompute every figure. It links to the full report: https://cursor.com/canvas/store-6237da13-0cef-430b-bfed-4e9101656458/721375f6-2a13-4298-bf1f-a42ab2c5cbdf
- All frequencies and dollars are estimates built on sourced inputs, except where marked sourced (for example, Fannie Mae has published monthly refreshed scores on CAS deals since 2016). Legal notes are a plain reading of FCRA §604, not legal advice.

## Filter lines

- On the Money map, **Filter lines** opens a panel: inline on desktop, a bottom sheet on mobile. In it you can:
  1. Toggle line types with counts: money, paper, fees, risk, rules/records, credit pull fees, warehouse.
  2. Pick players, with an option to show only lines between the selected players.
  3. Search a checklist of every line ("From → To: what"), grouped by lane and player, with Select all, Clear all and **Only this**.
- "Showing N of M lines" and Reset are always visible. Filters combine with the views, the overlays and click-a-box.
- Click any arrow to get **Show only this line** or **Hide this line**.
- With 10 or fewer lines shown, every line gets a label and appears in a "Lines shown" list.
- The URL hash saves the view, overlay, selected player and line filter, so a filtered map can be shared as a link.

## Play a role

Page 7, **Play a role**, turns the map into seven short games. Each runs 5 to 8 quarters (3-month turns). You can also open a game from a player card on the map with **Play this role**:

| Role | Map box | Quarters | Your main levers | Shocks |
|---|---|---|---|---|
| Servicer (payment collector) | Servicers | 8 | portfolio credit refresh, refi outreach, advance funding, sell MSRs, rate hedge | rates drop, rates spike, delinquency rise, forbearance wave |
| Private mortgage insurer, PMI (first-loss insurer) | Mortgage insurers | 8 | premium price, FICO and LTV limits, quota share or insurance-linked notes, refresh | home prices fall, unemployment spike |
| CRT investor (buyer of credit risk bonds) | CAS & STACR notes | 6 | tranche (M1 to B2), bid, refreshed loan data, hold, trim, sell or add | home prices -10% or -20%, risk-off spread widening |
| Whole loan trader | Dealers | 5 | bid, diligence depth, credit refresh, flip or securitize | rates up or down, diligence findings, spread widening |
| Warehouse lender (bank lending to lenders) | Warehouse lenders | 6 | which clients to fund, advance rate, spread, covenants, aging limits, margin calls, collateral refresh | client volume collapse, stuck loans, a run on a client |
| Warehouse line analyst at a large lender | Rocket Mortgage / UWM | 7 | split across three bank lines, early funding or gestation repo, cash cushion, pipeline hedge, pre-close refresh | a bank cuts its line, rates up (lock losses), rates down (fallout) |
| Aggregator buying or selling MSRs | PennyMac / MSR investors | 7 | bid on a $20B MSR package, sell 20%, refresh the package, MSR line leverage, hedge | rates fall 1%, rates rise 1%, delinquency spike |

Each game has:
- a plain-English intro covering the job, who you work with, how you get paid and how you win, plus key terms you can tap;
- decisions with "?" explanations;
- a live dashboard showing P&L by quarter, where the money came from, and risk readings that turn green, amber or red;
- a mini map highlighting your box;
- a scorecard with a grade, your choices next to what a pro would choose, the pro playbook and lessons.

When your credit refresh is switched on, you get early warning before credit shocks. The scorecard links each role back to the refresh opportunity sizing on the Credit checks page.

The scenario options are random shocks, a calm market, or one chosen shock in quarter 3. A seed makes every game replayable: the same seed and the same choices always give the same result, on any device. The URL hash remembers the open role (`r=`).

All game figures are **mock and illustrative**, not any firm's terms, prices or results. Named firms appear only as examples of a role. The game engine is in `src/roles.ts` and the page is `src/rolePage.tsx`.

