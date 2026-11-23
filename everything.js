/* To do list: one long list of everything, with checkmarks.
   - Type anything into the box. It goes to "Everything".
   - Tap "Tomorrow" on any item to pick it for tomorrow (3 is the sweet spot).
   - Tomorrow's picks become "Today" the next day.
   - Anything not finished on its day quietly goes back to Everything, tagged "from Mon".
   Uses ST.todos (same data as the old List tab), so it syncs between iPhone and Mac
   and today's picks still show on the Today tab. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = n => String(n).padStart(2, "0");
  const keyOf = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const dOf = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const add = (k, n) => { const d = dOf(k); d.setDate(d.getDate() + n); return keyOf(d); };
  const today = () => keyOf(new Date());
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const DOWL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const short = k => { const d = dOf(k); return DOW[d.getDay()] + " " + MON[d.getMonth()] + " " + d.getDate(); };
  const uid = () => "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const tap = () => { try { window.apHaptic && window.apHaptic(); } catch (e) {} };
  const say = m => { try { window.toast && window.toast(m); } catch (e) {} };
  const CK = '<svg viewBox="0 0 12 12"><path d="M2 6.5l2.5 2.5L10 3.5"/></svg>';
  const GOAL = 3;

  const st = () => (window.apState && window.apState.get()) || null;
  const list = () => { const s = st(); if (!s) return []; if (!Array.isArray(s.todos)) s.todos = []; return s.todos; };
  let lastSig = "", open = null, showDone = false;
  const sig = () => JSON.stringify(list());
  const save = () => {
    lastSig = sig();
    window.apState && window.apState.save(true);
    draw();
    try { window.renderToday && window.renderToday(); } catch (e) {}
    try { window.apList && window.apList.draw(); } catch (e) {}
  };

  /* where an item shows */
  function where(t, k) {
    if (t.done) return "done";
    if (t.day === k) return "today";
    if (t.day === add(k, 1)) return "tomorrow";
    return "all";
  }
  const isRolled = (t, k) => !t.done && t.day && t.day < k;

  /* ---------- actions ---------- */
  function addItem(text) {
    const v = String(text || "").trim(); if (!v) return false;
    list().push({ id: uid(), t: v, day: "", done: false, added: Date.now() });
    tap(); save(); return true;
  }
  function setDay(t, day) { delete t.st; t.day = day; save(); }
  function setDone(t, on) {
    t.done = on; t.doneAt = on ? Date.now() : null;
    if (on) {
      tap();
      const k = today(), left = list().filter(x => !x.done && x.day === k).length;
      say(t.day === k ? (left ? `Done. ${left} left today.` : "Done. Today's list is clear.") : "Done.");
    }
    save();
  }

  /* ---------- views ---------- */
  function row(t, k, ctx) {
    const isOpen = open === t.id, tm = add(k, 1);
    const tags = [];
    if (ctx === "all" && isRolled(t, k)) tags.push(`<span class="ev-tag ev-from">from ${esc(DOWL[dOf(t.day).getDay()])}</span>`);
    else if (ctx === "all" && t.day && t.day > tm) tags.push(`<span class="ev-tag">${esc(short(t.day))}</span>`);
    if (ctx === "all" && t.st === "later") tags.push(`<span class="ev-tag">Later</span>`);
    if (ctx === "all" && t.st === "wait") tags.push(`<span class="ev-tag">Waiting</span>`);
    if (t.area) tags.push(`<span class="ev-tag">${esc(t.area)}</span>`);
    const picked = t.day === tm;
    const pick = ctx === "done" ? "" : ctx === "today"
      ? `<button class="ev-pick" data-a="later" data-id="${t.id}" aria-label="Move ${esc(t.t)} back to Everything">Not today</button>`
      : `<button class="ev-pick${picked ? " on" : ""}" data-a="pick" data-id="${t.id}" aria-pressed="${picked}">${picked ? `${CK}Tomorrow` : "Tomorrow"}</button>`;
    const more = isOpen ? `<div class="ev-more">
        ${t.day !== k ? `<button class="ev-mini" data-a="today" data-id="${t.id}">Do it today</button>` : ""}
        <label class="ev-mini">Pick a day<input type="date" data-a="date" data-id="${t.id}" value="${esc(t.day || "")}"></label>
        <button class="ev-mini" data-a="rename" data-id="${t.id}">Edit</button>
        <button class="ev-mini ev-del" data-a="del" data-id="${t.id}">Delete</button>
      </div>` : "";
    return `<li class="ev-item${t.done ? " done" : ""}${isOpen ? " open" : ""}" data-id="${t.id}">
      <button class="ev-ck" data-a="done" data-id="${t.id}" aria-pressed="${!!t.done}" aria-label="${t.done ? "Mark not done" : "Mark done"}: ${esc(t.t)}">${CK}</button>
      <button class="ev-body" data-a="open" data-id="${t.id}" aria-expanded="${isOpen}"><b>${esc(t.t)}</b>${tags.length ? `<span class="ev-tags">${tags.join("")}</span>` : ""}</button>
      ${pick}${more}</li>`;
  }

  function draw() {
    const box = $("evBox"); if (!box) return;
    const k = today(), L = list(); lastSig = sig();
    const by = w => L.filter(t => where(t, k) === w);
    const T = by("today"), TM = by("tomorrow");
    const A = by("all").sort((a, b) => (isRolled(b, k) - isRolled(a, k)) || ((a.added || 0) - (b.added || 0)));
    const D = by("done").sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
    const doneToday = D.filter(t => t.doneAt && keyOf(new Date(t.doneAt)) === k).length;
    const hour = new Date().getHours(), evening = hour >= 18;
    const tmNote = TM.length > GOAL ? `${TM.length} picked · that's a lot, ${GOAL} is plenty`
      : TM.length ? `${TM.length} of ${GOAL} picked` : "";
    const nudge = evening && !TM.length && A.length
      ? `<div class="ev-nudge"><b>Plan tomorrow</b><span>Tap <em>Tomorrow</em> on up to ${GOAL} things below.</span></div>` : "";

    box.innerHTML = `
      <div class="ev-head">
        <h2>To do.</h2>
        <p>Everything in one place. Pick what you'll do tomorrow.</p>
      </div>
      <form class="ev-add" id="evForm" autocomplete="off">
        <input id="evIn" class="ev-in" placeholder="Add something…" aria-label="Add to your list" enterkeyhint="done">
        <button class="ev-addbtn" aria-label="Add"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
      </form>
      ${nudge}
      <section class="ev-grp ev-today">
        <h3>Today${doneToday ? `<small>${doneToday} done</small>` : ""}</h3>
        ${T.length ? `<ul class="ev-list">${T.map(t => row(t, k, "today")).join("")}</ul>`
          : `<p class="ev-hint">${doneToday ? "All done for today." : "Nothing picked for today. Tap an item below to do it today."}</p>`}
      </section>
      <section class="ev-grp ev-tomorrow">
        <h3>Tomorrow${tmNote ? `<small class="${TM.length > GOAL ? "warn" : ""}">${tmNote}</small>` : ""}</h3>
        ${TM.length ? `<ul class="ev-list">${TM.map(t => row(t, k, "tomorrow")).join("")}</ul>`
          : `<p class="ev-hint">Nothing yet. Tap <em>Tomorrow</em> on anything in Everything.</p>`}
      </section>
      <section class="ev-grp ev-all">
        <h3>Everything<small>${A.length} ${A.length === 1 ? "thing" : "things"}</small></h3>
        ${A.length ? `<ul class="ev-list">${A.map(t => row(t, k, "all")).join("")}</ul>`
          : `<p class="ev-hint">Your list is empty. Type anything above: homework, errands, things you keep forgetting.</p>`}
      </section>
      ${D.length ? `<button class="ev-donebtn" data-a="showdone" aria-expanded="${showDone}">${showDone ? "Hide" : "Show"} done (${D.length})</button>
        ${showDone ? `<ul class="ev-list ev-donelist">${D.map(t => row(t, k, "done")).join("")}</ul>` : ""}` : ""}`;

    $("evForm").onsubmit = e => {
      e.preventDefault();
      const i = $("evIn");
      if (addItem(i.value)) { i.value = ""; say("Added."); setTimeout(() => $("evIn") && $("evIn").focus(), 0); }
    };
  }

  /* ---------- events ---------- */
  document.addEventListener("click", e => {
    const b = e.target.closest("#evBox [data-a]"); if (!b || b.tagName === "INPUT") return;
    const a = b.dataset.a, t = list().find(x => x.id === b.dataset.id), k = today();
    if (a === "showdone") { showDone = !showDone; draw(); return; }
    if (!t) return;
    if (a === "open") { open = open === t.id ? null : t.id; draw(); return; }
    if (a === "done") { const li = b.closest(".ev-item"); li.classList.add("pop"); setTimeout(() => setDone(t, !t.done), t.done ? 0 : 280); return; }
    if (a === "pick") {
      const tm = add(k, 1);
      if (t.day === tm) { setDay(t, ""); say("Back in Everything."); }
      else { tap(); setDay(t, tm); const n = list().filter(x => !x.done && x.day === tm).length; say(n > GOAL ? `${n} for tomorrow. Maybe drop one.` : `Added to tomorrow (${n} of ${GOAL}).`); }
      return;
    }
    if (a === "later") { setDay(t, ""); say("Back in Everything."); return; }
    if (a === "today") { open = null; setDay(t, k); say("Moved to today."); return; }
    if (a === "rename") { const v = prompt("Edit", t.t); if (v && v.trim()) { t.t = v.trim(); save(); } return; }
    if (a === "del") { if (!confirm(`Delete "${t.t}"?`)) return; const L = list(); L.splice(L.indexOf(t), 1); open = null; save(); say("Deleted."); return; }
  });
  document.addEventListener("change", e => {
    const i = e.target.closest("#evBox input[data-a=date]"); if (!i || !i.value) return;
    const t = list().find(x => x.id === i.dataset.id); if (!t) return;
    open = null; setDay(t, i.value); say(`Moved to ${short(i.value)}.`);
  });

  window.apEverything = { draw };
  function boot() { if (!st()) { setTimeout(boot, 300); return; } draw(); }
  boot();
  /* redraw when another device syncs a change, but never while typing */
  setInterval(() => { if (st() && sig() !== lastSig && !document.activeElement?.closest?.("#evBox")) draw(); }, 2000);
  let lastDay = today(), lastEve = new Date().getHours() >= 18;
  setInterval(() => {
    const eve = new Date().getHours() >= 18;
    if (today() !== lastDay || eve !== lastEve) { lastDay = today(); lastEve = eve; draw(); }
  }, 60000);
})();
