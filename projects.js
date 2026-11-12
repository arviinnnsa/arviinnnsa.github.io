/* Projects: long goals (e.g. UBC application) as a timeline to the deadline, next step big.
   Steps are planned with Claude and pasted in. Steps due soon are suggested when planning Focus.
   Saved in the app state (ST.projects), so it syncs between iPhone and Mac. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = n => String(n).padStart(2, "0");
  const keyOf = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const today = () => keyOf(new Date());
  const dOf = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const days = (a, b) => Math.round((dOf(b) - dOf(a)) / 864e5);
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const short = k => { const d = dOf(k); return MON[d.getMonth()] + " " + d.getDate(); };
  const rel = k => { const n = days(today(), k); return n === 0 ? "today" : n === 1 ? "tomorrow" : n === -1 ? "yesterday" : n < 0 ? `${-n} days late` : n < 7 ? `in ${n} days` : short(k); };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const CK = '<svg viewBox="0 0 12 12"><path d="M2 6.5l2.5 2.5L10 3.5"/></svg>';

  const st = () => (window.apState && window.apState.get()) || null;
  const list = () => { const s = st(); if (!s) return []; if (!Array.isArray(s.projects)) s.projects = []; return s.projects; };
  let lastSig = "";
  const sig = () => JSON.stringify(list());
  const save = () => { lastSig = sig(); window.apState && window.apState.save(true); draw(); };
  const tap = () => { try { window.apHaptic && window.apHaptic(); } catch (e) {} };

  /* ---------- plan text from Claude ---------- */
  const EXAMPLE = `Project: UBC Sauder application | due 2027-01-15
Goal: A strong BCom transfer application
- Check admission requirements :: 2026-11-20 :: You know the GPA range, required courses and every deadline
- List activities and achievements :: 2026-11-27 :: Pedalheads, tutoring, certifications written down with dates
- Draft personal profile answers :: 2026-12-10 :: A full first draft of every question
- Get feedback and revise :: 2026-12-20 :: One person read it, you made a second draft
- Submit application :: 2027-01-10 :: Confirmation email received`;

  function parseDate(s) {
    s = String(s || "").trim();
    let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
    m = s.match(/([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?/);
    if (m) {
      const mi = MON.findIndex(x => x.toLowerCase() === m[1].slice(0, 3).toLowerCase());
      if (mi < 0) return null;
      let y = m[3] ? +m[3] : new Date().getFullYear();
      let k = `${y}-${pad(mi + 1)}-${pad(+m[2])}`;
      if (!m[3] && days(today(), k) < -60) k = `${y + 1}-${pad(mi + 1)}-${pad(+m[2])}`;
      return k;
    }
    return null;
  }
  function parse(text) {
    const lines = String(text).replace(/\r/g, "").split("\n").map(l => l.trim()).filter(Boolean);
    const head = lines.find(l => /^project\s*:/i.test(l));
    if (!head) return { error: 'Start with a line like "Project: UBC application | due 2027-01-15".' };
    const [nm, ...rest] = head.replace(/^project\s*:\s*/i, "").split("|").map(x => x.trim());
    const due = parseDate(rest.join(" ").replace(/^due\s*/i, ""));
    if (!nm) return { error: "The project needs a name." };
    if (!due) return { error: 'Add a deadline, like "| due 2027-01-15".' };
    const goalL = lines.find(l => /^goal\s*:/i.test(l));
    const steps = [];
    for (const l of lines) {
      if (!/^[-•*]\s*/.test(l)) continue;
      const [t, d, w] = l.replace(/^[-•*]\s*/, "").split("::").map(x => (x || "").trim());
      if (!t) continue;
      steps.push({ id: uid(), t, d: parseDate(d) || null, w: w || "", done: false });
    }
    if (!steps.length) return { error: 'Add steps as lines starting with "- ".' };
    steps.forEach((s, i) => { if (!s.d) s.d = steps.slice(i + 1).find(x => x.d)?.d || due; });
    return { p: { name: nm, due, goal: goalL ? goalL.replace(/^goal\s*:\s*/i, "") : "", steps } };
  }
  function commit(text) {
    const r = parse(text);
    if (r.error) return r.error;
    const L = list(), old = L.find(x => x.name.toLowerCase() === r.p.name.toLowerCase());
    if (old) {   // update: keep what's already done
      r.p.steps.forEach(s => { const o = old.steps.find(x => x.t.toLowerCase() === s.t.toLowerCase()); if (o) { s.id = o.id; s.done = o.done; s.doneAt = o.doneAt; } });
      Object.assign(old, { due: r.p.due, goal: r.p.goal || old.goal, steps: r.p.steps, u: Date.now() });
    } else L.push({ id: uid(), created: today(), ...r.p, u: Date.now() });
    save();
    return null;
  }

  /* ---------- helpers ---------- */
  const nextStep = p => p.steps.find(s => !s.done) || null;
  const pct = p => p.steps.length ? p.steps.filter(s => s.done).length / p.steps.length : 0;
  function dueSoon(win) {
    const t = today(), out = [];
    for (const p of list()) for (const s of p.steps) if (!s.done && days(t, s.d) <= win) out.push({ p, s });
    return out.sort((a, b) => a.s.d < b.s.d ? -1 : 1);
  }
  window.apProjects = { dueSoon };

  /* ---------- views ---------- */
  let open = null;
  function timeline(p) {
    const t = today(), a = [p.created || t, ...p.steps.map(s => s.d)].sort()[0], z = [p.due, ...p.steps.map(s => s.d)].sort().pop();
    const span = Math.max(1, days(a, z)), x = k => Math.min(100, Math.max(0, days(a, k) / span * 100));
    const nx = nextStep(p);
    const dots = p.steps.map(s => `<i class="pj-dot${s.done ? " on" : ""}${nx && s.id === nx.id ? " nx" : ""}" style="left:${x(s.d)}%" title="${esc(s.t)} · ${short(s.d)}"></i>`).join("");
    return `<div class="pj-tl"><div class="pj-line"><b style="width:${x(t)}%"></b></div>${dots}<i class="pj-now" style="left:${x(t)}%"></i><i class="pj-end" style="left:100%"></i></div>
      <div class="pj-tlk"><span>${short(a)}</span><span>Deadline · ${short(p.due)}</span></div>`;
  }
  function card(p) {
    const nx = nextStep(p), left = days(today(), p.due), done = !nx, isOpen = open === p.id;
    const late = nx && days(today(), nx.d) < 0;
    const steps = p.steps.map(s => `<li class="${s.done ? "done" : ""}"><button class="pj-ck" data-a="tick" data-p="${p.id}" data-s="${s.id}" aria-label="${s.done ? "Mark not done" : "Mark done"}: ${esc(s.t)}">${CK}</button><span><b>${esc(s.t)}</b>${s.w ? `<small>${esc(s.w)}</small>` : ""}</span><em>${short(s.d)}</em></li>`).join("");
    return `<article class="pj-card${isOpen ? " open" : ""}${done ? " fin" : ""}" data-id="${p.id}">
      <button class="pj-top" data-a="toggle" data-p="${p.id}" aria-expanded="${isOpen}">
        <span class="pj-name"><b>${esc(p.name)}</b><small>${p.goal ? esc(p.goal) : `${p.steps.length} steps`}</small></span>
        <span class="pj-left"><b>${done ? "Done" : left < 0 ? -left : left}</b><small>${done ? "all steps" : left < 0 ? "days late" : left === 1 ? "day left" : "days left"}</small></span>
      </button>
      ${timeline(p)}
      ${nx ? `<div class="pj-next${late ? " late" : ""}"><small>Next step · ${late ? "was due " : "due "}${rel(nx.d)}</small><b>${esc(nx.t)}</b>${nx.w ? `<span>Done when: ${esc(nx.w)}</span>` : ""}
        <button class="bt primary pj-donebtn" data-a="tick" data-p="${p.id}" data-s="${nx.id}">Mark done</button></div>`
        : `<div class="pj-next"><b>Every step is done.</b><span>Nice work. Remove it when you're ready.</span></div>`}
      <div class="pj-bar"><i style="width:${Math.round(pct(p) * 100)}%"></i></div>
      <div class="pj-more"><ul class="pj-steps">${steps}</ul>
        <div class="pj-acts"><button class="bt secondary" data-a="ask" data-p="${p.id}">Re-plan with Claude</button><button class="bt secondary pj-del" data-a="del" data-p="${p.id}">Remove project</button></div></div>
    </article>`;
  }
  function draw() {
    const box = $("projBox"); if (!box) return;
    const L = list();
    lastSig = sig();
    const soon = dueSoon(3);
    box.innerHTML = `<div class="pj-head"><div><h2>Projects.</h2><p>Long goals, one step at a time.</p></div><button class="bt secondary" data-a="add">${L.length ? "Add or update" : "Add a project"}</button></div>
      ${soon.length ? `<div class="pj-sugg"><div><small>Coming up in your projects</small>${soon.slice(0, 3).map(x => `<b>${esc(x.s.t)} <em>· ${rel(x.s.d)}</em></b>`).join("")}</div><button class="bt secondary" data-a="plan">Copy for planning</button></div>` : ""}
      ${L.length ? `<div class="pj-list">${[...L].sort((a, b) => (nextStep(a) ? 0 : 1) - (nextStep(b) ? 0 : 1) || (a.due < b.due ? -1 : 1)).map(card).join("")}</div>`
        : `<div class="pj-empty"><b>No projects yet.</b><span>Tell Claude your goal and deadline, then paste the plan here. Your UBC application is a good first one.</span></div>`}`;
  }

  /* ---------- sheet ---------- */
  function sheet() {
    let el = $("pjSheet"); if (el) return el;
    el = document.createElement("div"); el.id = "pjSheet"; el.className = "pj-sheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Add a project");
    el.innerHTML = `<div class="pj-panel"><div class="pj-grab"></div>
      <h3>Add or update a project</h3>
      <p>1. Copy the message for Claude and tell it your goal and deadline.<br>2. Paste the plan Claude gives you below. Same project name = update, and finished steps stay ticked.</p>
      <button class="bt secondary" id="pjCopy">Copy message for Claude</button>
      <textarea id="pjText" placeholder="${esc(EXAMPLE)}" spellcheck="false"></textarea>
      <p class="pj-msg" id="pjMsg" role="alert"></p>
      <div class="pj-row"><button class="bt secondary" id="pjCancel">Cancel</button><button class="bt primary" id="pjSave">Save project</button></div></div>`;
    document.body.appendChild(el);
    el.addEventListener("click", e => { if (e.target === el) hide(); });
    $("pjCancel").onclick = hide;
    $("pjSave").onclick = () => { const err = commit($("pjText").value); if (err) { $("pjMsg").textContent = err; return; } tap(); hide(); };
    $("pjCopy").onclick = () => copy(PROMPT(), $("pjCopy"));
    return el;
  }
  function show(text) { const el = sheet(); $("pjText").value = text || ""; $("pjMsg").textContent = ""; requestAnimationFrame(() => el.classList.add("on")); }
  function hide() { const el = $("pjSheet"); if (el) el.classList.remove("on"); }
  const FORMAT = `Project: <name> | due YYYY-MM-DD
Goal: <one line>
- <step> :: YYYY-MM-DD :: <done when…>`;
  const PROMPT = (p) => p
    ? `Help me re-plan my project "${p.name}" (deadline ${p.due}) for my ARVIN planner. Today is ${today()}.\nDone so far: ${p.steps.filter(s => s.done).map(s => s.t).join("; ") || "nothing yet"}.\nStill to do: ${p.steps.filter(s => !s.done).map(s => `${s.t} (${s.d})`).join("; ")}.\nAsk me what changed, then give me the updated plan as ONE code block in exactly this format (keep the same project name; keep finished steps with their names unchanged):\n${FORMAT}`
    : `Help me plan a project for my ARVIN planner. Today is ${today()}.\nAsk me for the goal and deadline (and anything else you need), then break it into 4–10 clear steps with realistic dates and a short "done when" for each, ordered by date.\nGive me the plan as ONE code block in exactly this format:\n${FORMAT}`;
  async function copy(text, btn) {
    try { await navigator.clipboard.writeText(text); const o = btn.textContent; btn.textContent = "Copied. Paste it to Claude"; setTimeout(() => btn.textContent = o, 2200); }
    catch (e) { prompt("Copy this:", text); }
  }

  /* ---------- actions ---------- */
  document.addEventListener("click", e => {
    const b = e.target.closest("#projBox [data-a]"); if (!b) return;
    const a = b.dataset.a, p = list().find(x => x.id === b.dataset.p);
    if (a === "add") show("");
    else if (a === "toggle") { open = open === p.id ? null : p.id; draw(); }
    else if (a === "tick" && p) { const s = p.steps.find(x => x.id === b.dataset.s); if (!s) return; s.done = !s.done; s.doneAt = s.done ? Date.now() : null; p.u = Date.now(); tap(); save();
      if (s.done) { const c = document.querySelector(`.pj-card[data-id="${p.id}"]`); if (c) { c.classList.add("pop"); setTimeout(() => c.classList.remove("pop"), 600); } } }
    else if (a === "ask" && p) copy(PROMPT(p), b);
    else if (a === "del" && p) { if (b.dataset.armed) { const L = list(); L.splice(L.indexOf(p), 1); open = null; save(); } else { b.dataset.armed = 1; b.textContent = "Tap again to remove"; setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = "Remove project"; } }, 2500); } }
    else if (a === "plan") {
      const soon = dueSoon(3);
      copy(`Help me plan tomorrow's Focus in my ARVIN planner. These project steps are coming up, so suggest which (if any) should be one of my three tasks:\n${soon.map(x => `- ${x.s.t} (${x.p.name}, due ${x.s.d})${x.s.w ? ` — done when: ${x.s.w}` : ""}`).join("\n")}`, b);
    }
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") hide(); });

  /* redraw when the other device changes something */
  function tick() { if (!document.hidden && sig() !== lastSig) draw(); }
  function start() { draw(); setInterval(tick, 2000); document.addEventListener("visibilitychange", tick); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(start, 50)); else setTimeout(start, 50);
})();
