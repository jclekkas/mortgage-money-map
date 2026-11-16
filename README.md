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

## DTCC: clearing, settlement and custody

DTCC, the Depository Trust & Clearing Corporation (the market's plumbing company), is now a full player with three arms on the map:

- **FICC MBS Division** (the agency MBS clearinghouse):
  - novation (it becomes buyer to every seller and seller to every buyer);
  - netting of TBA trades, four times a month;
  - margin and clearing fund deposits;
  - clearing fees;
  - EPN, Electronic Pool Notification (the 48-hour pool notice: sellers name the pools by 3 p.m. two business days before settlement).

  Settlement happens on Fedwire (delivery versus payment).
- **FICC Government Securities Division** (the Treasury and repo clearinghouse). The SEC's Treasury clearing mandate requires eligible cash trades to be centrally cleared by **Dec. 31, 2026** and eligible repo by **June 30, 2027** ([SEC](https://www.sec.gov/featured-topics/treasury-clearing-implementation)).
- **DTC** (the securities vault). It holds private-label RMBS and CAS and STACR notes in book-entry form, registered to **Cede & Co.** (DTC's nominee). Monthly principal and interest goes from the trustee or paying agent to DTC, then to participants, then to investors. **Agency MBS are not at DTC**: they live on Fedwire (the Fed's book-entry register) ([24 CFR 350](https://www.ecfr.gov/current/title-24/subtitle-B/chapter-III/part-350)).

The ownership tracker has a new role, **holder of record (N, pink)**: the name on the register, which is distinct from the beneficial owner (the real owner).
- Cede & Co. is the holder of record for private-label and CRT bonds.
- Fedwire keeps the register for agency MBS.
- The ownership ledger has a "Holder of record" column.

The line filter has a new **Clearing, settlement & custody** type, with 20 of the 121 lines.

The 2008 page adds the Lehman close-out. FICC netted almost 90% of Lehman's $329 billion TBA book and closed out $190 billion of government securities trades, with no loss to other members' clearing funds ([DTCC, 2008](https://www.finextra.com/pressarticle/24287/dtcc-closes-out-lehman-bankruptcy)).

DTCC figures for 2025 (approx., sourced from DTCC):
- approx. $4.7 quadrillion of transactions processed;
- approx. $114 trillion held in custody at DTC;
- approx. $82 trillion of MBS trade value netted at the MBS Division;
- FICC's average daily volume reached approx. $11.9 trillion by the end of 2025.

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

The scenario options are random shocks, a calm market, or one chosen shock in quarter 3. The default choices are deliberately beginner-safe: hedges, reinsurance, the safest tranche and credit refreshes start switched on, and each intro has a beginner tip. Switching the safety nets off (for example no hedge and 60% leverage as the MSR aggregator) is the high-risk path, and it can lose heavily. A seed makes every game replayable: the same seed and the same choices always give the same result, on any device. The URL hash remembers the open role (`r=`).

All game figures are **mock and illustrative**, not any firm's terms, prices or results. Named firms appear only as examples of a role. The game engine is in `src/roles.ts` and the page is `src/rolePage.tsx`.

