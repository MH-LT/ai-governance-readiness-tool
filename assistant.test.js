/*
 * assistant.test.js — runs with: node --test
 *
 * These tests verify the assistant's scope lock: the prompts are built only from
 * the deterministic engine's structured output, the boundary rules are present,
 * and there is deliberately no function that accepts arbitrary user text.
 */

const test = require("node:test");
const assert = require("node:assert");

const engine = require("./engine.js");
const assistant = require("./assistant.js");

function sampleSystem() {
  return {
    name: "CV-screening assistant",
    purpose: "Rank job applicants from CVs",
    personalData: "yes",
    specialCategory: "no",
    affectsDecisions: "yes",
    solelyAutomated: "no",
    approval: "approved",
    euUsers: "yes",
  };
}

test("the only callable surface is the two fixed actions (no free-text path)", () => {
  const fns = Object.keys(assistant).filter((k) => typeof assistant[k] === "function");
  assert.deepStrictEqual(fns.sort(), ["buildDraftRequest", "buildExplainRequest"]);
});

test("system prompt enforces the boundary", () => {
  const p = assistant.SYSTEM_PROMPT.toLowerCase();
  assert.match(p, /only from the structured findings/);
  assert.match(p, /do not introduce new legal claims/);
  assert.match(p, /not give legal advice/);
  assert.match(p, /unsettled/);
  assert.match(p, /draft/);
});

test("explain request is grounded only in the chosen determination", () => {
  const s = sampleSystem();
  const a = engine.assess(s);
  const det = a.determinations[0];
  const req = assistant.buildExplainRequest(s, det);

  assert.strictEqual(req.messages.length, 1);
  assert.strictEqual(req.messages[0].role, "user");
  const body = req.messages[0].content;
  // contains the engine's own fields for this determination
  assert.ok(body.includes(det.label));
  assert.ok(body.includes(det.basis));
  assert.ok(body.includes(det.note));
  assert.ok(body.includes(s.name));
  // the system prompt travels with it, and generation is constrained
  assert.strictEqual(req.system, assistant.SYSTEM_PROMPT);
  assert.ok(req.temperature <= 0.3);
  assert.ok(req.max_tokens > 0);
});

test("draft request includes every finding and the classification", () => {
  const s = sampleSystem();
  const a = engine.assess(s);
  const req = assistant.buildDraftRequest(s, a);
  const body = req.messages[0].content;

  for (const d of a.determinations) {
    assert.ok(body.includes(d.label), "missing finding: " + d.label);
  }
  assert.ok(body.includes(a.classification));
  // instruction to add nothing new and to preserve escalation
  assert.match(body.toLowerCase(), /introduce nothing new|use only the findings/);
  assert.match(body.toLowerCase(), /unsettled/);
  assert.match(body.toLowerCase(), /not legal advice/);
});

test("requests carry no API key and no network detail (key handled at call time)", () => {
  const s = sampleSystem();
  const a = engine.assess(s);
  const req = assistant.buildDraftRequest(s, a);
  const serialized = JSON.stringify(req).toLowerCase();
  assert.ok(!serialized.includes("sk-ant"));
  assert.ok(!serialized.includes("x-api-key"));
  assert.ok(!serialized.includes("http"));
});

test("a sensible default model is exposed", () => {
  assert.ok(assistant.DEFAULT_MODEL);
  assert.ok(Array.isArray(assistant.MODELS) && assistant.MODELS.length >= 1);
  assert.ok(assistant.MODELS.some((m) => m.id === assistant.DEFAULT_MODEL));
});
