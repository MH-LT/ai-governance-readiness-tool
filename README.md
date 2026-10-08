# ai-governance-readiness-tool

A self-contained prototype that helps an organisation **register each use of AI, classify the risk against UK data-protection law and the EU AI Act, and produce draft governance documents** — while being honest about what it does not know. Where a question is genuinely unsettled, it flags it for human review instead of inventing a confident answer. Every legal basis is **cited and linked to an official source**, and the law is stated **as at a fixed date** so a reader can check currency.

> **Personal proof-of-concept, built through AI-assisted development.** A working interface that demonstrates applied AI-governance and UK-data-protection thinking. It is a prototype, not a production system, and it **does not give legal advice or make legal determinations**.

**Law as at: 8 October 2026 — verify before reliance.**

## What it does

* **Intake** — capture each AI use and a few governance-relevant facts (personal data, special-category data, decisions about people, solely-automated decisions, account type, EU reach).
* **Rules engine** — classify the use, attach a **confidence level** (clear / likely / unsettled → human review) and a **cited legal basis** to each point, and link that basis to the official source.
* **Escalation** — genuinely unsettled questions resolve to *“Unsettled → human review,”* not a false certainty.
* **Draft outputs** — a draft DPIA summary, policy points and recommended actions, each clearly labelled a draft for a human to check.
* **Defensibility register** — track every system along a ladder: Identified → Assessed → Documented → Review-ready.
* **Keep the record** — the register persists in your browser, and you can download it as JSON, copy the DPIA draft, or **Print → Save as PDF** a clean governance record.

## What it does **not** do

* It does **not** give legal advice or make legal determinations.
* It does **not** decide EU AI Act classification — it flags the question and refers it for review.
* Draft outputs are starting points for a qualified person, not finished documents.

## Legal basis and currency

Each determination cites a provision and links to an official source. Positions were **verified at source on 8 October 2026** (the note on the ICO's DPIA guidance on 22 June 2026); the law moves, so confirm the current position before relying on anything.

* **DPIA** — UK GDPR **Art. 35**; a DPIA is required for processing likely to result in high risk. ICO guidance is under review following the Data (Use and Access) Act 2025, but the criteria that *trigger* a DPIA are unchanged. ([ICO — when do we need a DPIA?](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/data-protection-impact-assessments-dpias/when-do-we-need-to-do-a-dpia/))
* **Automated decision-making** — the **Data (Use and Access) Act 2025, s.80 repealed Art. 22 UK GDPR and replaced it with Arts. 22A–22D**, in force **5 February 2026**. Significant, solely-automated decisions on **non-special-category** data are now permitted subject to the **Art. 22C safeguards** (information, representations, human intervention, the right to contest); decisions on **special-category** data remain restricted under **Art. 22B**. ([DUAA 2025, s.80 — legislation.gov.uk](https://www.legislation.gov.uk/ukpga/2025/18/section/80) · [ICO — DUAA overview](https://ico.org.uk/about-the-ico/what-we-do/legislation-we-cover/data-use-and-access-act-2025/the-data-use-and-access-act-2025-what-does-it-mean-for-organisations/))
* **EU AI Act high-risk** — the **Digital Omnibus on AI, Regulation (EU) 2026/1744** (8 July 2026; Official Journal 24 July 2026; in force **27 July 2026**), moved the Annex III high-risk obligations from 2 August 2026 to **2 December 2027**, and those for high-risk AI in products covered by Annex I to **2 August 2028**. The dates are settled; whether a particular use falls within an Annex III category is not something an intake form can decide, so the tool still marks it **unsettled** and refers it for human review. ([Regulation (EU) 2026/1744 — EUR-Lex](https://eur-lex.europa.eu/eli/reg/2026/1744/oj/eng) · [AI Act framework](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai))
* **AI literacy** — EU AI Act **Art. 4**, **as replaced by Regulation (EU) 2026/1744**: providers and deployers must take measures to support the development of AI literacy, whatever the risk tier, with no specific level required of any individual. The original duty, to ensure a sufficient level, applied from **2 February 2025**. ([Regulation (EU) 2026/1744 — EUR-Lex](https://eur-lex.europa.eu/eli/reg/2026/1744/oj/eng))

## How it works

* **`engine.js`** — the legal rules engine, kept in its own file so the legal logic can be read and tested on its own. It attaches confidence levels, cited bases and source links, and escalates the unsettled. It runs in the browser and in Node.
* **`assistant.js`** — the optional drafting assistant's prompt-construction (see below), separate and testable so its scope lock is verifiable.
* **`index.html`** — the interface: React (bundled locally) and hand-written CSS, with no server and no external dependencies. The app code is pre-compiled to plain JavaScript (`app.js`). State persists to the browser; export and print are built in.
* **`engine.test.js` / `assistant.test.js`** — Node tests. The engine tests include **currency guards** that fail if the automated-decision rule is ever reverted to the repealed Article 22 framing; the assistant tests prove the model is only ever shown the engine's structured output.

A note on the build: the JSX is pre-compiled to plain JavaScript (`app.js`) and React is vendored into the repository, so the page loads with no CDN or other external dependency and renders identically on any machine, including offline.

## Optional AI drafting assistant (bring your own key)

The tool is fully usable without this. If you supply an Anthropic API key, an optional assistant can (1) **explain a single flag** in plainer English and (2) **draft a short governance note** from the findings. It is deliberately constrained:

* **Scope-locked, not open Q&A.** There is no free-text question box. The model is only ever sent the engine's structured findings for the selected system, and is instructed to add no new legal claims, citations or obligations, to preserve the engine's "unsettled → human review" escalations, and to label everything a draft, not advice. The deterministic engine stays the source of truth; the model is a drafting aid on top of it.
* **Why this shape.** An open "ask any legal question" box on a public site would invite confidently-wrong, uncited legal answers under the author's name — the opposite of what this tool stands for — and would require exposing an API key in the frontend. A free-text mode was therefore deliberately *not* built.
* **Key handling.** The key is held only in the browser tab's memory, sent solely to `https://api.anthropic.com/v1/messages`, and **never stored, written to disk, committed, or included in any export.** Closing the tab discards it. Browser calls use the `anthropic-dangerous-direct-browser-access` header — a bring-your-own-key pattern suitable for a personal demo, not a way to ship someone else's key.

## Privacy / data handling

Everything you enter stays in **your browser** (localStorage). The register is never sent anywhere. The only outbound request the page can make is to the Anthropic API — and only if you opt in to the assistant by entering your own key. Use only fictional or properly-authorised data; the bundled example is fictional.

## Run it

* **Locally:** download the folder and open `index.html` in any modern browser. React and the compiled app are included in the folder, so it works offline.
* **As a live demo (no build step):**

  * **GitHub Pages** — push this folder to a repository, then Settings → Pages → deploy from the `main` branch, root folder. Served at your Pages URL.
  * **Netlify / Vercel / Cloudflare Pages** — “deploy a static site” / drag-and-drop the folder, or connect the repo. No build command; the publish directory is the repository root.

## Tests

```bash
node --test
```

Runs without any dependencies (Node's built-in test runner).

## Roadmap (not yet built)

Clearly marked as future work, not present capability:

* A short per-determination reviewer-priority triage (carefully framed so it is not read as a legal risk rating).
* Versioned snapshots of the register (an audit trail of changes over time).
* Pulling the “law as at” sources into a single, dated references panel.
* An optional export to a structured DPIA template.

## Boundaries and responsible use

*Proof-of-concept for demonstration and research only. Not legal advice; creates no lawyer–client relationship; outputs require review by a qualified person before any reliance. The law is stated as at 22 June 2026 — confirm the current position. Built through AI-assisted development.*

## Licence

MIT — see [LICENSE](LICENSE).

## About

Built by **[Mahmoud Hussein](https://legal-technology.uk)**, a lawyer qualified in Egypt (admitted to the Egyptian Bar and registered at Appeal level) and based in the UK, through AI-assisted development — directing and assembling AI-generated code on a foundation of React and JavaScript, with the legal design, the rules logic and the source verification his own.

