/* List: the master to-do list.
   - Dump anything into the box: one tap, no sorting, no dates.
   - Once a week you plan with Claude: "Plan my week" copies the list + your calendar,
     Claude's answer is pasted back and puts each item on a day, an area, Waiting or Later,
     and adds the small parts (chunks) you agreed on.
   - Unfinished items roll over to today on their own. Nothing turns red.
   Lives in ST.todos (same items as the old to-do list), so it syncs between iPhone and Mac
   and dated items still show on the Today tab. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = n => String(n).padStart(2, "0");
  const keyOf = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const dOf = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const add = (k, n) => { const d = dOf(k); d.setDate(d.getDate() + n); return keyOf(d); };
  const today = () => keyOf(new Date());
  const days = (a, b) => Math.round((dOf(b) - dOf(a)) / 864e5);
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], DOWL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const short = k => { const d = dOf(k); return DOW[d.getDay()] + " " + MON[d.getMonth()] + " " + d.getDate(); };
  const dayName = k => { const n = days(today(), k); return n === 0 ? "Today" : n === 1 ? "Tomorrow" : n > 1 && n < 7 ? DOWL[dOf(k).getDay()] : short(k); };
  const uid = () => "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const tap = () => { try { window.apHaptic && window.apHaptic(); } catch (e) {} };
  const say = m => { try { window.toast ? window.toast(m) : null; } catch (e) {} };
  const CK = '<svg viewBox="0 0 12 12"><path d="M2 6.5l2.5 2.5L10 3.5"/></svg>';

  const AREAS = [
    { k: "School", c: "#3b82c4" }, { k: "Work", c: "var(--k-work,#C99700)" }, { k: "Money", c: "#2f8f5b" },
    { k: "UBC", c: "#9a7a3a" }, { k: "Personal", c: "#7e5bc2" }, { k: "Tutoring", c: "var(--k-tutor,#9B3F74)" }
  ];
  const areaOf = a => AREAS.find(x => x.k.toLowerCase() === String(a || "").toLowerCase()) || null;

  /* ---------- state ---------- */
  const st = () => (window.apState && window.apState.get()) || null;
  const list = () => { const s = st(); if (!s) return []; if (!Array.isArray(s.todos)) s.todos = []; return s.todos; };
  let lastSig = "", open = null, shown = { done: false };
  const sig = () => JSON.stringify(list());
  const save = () => { lastSig = sig(); window.apState && window.apState.save(true); draw(); try { window.renderToday && window.renderToday(); } catch (e) {} };

  /* where an item sits right now */
  function place(t, k) {
    if (t.done) return "done";
    if (t.st === "wait") return "wait";
    if (t.st === "later") return "later";
    if (!t.day) return "inbox";
    if (t.day <= k) return "today";
    if (days(k, t.day) < 7) return "week";
    return "ahead";
  }
  const weekStart = k => add(k, -((dOf(k).getDay() + 6) % 7));
  const doneThisWeek = () => { const ws = dOf(weekStart(today())).getTime(); return list().filter(t => t.done && t.doneAt && t.doneAt >= ws); };

  /* calendar helpers (from the planner) */
  const evOn = k => { try { return typeof eventsOn === "function" ? eventsOn(k) : []; } catch (e) { return []; } };
  const kindOf = e => { try { return classify(e).key; } catch (x) { return ""; } };
  const isWorkDay = k => evOn(k).some(e => !e.allDay && kindOf(e) === "work");
  const hm = s => { const m = String(s || "").match(/T(\d\d):(\d\d)/); if (!m) return ""; let H = +m[1]; const M = m[2], ap = H < 12 ? "AM" : "PM"; H = H % 12 || 12; return M === "00" ? `${H} ${ap}` : `${H}:${M} ${ap}`; };

  /* ---------- actions ---------- */
  function addItem(text) {
    const v = String(text || "").trim(); if (!v) return false;
    list().push({ id: uid(), t: v, day: "", done: false, added: Date.now() });
    tap(); save(); return true;
  }
  function setDone(t, on) {
    t.done = on; t.doneAt = on ? Date.now() : null;
    if (on) { const n = doneThisWeek().length + 0; tap(); say(n === 1 ? "Done. First one this week." : `Done. ${n} finished this week.`); }
    save();
  }
  function move(t, where) {
    const k = today();
    delete t.st;
    if (where === "today") t.day = k;
    else if (where === "tomorrow") t.day = add(k, 1);
    else if (where === "wait") { t.st = "wait"; }
    else if (where === "later") { t.st = "later"; t.day = ""; }
    else if (where === "inbox") { t.day = ""; }
    else if (/^\d{4}-\d\d-\d\d$/.test(where)) t.day = where;
    save();
  }
  function tickChunk(t, i) {
    const c = t.ch && t.ch[i]; if (!c) return;
    c.d = !c.d; tap();
    if (t.ch.every(x => x.d) && !t.done) { t.done = true; t.doneAt = Date.now(); say("Every part done. Nice work."); }
    else if (c.d) { const left = t.ch.filter(x => !x.d).length; say(left === 1 ? "One part left." : `${left} parts left.`); }
    save();
  }

  /* ---------- views ---------- */
  function chip(a) { const A = areaOf(a); return A ? `<span class="ml-area" style="--ac:${A.c}">${esc(A.k)}</span>` : ""; }
  function row(t, k, opts = {}) {
    const isOpen = open === t.id, ch = t.ch || [], nx = ch.find(x => !x.d), nd = ch.filter(x => x.d).length;
    const rolled = !t.done && t.day && t.day < k && !t.st;
    const sub = [chip(t.area),
      nx ? `<span class="ml-next">Next: ${esc(nx.t)}</span>` : "",
      ch.length ? `<span class="ml-prog">${nd} of ${ch.length}</span>` : "",
      rolled ? `<span class="ml-from">from ${esc(DOWL[dOf(t.day).getDay()])}</span>` : "",
      opts.date && t.day ? `<span class="ml-from">${esc(short(t.day))}</span>` : "",
      t.st === "wait" && t.note ? `<span class="ml-from">${esc(t.note)}</span>` : ""].filter(Boolean).join("");
    const bar = ch.length ? `<i class="ml-bar"><b style="width:${Math.round(nd / ch.length * 100)}%"></b></i>` : "";
    const more = isOpen ? `<div class="ml-more">
        ${ch.length ? `<ol class="ml-chunks">${ch.map((c, i) => `<li class="${c.d ? "on" : ""}"><button class="ml-ck sm" data-a="chunk" data-id="${t.id}" data-i="${i}" aria-label="${c.d ? "Undo" : "Done"}: ${esc(c.t)}">${CK}</button><span>${esc(c.t)}</span></li>`).join("")}</ol>`
          : `<p class="ml-hint">No parts yet. If this feels big, we'll break it into parts together when you plan your week.</p>`}
        <div class="ml-acts">
          <button class="ml-pill" data-a="move" data-w="today" data-id="${t.id}">Today</button>
          <button class="ml-pill" data-a="move" data-w="tomorrow" data-id="${t.id}">Tomorrow</button>
          <label class="ml-pill ml-datep">Pick a day<input type="date" data-a="date" data-id="${t.id}" value="${esc(t.day || "")}"></label>
          <button class="ml-pill" data-a="move" data-w="wait" data-id="${t.id}">Waiting on</button>
          <button class="ml-pill" data-a="move" data-w="later" data-id="${t.id}">Later</button>
          ${t.day || t.st ? `<button class="ml-pill" data-a="move" data-w="inbox" data-id="${t.id}">Back to unsorted</button>` : ""}
        </div>
        <div class="ml-acts">${AREAS.map(A => `<button class="ml-pill ml-ap${t.area === A.k ? " on" : ""}" style="--ac:${A.c}" data-a="area" data-v="${A.k}" data-id="${t.id}">${A.k}</button>`).join("")}</div>
        <div class="ml-acts"><button class="ml-pill" data-a="rename" data-id="${t.id}">Edit text</button><button class="ml-pill ml-del" data-a="del" data-id="${t.id}">Delete</button></div>
      </div>` : "";
    return `<li class="ml-item${t.done ? " done" : ""}${isOpen ? " open" : ""}" data-id="${t.id}">
      <button class="ml-ck" data-a="done" data-id="${t.id}" aria-pressed="${!!t.done}" aria-label="${t.done ? "Mark not done" : "Mark done"}: ${esc(t.t)}">${CK}</button>
      <button class="ml-body" data-a="toggle" data-id="${t.id}" aria-expanded="${isOpen}"><b>${esc(t.t)}</b>${sub ? `<span class="ml-sub">${sub}</span>` : ""}${bar}</button>
      ${more}</li>`;
  }
  const group = (title, note, items, k, opts) => items.length ? `<section class="ml-grp"><h3>${title}${note ? `<small>${note}</small>` : ""}</h3><ul class="ml-list">${items.map(t => row(t, k, opts)).join("")}</ul></section>` : "";

  function draw() {
    const box = $("mlBox"); if (!box) return;
    const k = today(), L = list(); lastSig = sig();
    const by = p => L.filter(t => place(t, k) === p);
    const T = by("today"), W = by("week"), A = by("ahead"), I = by("inbox"), WT = by("wait"), LT = by("later"), D = doneThisWeek();
    const work = isWorkDay(k);
    const todayNote = work ? (T.length > 2 ? "Work day · that's a lot, pick two" : "Work day · keep it light") : "";
    /* this week, one block per day */
    const week = [];
    for (let i = 1; i < 7; i++) {
      const d = add(k, i), items = W.filter(t => t.day === d), wd = isWorkDay(d);
      if (!items.length && !wd) continue;
      week.push(`<div class="ml-day${wd ? " work" : ""}"><h4>${esc(dayName(d))}${wd ? `<small>${items.length > 2 ? "Work day · heavy, move one" : "Work day · keep it light"}</small>` : ""}</h4>
        ${items.length ? `<ul class="ml-list">${items.map(t => row(t, k)).join("")}</ul>` : `<p class="ml-hint">Nothing planned. Good, it's a work day.</p>`}</div>`);
    }
    const laterByArea = [...AREAS.map(a => a.k), ""].map(a => LT.filter(t => (t.area || "") === a)).filter(x => x.length);
    box.innerHTML = `
      <div class="ml-head"><div><h2>List.</h2><p>Everything on your mind, in one place. Dump it here, we sort it when you plan your week.</p></div></div>
      <form class="ml-add" id="mlForm" autocomplete="off">
        <input id="mlIn" class="ml-in" placeholder="Something on your mind?" aria-label="Add to your list" enterkeyhint="done">
        <button class="ml-addbtn" aria-label="Add"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
      </form>
      <div class="ml-plan">
        <div><b>Weekly plan</b><span>${I.length ? `${I.length} unsorted ${I.length === 1 ? "item" : "items"} waiting for your plan.` : "Everything is sorted."} Plan with Claude, then paste the plan here.</span></div>
        <div class="ml-planbtns"><button class="bt secondary" data-a="plan">Copy for Claude</button><button class="bt primary" data-a="paste">Paste plan</button></div>
      </div>
      ${D.length ? `<button class="ml-win" data-a="showdone"><b>${D.length}</b><span>finished this week${shown.done ? "" : " · see them"}</span></button>` : ""}
      ${shown.done && D.length ? `<ul class="ml-list ml-donelist">${[...D].sort((a, b) => b.doneAt - a.doneAt).map(t => row(t, k)).join("")}</ul>` : ""}
      ${T.length ? group("Today", todayNote, T, k) : `<section class="ml-grp"><h3>Today${todayNote ? `<small>${todayNote}</small>` : ""}</h3><p class="ml-hint">Nothing set for today. Pick one from below, or enjoy the space.</p></section>`}
      ${week.length ? `<section class="ml-grp"><h3>This week</h3>${week.join("")}</section>` : ""}
      ${group("Unsorted", "we'll sort these in your weekly plan", I, k)}
      ${group("Waiting on", "someone else has the next move", WT, k)}
      ${group("Coming up", "", A.sort((a, b) => a.day < b.day ? -1 : 1), k, { date: true })}
      ${laterByArea.length ? `<section class="ml-grp"><h3>Later<small>big things, out of sight until their week</small></h3>${laterByArea.map(g => `<ul class="ml-list">${g.map(t => row(t, k)).join("")}</ul>`).join("")}</section>` : ""}
      ${!L.filter(t => !t.done).length ? `<div class="ml-empty"><b>Your list is empty.</b><span>Type anything above: a task, an errand, a thing you keep forgetting.</span></div>` : ""}`;
    $("mlForm").onsubmit = e => { e.preventDefault(); const i = $("mlIn"); if (addItem(i.value)) { i.value = ""; say("Added to Unsorted."); setTimeout(() => $("mlIn") && $("mlIn").focus(), 0); } };
  }

  /* ---------- weekly plan: copy for Claude ---------- */
  function planText() {
    const k = today(), L = list().filter(t => !t.done);
    const cal = [];
    for (let i = 0; i < 8; i++) {
      const d = add(k, i), ev = evOn(d).filter(e => !e.free).map(e => {
        const kd = kindOf(e), tm = e.allDay ? "all day" : `${hm(e.start)}–${hm(e.end)}`;
        return `${kd === "work" ? "WORK " : kd === "exam" ? "EXAM " : kd === "due" ? "DUE " : ""}${e.title || "Event"} (${tm})`;
      });
      cal.push(`${short(d)}${isWorkDay(d) ? " [work day]" : ""}: ${ev.length ? ev.join("; ") : "free"}`);
    }
    const line = t => {
      const where = t.st === "wait" ? "waiting" : t.st === "later" ? "later" : t.day ? (t.day < k ? `was ${t.day} (rolled over)` : t.day) : "unsorted";
      const ch = (t.ch || []).map(c => (c.d ? "[done] " : "") + c.t);
      return `[${t.id}] ${t.t} | ${t.area || "no area"} | ${where}${ch.length ? `\n${ch.map(c => "   - " + c).join("\n")}` : ""}`;
    };
    return `Let's plan my week from my ARVIN List. Today is ${short(k)}.

How I want it planned:
- Up to 3 tasks on a normal day, 1–2 on a work day.
- Hard deadlines first, then exams, then everything else.
- Give each item one area: School, Work, Money, UBC, Personal or Tutoring.
- Big tasks get broken into parts, but ask me to agree on the parts before you add them. Each part is a visible action (no time estimates).
- Things that depend on someone else go to "waiting". Big projects that aren't this week go to "later".
- First talk it through with me. When we agree, give me the final plan in a code block in this exact format so I can paste it into the app:
  [id] Title | day | area          (day = a date like 2026-11-16, or today, tomorrow, waiting, later, done, delete)
     - part one                    (optional parts, one per line, under their item)
  [new] Title | day | area         (for anything new)

My calendar for the next 8 days:
${cal.join("\n")}

My list (${L.length} open):
${L.length ? L.map(line).join("\n") : "(empty)"}`;
  }

  /* ---------- weekly plan: paste back ---------- */
  function parseDay(s, k) {
    s = String(s || "").trim().toLowerCase();
    if (!s) return null;
    if (s === "today") return k; if (s === "tomorrow") return add(k, 1);
    let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
    m = s.match(/([a-z]{3})[a-z]*\.?\s+(\d{1,2})/);
    if (m) { const mi = MON.findIndex(x => x.toLowerCase() === m[1]); if (mi >= 0) { const y = dOf(k).getFullYear(); let r = `${y}-${pad(mi + 1)}-${pad(+m[2])}`; if (days(k, r) < -60) r = `${y + 1}-${pad(mi + 1)}-${pad(+m[2])}`; return r; } }
    const wi = DOW.findIndex(x => s.startsWith(x.toLowerCase()));
    if (wi >= 0) { for (let i = 0; i < 7; i++) { const d = add(k, i); if (dOf(d).getDay() === wi) return d; } }
    return null;
  }
  function applyPlan(text) {
    const k = today(), L = list(), lines = String(text).replace(/\r/g, "").split("\n");
    let cur = null, chunks = null, n = { up: 0, add: 0, del: 0 }, bad = [];
    const flush = () => {
      if (cur && chunks) { const old = cur.ch || []; cur.ch = chunks.map(t => ({ t, d: !!(old.find(o => o.t.toLowerCase() === t.toLowerCase()) || {}).d })); }
      cur = null; chunks = null;
    };
    for (const raw of lines) {
      const l = raw.trim(); if (!l || l.startsWith("```")) continue;
      const m = l.match(/^\[([^\]]+)\]\s*(.*)$/);
      if (m) {
        flush();
        const id = m[1].trim(), parts = m[2].split("|").map(x => x.trim());
        const title = parts[0] && parts[0] !== "=" ? parts[0] : "";
        let t = id.toLowerCase() === "new" ? null : L.find(x => x.id === id);
        if (!t && id.toLowerCase() !== "new") { bad.push(id); continue; }
        if (!t) { if (!title) continue; t = { id: uid(), t: title, day: "", done: false, added: Date.now() }; L.push(t); n.add++; } else { if (title) t.t = title; n.up++; }
        for (const p of parts.slice(1)) {
          const v = p.toLowerCase(), A = areaOf(p);
          if (!v || v === "no area") continue;
          if (A) { t.area = A.k; continue; }
          if (v === "waiting" || v === "wait") { t.st = "wait"; continue; }
          if (v === "later") { t.st = "later"; t.day = ""; continue; }
          if (v === "unsorted") { delete t.st; t.day = ""; continue; }
          if (v === "done") { t.done = true; t.doneAt = Date.now(); continue; }
          if (v === "delete") { const i = L.indexOf(t); if (i >= 0) { L.splice(i, 1); n.del++; n.up--; } t = null; break; }
          const d = parseDay(p, k); if (d) { t.day = d; delete t.st; continue; }
          if (/^waiting\b/i.test(p)) { t.st = "wait"; t.note = p.replace(/^waiting( on)?\s*/i, ""); }
        }
        cur = t; chunks = null; continue;
      }
      const c = l.match(/^[-•*]\s+(.*)$/);
      if (c && cur) { (chunks = chunks || []).push(c[1].replace(/^\[done\]\s*/i, "").trim()); continue; }
    }
    flush();
    if (!n.up && !n.add && !n.del) return { error: bad.length ? `Couldn't find ${bad.length === 1 ? "that item" : "those items"} (${bad.slice(0, 3).join(", ")}). Copy for Claude again so the ids are fresh.` : 'Paste the plan Claude gave you. Each line starts with an id in brackets, like "[t1abc] Title | today | School".' };
    save();
    return { msg: `Plan saved: ${n.up} updated${n.add ? `, ${n.add} added` : ""}${n.del ? `, ${n.del} deleted` : ""}.${bad.length ? ` ${bad.length} not found.` : ""}` };
  }

  /* ---------- sheet ---------- */
  function sheet() {
    let el = $("mlSheet"); if (el) return el;
    el = document.createElement("div"); el.id = "mlSheet"; el.className = "pj-sheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Paste your weekly plan");
    el.innerHTML = `<div class="pj-panel"><div class="pj-grab"></div>
      <h3>Paste your weekly plan</h3>
      <p>Paste the plan Claude gave you. Items move to their day, get their area and their parts. Parts you already ticked stay ticked.</p>
      <textarea id="mlText" spellcheck="false" placeholder="[t1abc] Accounting HW 8 | 2026-11-15 | School&#10;   - Questions 1–5&#10;   - Questions 6–10&#10;[new] Buy Jordan's gift | today | Personal"></textarea>
      <p class="pj-msg" id="mlMsg" role="alert"></p>
      <div class="pj-row"><button class="bt secondary" id="mlCancel">Cancel</button><button class="bt primary" id="mlSave">Save plan</button></div></div>`;
    document.body.appendChild(el);
    el.addEventListener("click", e => { if (e.target === el) hide(); });
    $("mlCancel").onclick = hide;
    $("mlSave").onclick = () => { const r = applyPlan($("mlText").value); if (r.error) { $("mlMsg").textContent = r.error; return; } tap(); hide(); say(r.msg); };
    return el;
  }
  function show() { const el = sheet(); $("mlText").value = ""; $("mlMsg").textContent = ""; requestAnimationFrame(() => el.classList.add("on")); setTimeout(() => $("mlText").focus(), 250); }
  function hide() { const el = $("mlSheet"); if (el) el.classList.remove("on"); }
  async function copy(text, btn) {
    try { await navigator.clipboard.writeText(text); }
    catch (e) { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (x) {} ta.remove(); }
    if (btn) { const o = btn.textContent; btn.textContent = "Copied. Paste it to Claude"; setTimeout(() => { btn.textContent = o; }, 2400); }
  }

  /* ---------- events ---------- */
  document.addEventListener("click", e => {
    const b = e.target.closest("#mlBox [data-a]"); if (!b || b.tagName === "INPUT") return;
    const a = b.dataset.a, t = list().find(x => x.id === b.dataset.id);
    if (a === "toggle" && t) { open = open === t.id ? null : t.id; draw(); return; }
    if (a === "done" && t) { b.closest(".ml-item").classList.add("pop"); setTimeout(() => setDone(t, !t.done), t.done ? 0 : 260); return; }
    if (a === "chunk" && t) { tickChunk(t, +b.dataset.i); return; }
    if (a === "move" && t) { move(t, b.dataset.w); say(b.dataset.w === "wait" ? "Moved to Waiting on." : b.dataset.w === "later" ? "Moved to Later." : b.dataset.w === "inbox" ? "Back in Unsorted." : `Moved to ${b.textContent.toLowerCase()}.`); return; }
    if (a === "area" && t) { t.area = t.area === b.dataset.v ? "" : b.dataset.v; save(); return; }
    if (a === "rename" && t) { const v = prompt("Edit", t.t); if (v && v.trim()) { t.t = v.trim(); save(); } return; }
    if (a === "del" && t) { if (!confirm(`Delete "${t.t}"?`)) return; const L = list(); L.splice(L.indexOf(t), 1); open = null; save(); say("Deleted."); return; }
    if (a === "showdone") { shown.done = !shown.done; draw(); return; }
    if (a === "plan") { copy(planText(), b); return; }
    if (a === "paste") { show(); return; }
  });
  document.addEventListener("change", e => {
    const i = e.target.closest("#mlBox input[data-a=date]"); if (!i) return;
    const t = list().find(x => x.id === i.dataset.id); if (t && i.value) { move(t, i.value); say(`Moved to ${dayName(i.value).toLowerCase() === "today" ? "today" : dayName(i.value)}.`); }
  });
  /* opening the List tab puts the cursor in the box, so adding is one tap */
  document.addEventListener("click", e => {
    if (!e.target.closest('[data-t="todo"]')) return;
    const i = $("mlIn"); if (i && matchMedia("(hover:hover)").matches) setTimeout(() => i.focus({ preventScroll: true }), 60);
  }, true);

  window.apList = { draw, planText, applyPlan };
  function boot() { if (!st()) { setTimeout(boot, 300); return; } draw(); }
  boot();
  setInterval(() => { if (st() && sig() !== lastSig && !document.activeElement?.closest?.("#mlBox")) draw(); }, 2000);
  let lastDay = today(); setInterval(() => { if (today() !== lastDay) { lastDay = today(); draw(); } }, 60000);
})();
