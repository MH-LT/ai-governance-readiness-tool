/*
 * engine.js — the legal rules engine for the AI Governance Readiness tool.
 *
 * This file is deliberately separate from the user interface. It contains the
 * legal logic only, so it can be read on its own and tested in Node without a
 * browser (see engine.test.js). It runs in two environments: the browser loads
 * it as a plain script (it attaches window.GovEngine); Node imports it via
 * require() (it sets module.exports).
 *
 * What it does and does not do
 * ----------------------------
 * It extracts governance-relevant facts about an AI use, attaches a confidence
 * level and a cited legal basis to each point, and escalates genuinely unsettled
 * questions for human review. It does NOT give legal advice or make legal
 * determinations. Every output is a draft for a qualified person to check.
 *
 * The confidence levels describe how SETTLED a point is, not how risky it is:
 *   clear     — a settled obligation that clearly applies
 *   likely    — probably applies; a human should confirm
 *   unsettled — genuinely uncertain; refer for human / legal review
 *
 * Legal currency
 * --------------
 * The law moves. This engine states the position as at LAW_AS_AT and links each
 * basis to an official source so a reviewer can verify it. Verified at source on
 * that date against legislation.gov.uk, the ICO, and the European Commission.
 */

(function (root) {
  "use strict";

  // The date on which the legal positions below were verified at source.
  var LAW_AS_AT = "8 October 2026";

  var LADDER = ["Identified", "Assessed", "Documented", "Review-ready"];

  // --- Sources: every legal basis links to an official source. ---
  // Keys are referenced by determinations via `sourceKey`.
  var SOURCES = {
    dp_applies: {
      cite: "UK GDPR / Data Protection Act 2018",
      url: "https://ico.org.uk/about-the-ico/what-we-do/legislation-we-cover/data-use-and-access-act-2025/the-data-use-and-access-act-2025-what-does-it-mean-for-organisations/",
    },
    dpia: {
      cite: "UK GDPR, Art. 35 (DPIA) — ICO guidance",
      url: "https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/data-protection-impact-assessments-dpias/when-do-we-need-to-do-a-dpia/",
    },
    adm: {
      // Art. 22 UK GDPR was repealed and replaced by Arts. 22A–22D by the
      // Data (Use and Access) Act 2025, s.80, in force 5 February 2026.
      cite: "UK GDPR, Arts. 22A–22D (Data (Use and Access) Act 2025, s.80; in force 5 Feb 2026)",
      url: "https://www.legislation.gov.uk/ukpga/2025/18/section/80",
    },
    aiact_highrisk: {
      // The Digital Omnibus on AI, Regulation (EU) 2026/1744 of 8 July 2026 (OJ 24 July 2026,
      // in force 27 July 2026), moved the high-risk application dates.
      cite: "EU AI Act, Annex III (high-risk); applies from 2 Dec 2027 (Regulation (EU) 2026/1744)",
      url: "https://eur-lex.europa.eu/eli/reg/2026/1744/oj/eng",
    },
    ai_literacy: {
      // Art. 4 as replaced by Regulation (EU) 2026/1744: a duty to take measures that support
      // AI literacy, with no specific level required. The original duty applied from 2 Feb 2025.
      cite: "EU AI Act, Art. 4 (AI literacy), as replaced by Regulation (EU) 2026/1744; in force 27 Jul 2026",
      url: "https://eur-lex.europa.eu/eli/reg/2026/1744/oj/eng",
    },
    shadow: {
      cite: "Internal governance / acceptable-use policy",
      url: null,
    },
  };

  function source(key, extra) {
    var s = SOURCES[key] || { cite: "", url: null };
    return {
      basis: s.cite,
      href: s.url,
      sourceKey: key,
      note: extra || "",
    };
  }

  // --- The rules engine: extracts and flags; it never advises. ---
  function assess(s) {
    var d = [];

    if (s.personalData === "yes") {
      d.push(
        Object.assign(
          { level: "clear", label: "UK data-protection law applies" },
          source(
            "dp_applies",
            "The system processes personal data, so UK data-protection obligations apply."
          )
        )
      );
    }

    if (s.personalData === "yes" && (s.specialCategory === "yes" || s.affectsDecisions === "yes")) {
      d.push(
        Object.assign(
          { level: "likely", label: "DPIA likely required" },
          source(
            "dpia",
            "High-risk indicators are present (special-category data and/or decisions affecting people). " +
              "A Data Protection Impact Assessment is likely required under Art. 35. Confirm against current " +
              "ICO guidance (which is under review following the Data (Use and Access) Act 2025, though the " +
              "criteria that trigger a DPIA are unchanged)."
          )
        )
      );
    }

    // Automated decision-making — post-DUAA 2025 regime (Arts. 22A–22D).
    if (s.solelyAutomated === "yes" && s.affectsDecisions === "yes") {
      if (s.specialCategory === "yes") {
        d.push(
          Object.assign(
            { level: "likely", label: "Automated decision on special-category data — restricted" },
            source(
              "adm",
              "Under Art. 22B UK GDPR (as introduced by the Data (Use and Access) Act 2025), a significant, " +
                "solely automated decision based on special-category data is restricted: it generally requires " +
                "explicit consent or another Art. 22B condition, plus the Art. 22C safeguards. Confirm the basis " +
                "before proceeding."
            )
          )
        );
      } else {
        d.push(
          Object.assign(
            { level: "likely", label: "Automated-decision safeguards required" },
            source(
              "adm",
              "Under the post-DUAA regime (Arts. 22A–22D UK GDPR, in force 5 Feb 2026), a significant decision " +
                "made solely by automated means is permitted but requires the Art. 22C safeguards: tell the " +
                "person, let them make representations, give a route to human intervention, and let them contest " +
                "the outcome. Note this replaces the former Art. 22 prohibition. Also check whether involvement " +
                "is genuinely 'solely automated' (no meaningful human involvement)."
            )
          )
        );
      }
    }

    // EU AI Act high-risk — whether a use falls within Annex III is a question for human
    // review; the dates are fixed by Regulation (EU) 2026/1744.
    if (s.affectsDecisions === "yes" && s.euUsers === "yes") {
      d.push(
        Object.assign(
          { level: "unsettled", label: "Possible EU AI Act high-risk use" },
          source(
            "aiact_highrisk",
            "Decisions about people affecting individuals in the EU may fall within an Annex III high-risk " +
              "category (for example, employment or access to services). Whether this use does is a question of " +
              "classification: refer it for human / legal review. The timing is now fixed: the Digital Omnibus, " +
              "Regulation (EU) 2026/1744 (in force 27 July 2026), moved the Annex III high-risk obligations from " +
              "2 August 2026 to 2 December 2027, and those for high-risk AI in products covered by Annex I to " +
              "2 August 2028."
          )
        )
      );
    }

    if (s.approval === "shadow") {
      d.push(
        Object.assign(
          { level: "clear", label: "Shadow-AI governance gap" },
          source(
            "shadow",
            "The system is used through a personal or unapproved account while handling organisational data. " +
              "Bring it under an approved tool and an acceptable-use policy."
          )
        )
      );
    }

    // AI literacy applies to all providers/deployers — a settled obligation, softened in 2026.
    d.push(
      Object.assign(
        { level: "clear", label: "AI literacy & acceptable-use policy" },
        source(
          "ai_literacy",
          "Under EU AI Act Art. 4, as replaced by Regulation (EU) 2026/1744 (in force 27 July 2026), providers " +
            "and deployers must take measures to support the development of AI literacy, whatever the risk tier; " +
            "no specific level is required of any individual. (The original duty, to ensure a sufficient level, " +
            "applied from 2 February 2025.) Provide AI-literacy guidance and an acceptable-use policy for " +
            "everyone who relies on the system's output."
        )
      )
    );

    var level = "clear";
    var classification = "Baseline";
    if (d.some(function (x) { return x.level === "unsettled"; })) {
      level = "unsettled";
      classification = "Refer for review";
    } else if (d.some(function (x) { return x.level === "likely"; })) {
      level = "likely";
      classification = "Elevated";
    }

    return { determinations: d, level: level, classification: classification, lawAsAt: LAW_AS_AT };
  }

  // --- Draft generators: every output is a draft for a human to check. ---
  function buildDrafts(s, a) {
    var needsDpia = a.determinations.some(function (x) { return x.label === "DPIA likely required"; });

    var dpia = needsDpia
      ? "DRAFT — DATA PROTECTION IMPACT ASSESSMENT (summary)\n" +
        "Law as at: " + a.lawAsAt + " (verify before reliance)\n" +
        "System: " + (s.name || "(unnamed)") + "\n" +
        "Purpose: " + (s.purpose || "(not stated)") + "\n" +
        "Personal data: " + (s.personalData === "yes" ? "Yes" : "No") +
        (s.specialCategory === "yes" ? " (incl. special-category data)" : "") + "\n" +
        "Affects decisions about people: " + (s.affectsDecisions === "yes" ? "Yes" : "No") + "\n" +
        "Solely automated: " + (s.solelyAutomated === "yes" ? "Yes" : "No") + "\n\n" +
        "Risk indicators flagged for review:\n" +
        (a.determinations
          .filter(function (x) { return x.level !== "clear"; })
          .map(function (x) { return "  - " + x.label + " (" + x.basis + ")"; })
          .join("\n") || "  - none") +
        "\n\nNext: complete each section with a qualified reviewer. This summary does not\n" +
        "itself satisfy Art. 35 and is not legal advice."
      : null;

    var policy = [
      "Record this system on the organisation's AI register and keep it current.",
      "Define who is accountable for the system and how staff request a human review.",
      s.approval === "shadow"
        ? "Migrate use from the personal/unapproved account to an approved tool."
        : "Confirm the tool is on the approved list before wider use.",
      "Provide AI-literacy guidance to everyone who relies on its output (EU AI Act, Art. 4).",
    ];

    var actions = a.determinations
      .filter(function (x) { return x.level !== "clear"; })
      .map(function (x) {
        return x.level === "unsettled"
          ? "Refer to a qualified reviewer: " + x.label
          : "Action: " + x.label;
      });
    if (actions.length === 0) actions.push("Maintain the register entry and review periodically.");

    return { dpia: dpia, policy: policy, actions: actions };
  }

  var api = {
    assess: assess,
    buildDrafts: buildDrafts,
    SOURCES: SOURCES,
    LADDER: LADDER,
    LAW_AS_AT: LAW_AS_AT,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api; // Node (tests)
  }
  if (root) {
    root.GovEngine = api; // browser
  }
})(typeof window !== "undefined" ? window : null);
