const {
  useState,
  useMemo,
  useEffect
} = React;
const {
  assess,
  buildDrafts,
  LADDER,
  LAW_AS_AT
} = GovEngine;
const {
  DEFAULT_MODEL,
  MODELS,
  buildExplainRequest,
  buildDraftRequest
} = GovAssistant;
const STORAGE_KEY = "gov_systems_v2";
function Chip({
  level
}) {
  const map = {
    clear: "Clear",
    likely: "Likely",
    unsettled: "Unsettled → human review"
  };
  return React.createElement("span", {
    className: "chip " + level
  }, map[level]);
}
function Ladder({
  status
}) {
  const idx = LADDER.indexOf(status);
  return React.createElement("div", {
    className: "ladder",
    "aria-label": "Status: " + status
  }, LADDER.map((step, i) => React.createElement("span", {
    key: step,
    className: i <= idx ? "on" : ""
  }, step)));
}
const BLANK = {
  name: "",
  purpose: "",
  personalData: "yes",
  specialCategory: "no",
  affectsDecisions: "yes",
  solelyAutomated: "no",
  approval: "approved",
  euUsers: "yes"
};
const SEED = {
  id: 1,
  status: "Identified",
  assessment: null,
  drafts: null,
  name: "CV-screening assistant",
  purpose: "Rank job applicants from CVs",
  personalData: "yes",
  specialCategory: "no",
  affectsDecisions: "yes",
  solelyAutomated: "no",
  approval: "approved",
  euUsers: "yes"
};
function loadSystems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [SEED];
}
async function callClaude(apiKey, model, request) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model,
      max_tokens: request.max_tokens,
      temperature: request.temperature,
      system: request.system,
      messages: request.messages
    })
  });
  if (!res.ok) {
    let msg = "Request failed (" + res.status + ").";
    if (res.status === 401) msg = "Invalid or unauthorised API key.";else if (res.status === 429) msg = "Rate limited — wait a moment and try again.";
    try {
      const e = await res.json();
      if (e && e.error && e.error.message) msg += " " + e.error.message;
    } catch (_) {}
    throw new Error(msg);
  }
  const data = await res.json();
  return (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
}
function App() {
  const [systems, setSystems] = useState(loadSystems);
  const [form, setForm] = useState(BLANK);
  const [selected, setSelected] = useState(null);
  const stamp = useMemo(() => new Date().toISOString().slice(0, 16).replace("T", " "), []);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [flagIdx, setFlagIdx] = useState(0);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiResult, setAiResult] = useState(null);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(systems));
    } catch (e) {}
  }, [systems]);
  const set = k => e => setForm({
    ...form,
    [k]: e.target.value
  });
  function clearAi() {
    setAiResult(null);
    setAiError("");
  }
  function addSystem() {
    if (!form.name.trim()) return;
    const id = Date.now();
    setSystems([...systems, {
      ...form,
      id,
      status: "Identified",
      assessment: null,
      drafts: null
    }]);
    setForm(BLANK);
    setSelected(id);
  }
  function update(id, patch) {
    setSystems(systems.map(s => s.id === id ? {
      ...s,
      ...patch
    } : s));
  }
  function removeSystem(id) {
    setSystems(systems.filter(s => s.id !== id));
    if (selected === id) setSelected(null);
  }
  function resetAll() {
    if (window.confirm("Clear the whole register from this browser?")) {
      setSystems([]);
      setSelected(null);
    }
  }
  function runAssess(s) {
    update(s.id, {
      assessment: assess(s),
      status: "Assessed"
    });
    setSelected(s.id);
    clearAi();
  }
  function genDrafts(s) {
    const a = s.assessment || assess(s);
    update(s.id, {
      assessment: a,
      drafts: buildDrafts(s, a),
      status: "Documented"
    });
  }
  function markReady(s) {
    update(s.id, {
      status: "Review-ready"
    });
  }
  function downloadJSON() {
    const blob = new Blob([JSON.stringify(systems, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ai-governance-register.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function copyText(t) {
    if (navigator.clipboard) navigator.clipboard.writeText(t);
  }
  async function explainFlag() {
    if (!apiKey || !sel || !sel.assessment) return;
    const dets = sel.assessment.determinations;
    const det = dets[Math.min(flagIdx, dets.length - 1)];
    setAiBusy(true);
    setAiError("");
    setAiResult(null);
    try {
      const text = await callClaude(apiKey, model, buildExplainRequest(sel, det));
      setAiResult({
        title: "Explanation — " + det.label,
        text
      });
    } catch (e) {
      setAiError(e.message);
    } finally {
      setAiBusy(false);
    }
  }
  async function draftProse() {
    if (!apiKey || !sel || !sel.assessment) return;
    setAiBusy(true);
    setAiError("");
    setAiResult(null);
    try {
      const text = await callClaude(apiKey, model, buildDraftRequest(sel, sel.assessment));
      setAiResult({
        title: "Draft governance note — " + sel.name,
        text
      });
    } catch (e) {
      setAiError(e.message);
    } finally {
      setAiBusy(false);
    }
  }
  const sel = systems.find(s => s.id === selected) || null;
  const keyReady = apiKey.trim().length > 0;
  return React.createElement("div", {
    className: "wrap"
  }, React.createElement("header", {
    className: "top"
  }, React.createElement("div", {
    className: "eyebrow"
  }, "AI Governance · readiness prototype"), React.createElement("h1", null, "Find the AI, weigh the risk, show your working."), React.createElement("p", {
    className: "thesis"
  }, "A UK-data-protection-first prototype that registers each AI use, classifies it, and — instead of faking certainty — flags genuinely unsettled questions for human review. Every output is a draft, not advice."), React.createElement("div", {
    className: "stamp"
  }, "prototype v0.3 · session ", stamp, " · systems on register: ", systems.length, " ·", " ", React.createElement("span", {
    className: "asat"
  }, "law as at ", LAW_AS_AT, " — verify before reliance"))), React.createElement("div", {
    className: "datanote"
  }, "Everything you enter stays in this browser (localStorage). Nothing is sent to any server — except, if you choose to use the optional AI assistant below, your request goes directly to the Anthropic API using a key you supply."), React.createElement("section", {
    className: "panel no-print"
  }, React.createElement("h2", null, "1 · Add an AI use"), React.createElement("div", {
    className: "grid"
  }, React.createElement("div", {
    className: "field"
  }, React.createElement("label", {
    htmlFor: "name"
  }, "System / tool name"), React.createElement("input", {
    id: "name",
    value: form.name,
    onChange: set("name"),
    placeholder: "e.g. Contract triage assistant"
  })), React.createElement("div", {
    className: "field"
  }, React.createElement("label", {
    htmlFor: "purpose"
  }, "Purpose"), React.createElement("input", {
    id: "purpose",
    value: form.purpose,
    onChange: set("purpose"),
    placeholder: "What it is used for"
  })), React.createElement("div", {
    className: "field"
  }, React.createElement("label", {
    htmlFor: "pd"
  }, "Uses personal data?"), React.createElement("select", {
    id: "pd",
    value: form.personalData,
    onChange: set("personalData")
  }, React.createElement("option", {
    value: "yes"
  }, "Yes"), React.createElement("option", {
    value: "no"
  }, "No"))), React.createElement("div", {
    className: "field"
  }, React.createElement("label", {
    htmlFor: "sc"
  }, "Special-category data?"), React.createElement("select", {
    id: "sc",
    value: form.specialCategory,
    onChange: set("specialCategory")
  }, React.createElement("option", {
    value: "no"
  }, "No"), React.createElement("option", {
    value: "yes"
  }, "Yes"))), React.createElement("div", {
    className: "field"
  }, React.createElement("label", {
    htmlFor: "ad"
  }, "Affects decisions about people?"), React.createElement("select", {
    id: "ad",
    value: form.affectsDecisions,
    onChange: set("affectsDecisions")
  }, React.createElement("option", {
    value: "yes"
  }, "Yes"), React.createElement("option", {
    value: "no"
  }, "No"))), React.createElement("div", {
    className: "field"
  }, React.createElement("label", {
    htmlFor: "sa"
  }, "Solely automated decision?"), React.createElement("select", {
    id: "sa",
    value: form.solelyAutomated,
    onChange: set("solelyAutomated")
  }, React.createElement("option", {
    value: "no"
  }, "No"), React.createElement("option", {
    value: "yes"
  }, "Yes"))), React.createElement("div", {
    className: "field"
  }, React.createElement("label", {
    htmlFor: "ap"
  }, "Account type"), React.createElement("select", {
    id: "ap",
    value: form.approval,
    onChange: set("approval")
  }, React.createElement("option", {
    value: "approved"
  }, "Approved tool"), React.createElement("option", {
    value: "shadow"
  }, "Personal / unapproved (shadow)"))), React.createElement("div", {
    className: "field"
  }, React.createElement("label", {
    htmlFor: "eu"
  }, "Affects people in the EU?"), React.createElement("select", {
    id: "eu",
    value: form.euUsers,
    onChange: set("euUsers")
  }, React.createElement("option", {
    value: "yes"
  }, "Yes"), React.createElement("option", {
    value: "no"
  }, "No")))), React.createElement("div", {
    className: "row-btns"
  }, React.createElement("button", {
    onClick: addSystem
  }, "Add to register"), React.createElement("button", {
    className: "ghost",
    onClick: () => setForm(BLANK)
  }, "Clear"))), React.createElement("section", {
    className: "panel"
  }, React.createElement("div", {
    className: "toolbar"
  }, React.createElement("h2", {
    style: {
      margin: 0
    }
  }, "2 · Defensibility register"), React.createElement("div", {
    className: "row-btns no-print",
    style: {
      marginTop: 0
    }
  }, React.createElement("button", {
    className: "small ghost",
    onClick: downloadJSON,
    disabled: systems.length === 0
  }, "Download JSON"), React.createElement("button", {
    className: "small ghost",
    onClick: () => window.print(),
    disabled: systems.length === 0
  }, "Print / Save as PDF"), React.createElement("button", {
    className: "small ghost",
    onClick: resetAll,
    disabled: systems.length === 0
  }, "Clear all"))), systems.length === 0 ? React.createElement("p", {
    className: "empty"
  }, "No systems yet. Add an AI use above to begin the register.") : React.createElement("table", null, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "System"), React.createElement("th", {
    className: "hide"
  }, "Classification"), React.createElement("th", null, "Confidence"), React.createElement("th", null, "Status"), React.createElement("th", {
    className: "no-print"
  }))), React.createElement("tbody", null, systems.map(s => React.createElement("tr", {
    key: s.id,
    className: "clickable " + (s.id === selected ? "active" : ""),
    onClick: () => {
      setSelected(s.id === selected ? null : s.id);
      clearAi();
      setFlagIdx(0);
    }
  }, React.createElement("td", null, s.name), React.createElement("td", {
    className: "hide"
  }, s.assessment ? s.assessment.classification : "—"), React.createElement("td", null, s.assessment ? React.createElement(Chip, {
    level: s.assessment.level
  }) : React.createElement("span", {
    className: "chip none"
  }, "Not assessed")), React.createElement("td", null, React.createElement(Ladder, {
    status: s.status
  })), React.createElement("td", {
    className: "no-print",
    style: {
      textAlign: "right"
    }
  }, React.createElement("button", {
    className: "small ghost",
    onClick: e => {
      e.stopPropagation();
      removeSystem(s.id);
    }
  }, "Remove")))))), sel && React.createElement("div", {
    className: "detail"
  }, React.createElement("div", {
    className: "row-btns no-print",
    style: {
      marginTop: 0,
      marginBottom: 16
    }
  }, React.createElement("button", {
    className: "small",
    onClick: () => runAssess(sel)
  }, "Assess"), React.createElement("button", {
    className: "small ghost",
    onClick: () => genDrafts(sel),
    disabled: !sel.assessment
  }, "Generate drafts"), React.createElement("button", {
    className: "small ghost",
    onClick: () => markReady(sel),
    disabled: sel.status !== "Documented"
  }, "Mark review-ready")), !sel.assessment && React.createElement("p", {
    className: "empty"
  }, "Press ", React.createElement("strong", null, "Assess"), " to run the rules for “", sel.name, "”."), sel.assessment && sel.assessment.determinations.map((d, i) => React.createElement("div", {
    className: "det",
    key: i
  }, React.createElement("div", null, React.createElement(Chip, {
    level: d.level
  }), React.createElement("div", {
    className: "basis"
  }, d.basis, d.href && React.createElement(React.Fragment, null, " · ", React.createElement("a", {
    href: d.href,
    target: "_blank",
    rel: "noopener noreferrer"
  }, "source ↗")))), React.createElement("div", null, React.createElement("div", {
    className: "label"
  }, d.label), React.createElement("div", null, d.note)))), sel.drafts && React.createElement("div", {
    className: "draftbox"
  }, React.createElement("div", {
    className: "draft-head"
  }, React.createElement("div", {
    className: "tag"
  }, "Generated drafts — for human review, not advice"), sel.drafts.dpia && React.createElement("button", {
    className: "small ghost no-print",
    onClick: () => copyText(sel.drafts.dpia)
  }, "Copy DPIA")), sel.drafts.dpia && React.createElement(React.Fragment, null, React.createElement("h4", null, "DPIA summary"), React.createElement("pre", {
    className: "dpia"
  }, sel.drafts.dpia)), React.createElement("h4", null, "Policy points"), React.createElement("ul", null, sel.drafts.policy.map((p, i) => React.createElement("li", {
    key: i
  }, p))), React.createElement("h4", null, "Recommended actions"), React.createElement("ul", null, sel.drafts.actions.map((p, i) => React.createElement("li", {
    key: i
  }, p)))), sel.assessment && React.createElement("div", {
    className: "assistant-actions no-print"
  }, React.createElement("div", {
    className: "ai-tag"
  }, "AI drafting assistant (optional) — works only from the findings above"), !keyReady && React.createElement("p", {
    className: "empty"
  }, "Enter your Anthropic API key in section\xA03 to enable."), React.createElement("div", {
    className: "ctl"
  }, React.createElement("div", {
    className: "field"
  }, React.createElement("label", {
    htmlFor: "flag"
  }, "Explain a flag"), React.createElement("select", {
    id: "flag",
    value: flagIdx,
    onChange: e => setFlagIdx(Number(e.target.value)),
    disabled: !keyReady
  }, sel.assessment.determinations.map((d, i) => React.createElement("option", {
    key: i,
    value: i
  }, d.label)))), React.createElement("button", {
    className: "small",
    onClick: explainFlag,
    disabled: !keyReady || aiBusy
  }, "Explain this flag"), React.createElement("button", {
    className: "small ghost",
    onClick: draftProse,
    disabled: !keyReady || aiBusy
  }, "Draft note from findings")), aiBusy && React.createElement("div", {
    className: "aibusy"
  }, "Asking the model…"), aiError && React.createElement("div", {
    className: "aierr"
  }, aiError), aiResult && React.createElement("div", {
    className: "aibox"
  }, React.createElement("div", {
    className: "head"
  }, React.createElement("div", {
    className: "tag"
  }, "AI-generated draft — for human review, not advice"), React.createElement("button", {
    className: "small ghost",
    onClick: () => copyText(aiResult.text)
  }, "Copy")), React.createElement("h4", null, aiResult.title), React.createElement("div", {
    className: "out"
  }, aiResult.text))))), React.createElement("section", {
    className: "panel no-print"
  }, React.createElement("h2", null, "3 · AI drafting assistant — optional, bring your own key"), React.createElement("p", {
    style: {
      marginTop: 0,
      color: "var(--slate-soft)",
      fontSize: 14
    }
  }, "The tool above works fully without this. If you want it to explain a flag in plainer English or draft a governance note, paste an Anthropic API key. The assistant works ", React.createElement("strong", null, "only"), " from the findings the rules engine has already produced — it has no free-text question box and adds no new legal claims."), React.createElement("div", {
    className: "keyrow"
  }, React.createElement("div", {
    className: "field"
  }, React.createElement("label", {
    htmlFor: "key"
  }, "Anthropic API key"), React.createElement("input", {
    id: "key",
    type: "password",
    value: apiKey,
    onChange: e => setApiKey(e.target.value),
    placeholder: "sk-ant-…",
    autoComplete: "off"
  })), React.createElement("div", {
    className: "field modelf"
  }, React.createElement("label", {
    htmlFor: "model"
  }, "Model"), React.createElement("select", {
    id: "model",
    value: model,
    onChange: e => setModel(e.target.value)
  }, MODELS.map(m => React.createElement("option", {
    key: m.id,
    value: m.id
  }, m.label))))), React.createElement("div", {
    className: "datanote",
    style: {
      marginTop: 14,
      marginBottom: 0
    }
  }, "Your key is held only in this browser tab's memory and sent solely to the Anthropic API to make your request. It is never stored, never written to disk, and never included in any export. Close the tab and it is gone.")), React.createElement("div", {
    className: "rail"
  }, React.createElement("strong", null, "What this is."), " A personal proof-of-concept, not a production system. It ", React.createElement("strong", null, "extracts, organises and flags"), "; it does not give legal advice or make legal determinations, and it escalates genuinely unsettled questions for human review rather than resolving them. Each legal basis links to an official source, and the law is stated as at ", LAW_AS_AT, " — confirm the current position before relying on anything. The optional assistant is a drafting aid over the deterministic engine, not a source of legal answers; every draft is for a qualified person to check. Example data is fictional."));
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App, null));