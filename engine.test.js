/*
 * engine.test.js — runs with Node's built-in test runner, no dependencies:
 *     node --test
 *
 * These tests do two jobs: they check the rules engine behaves as specified,
 * and they act as a legal-currency guard. Several tests fail on purpose if the
 * automated-decision rule is ever edited back to the repealed Article 22
 * "prohibited" framing — so a careless future change cannot silently revert the
 * tool to out-of-date law.
 */

const test = require("node:test");
const assert = require("node:assert");
const { assess, buildDrafts, SOURCES, LADDER, LAW_AS_AT } = require("./engine.js");

function base(overrides) {
  return Object.assign(
    {
      name: "Test system",
      purpose: "Testing",
      personalData: "no",
      specialCategory: "no",
      affectsDecisions: "no",
      solelyAutomated: "no",
      approval: "approved",
      euUsers: "no",
    },
    overrides || {}
  );
}

const labels = (a) => a.determinations.map((d) => d.label);

test("a benign system is Baseline and only flags AI literacy", () => {
  const a = assess(base());
  assert.strictEqual(a.level, "clear");
  assert.strictEqual(a.classification, "Baseline");
  assert.deepStrictEqual(labels(a), ["AI literacy & acceptable-use policy"]);
});

test("personal data triggers 'UK data-protection law applies'", () => {
  const a = assess(base({ personalData: "yes", affectsDecisions: "no" }));
  assert.ok(labels(a).includes("UK data-protection law applies"));
});

test("special-category or decisions about people make a DPIA likely", () => {
  const a = assess(base({ personalData: "yes", specialCategory: "yes" }));
  assert.ok(labels(a).includes("DPIA likely required"));
  assert.strictEqual(a.level, "likely");
});

test("EU + decisions about people is unsettled and refers for review", () => {
  const a = assess(base({ affectsDecisions: "yes", euUsers: "yes" }));
  assert.ok(labels(a).includes("Possible EU AI Act high-risk use"));
  assert.strictEqual(a.level, "unsettled");
  assert.strictEqual(a.classification, "Refer for review");
});

test("shadow account flags a governance gap", () => {
  const a = assess(base({ approval: "shadow" }));
  assert.ok(labels(a).includes("Shadow-AI governance gap"));
});

test("solely-automated significant decision (non-special) requires safeguards", () => {
  const a = assess(base({ affectsDecisions: "yes", solelyAutomated: "yes", specialCategory: "no" }));
  const adm = a.determinations.find((d) => d.label === "Automated-decision safeguards required");
  assert.ok(adm, "expected an automated-decision determination");
  // safeguards language must be present
  assert.match(adm.note, /human intervention/i);
  assert.match(adm.note, /contest/i);
});

test("solely-automated decision on special-category data is restricted (Art. 22B)", () => {
  const a = assess(base({ affectsDecisions: "yes", solelyAutomated: "yes", specialCategory: "yes" }));
  const adm = a.determinations.find((d) =>
    d.label === "Automated decision on special-category data — restricted"
  );
  assert.ok(adm, "expected a special-category ADM determination");
  assert.match(adm.note, /22B/);
});

// --- Legal-currency guards -------------------------------------------------

test("CURRENCY GUARD: ADM basis cites the post-DUAA articles, not repealed Art. 22", () => {
  const a = assess(base({ affectsDecisions: "yes", solelyAutomated: "yes" }));
  const adm = a.determinations.find((d) => d.sourceKey === "adm");
  assert.ok(adm);
  assert.match(adm.basis, /22A–22D/);
  assert.match(adm.basis, /2025/);
  // must NOT present the old "prohibited" default as the current rule
  assert.doesNotMatch(adm.note, /\bprohibited\b/i);
});

test("CURRENCY GUARD: EU AI Act item cites the adopted Omnibus and its fixed dates, and still escalates", () => {
  const a = assess(base({ affectsDecisions: "yes", euUsers: "yes" }));
  const item = a.determinations.find((d) => d.sourceKey === "aiact_highrisk");
  // Regulation (EU) 2026/1744 is adopted and in force (27 July 2026): never "provisional" again.
  assert.match(item.note, /2026\/1744/);
  assert.doesNotMatch(item.note, /not yet adopted|provisional/i);
  assert.doesNotMatch(SOURCES.aiact_highrisk.cite, /not yet adopted|provisional/i);
  assert.match(item.note, /2 December 2027/);
  assert.match(item.note, /2 August 2028/);
  // Whether a use falls within Annex III is still for a person to decide.
  assert.strictEqual(item.level, "unsettled");
});

test("CURRENCY GUARD: AI literacy states Art. 4 as replaced in 2026, not the original duty", () => {
  const a = assess(base({}));
  const item = a.determinations.find((d) => d.sourceKey === "ai_literacy");
  assert.match(item.note, /2026\/1744/);
  assert.match(item.note, /take measures to support/);
  assert.match(SOURCES.ai_literacy.cite, /as replaced/);
});

test("every determination's source resolves and any URL is https", () => {
  const a = assess(base({ personalData: "yes", affectsDecisions: "yes", euUsers: "yes", solelyAutomated: "yes" }));
  for (const d of a.determinations) {
    assert.ok(SOURCES[d.sourceKey], `missing source for ${d.sourceKey}`);
    if (d.href) assert.match(d.href, /^https:\/\//);
  }
});

test("drafts: a DPIA summary is produced and is clearly not legal advice", () => {
  const s = base({ personalData: "yes", specialCategory: "yes" });
  const a = assess(s);
  const drafts = buildDrafts(s, a);
  assert.ok(drafts.dpia.includes("DRAFT"));
  assert.match(drafts.dpia, /not legal advice/i);
  assert.ok(drafts.policy.length > 0);
  assert.ok(drafts.actions.length > 0);
});

test("the ladder and law-as-at date are exported", () => {
  assert.deepStrictEqual(LADDER, ["Identified", "Assessed", "Documented", "Review-ready"]);
  assert.match(LAW_AS_AT, /2026/);
});
