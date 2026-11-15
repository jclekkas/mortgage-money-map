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
