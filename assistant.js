/*
 * assistant.js — the optional AI drafting assistant for the AI Governance tool.
 *
 * This file builds the prompts only. The network call lives in index.html and
 * uses a key the visitor supplies (bring-your-own-key). Keeping prompt
 * construction here, separate and testable, is what makes the assistant's scope
 * lock verifiable: the model is only ever shown the deterministic engine's
 * structured findings, and is instructed to explain or draft from them — never
 * to answer free-text questions, introduce new legal claims, or give advice.
 *
 * There is deliberately NO function that takes arbitrary user text. The two
 * actions below are the entire surface. The model is a drafting aid on top of
 * the engine, not an oracle beside it.
 */

(function (root) {
  "use strict";

  var DEFAULT_MODEL = "claude-sonnet-4-6";

  var MODELS = [
    { id: "claude-sonnet-4-6", label: "Sonnet (better drafting)" },
    { id: "claude-haiku-4-5-20251001", label: "Haiku (faster / cheaper)" },
  ];

  // The boundary. The model works only from the findings it is given.
  var SYSTEM_PROMPT =
    "You are a drafting aid inside a UK-data-protection AI-governance prototype. " +
    "You work ONLY from the structured findings produced by the tool's deterministic " +
    "rules engine, which are supplied to you in the user message. You do two kinds of " +
    "task: (1) explain a single flag in plain English; (2) turn flagged points into a " +
    "short, readable governance note.\n\n" +
    "Hard rules you must follow:\n" +
    "- Use ONLY the information provided. Do not introduce new legal claims, new citations, " +
    "new statutory provisions, new obligations, or any facts not present in the input. If " +
    "something is not in the provided findings, do not assert it.\n" +
    "- Do NOT give legal advice, reach legal conclusions, or make recommendations about what " +
    "the organisation should decide. You explain and draft; a qualified person decides.\n" +
    "- Preserve the engine's escalation: where a finding is marked 'unsettled', say it is " +
    "unsettled and must be referred for human or legal review; do not resolve it.\n" +
    "- Write plainly, for a non-lawyer, and keep it concise.\n" +
    "- Everything you produce is a DRAFT for a qualified person to review. It is not a finished " +
    "document and it is not legal advice.";

  var TEMPERATURE = 0.2;
  var MAX_TOKENS = 1024;

  function sysLine(s) {
    var name = (s && s.name) || "(unnamed system)";
    var purpose = (s && s.purpose) || "(purpose not stated)";
    return "System: " + name + " — " + purpose;
  }

  // Action 1: explain a single determination produced by the engine.
  function buildExplainRequest(system, determination) {
    var user =
      "Task: explain the following flag in plain English, based only on the information below.\n\n" +
      sysLine(system) + "\n" +
      "Flag: " + determination.label + "\n" +
      "Legal basis (as identified by the engine): " + determination.basis + "\n" +
      "Engine note: " + determination.note + "\n" +
      "Confidence level: " + determination.level + "\n\n" +
      "Explain what this flag means and why it was raised. Do not add anything beyond the " +
      "information above. If the level is 'unsettled', make clear it must be referred for human " +
      "or legal review. End with a one-line reminder that this is a draft for review, not legal advice.";

    return {
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: user }],
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
    };
  }

  // Action 2: draft a short governance note from all of a system's findings.
  function buildDraftRequest(system, assessment) {
    var findings = (assessment.determinations || [])
      .map(function (d) {
        return "- [" + d.level + "] " + d.label + " — basis: " + d.basis + " — note: " + d.note;
      })
      .join("\n");

    var user =
      "Task: draft a short, plain-English governance note from the following findings, " +
      "based only on the information below.\n\n" +
      sysLine(system) + "\n" +
      "Overall classification: " + assessment.classification + "\n" +
      "Law as at: " + (assessment.lawAsAt || "(date not provided)") + "\n\n" +
      "Findings:\n" + findings + "\n\n" +
      "Write a concise draft governance note (a few short paragraphs) summarising these findings " +
      "for a human reviewer. Use only the findings above; introduce nothing new. Mark anything " +
      "'unsettled' as requiring human or legal review rather than resolving it. End with a one-line " +
      "reminder that this is a draft for review, not legal advice.";

    return {
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: user }],
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
    };
  }

  var api = {
    DEFAULT_MODEL: DEFAULT_MODEL,
    MODELS: MODELS,
    SYSTEM_PROMPT: SYSTEM_PROMPT,
    buildExplainRequest: buildExplainRequest,
    buildDraftRequest: buildDraftRequest,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api; // Node (tests)
  }
  if (root) {
    root.GovAssistant = api; // browser
  }
})(typeof window !== "undefined" ? window : null);
