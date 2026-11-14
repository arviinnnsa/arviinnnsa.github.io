/* Brain sync: keeps the app and the private ARVIN Brain sheet in step.
   - List: items added by Claude in the sheet appear in the app; the app's list is mirrored to the sheet.
   - Focus: day plans waiting in the sheet fill any day that has no plan yet.
   - School: a Grades block shows where each course stands and what you need for your target. */
(function () {
  "use strict";
  const B = () => window.apBrain;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = n => String(n).padStart(2, "0");
  const keyOf = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const today = () => keyOf(new Date());
  const ST = () => (window.apState && window.apState.get()) || null;
  const live = () => { const s = B() && B().get(); return s && s.status === "ready" ? s.data : null; };

  /* ---------- List ---------- */
  let mirrorSig = "", mirrorTimer = null, importing = false;
  const statusOf = t => t.done ? "Done" : t.st === "wait" ? "Waiting" : t.st === "later" ? "Later" : "Open";
  const rowsOf = todos => todos.map(t => [t.id, t.added ? keyOf(new Date(t.added)) : "", t.t || "", t.area || "", t.day || "", statusOf(t), t.src || "App"]);

  async function listIn(D) {
    const s = ST(); if (!s) return false;
    if (!Array.isArray(s.todos)) s.todos = [];
    const have = new Set(s.todos.map(t => t.id));
    let added = 0;
    for (const r of D.list || []) {
      const src = String(r.Source || ""), item = String(r.Item || "").trim();
      if (!item || /^app$/i.test(src)) continue;
      const id = String(r.ID || "") || "b" + r._row + "-" + item.slice(0, 12).replace(/\W/g, "");
      if (have.has(id) || s.todos.some(t => t.t === item && !t.done)) continue;
      const t = { id, t: item, day: /^\d{4}-\d\d-\d\d$/.test(r["Planned day"]) ? r["Planned day"] : "", done: /^done$/i.test(r.Status || ""), added: Date.now(), src: src || "Claude" };
      if (r.Area) t.area = r.Area;
      s.todos.push(t); have.add(id); added++;
    }
    if (added) { try { window.apState.save(true); window.apList && window.apList.draw(); } catch (e) {} }
    return added;
  }
  async function listOut() {
    const s = ST(); if (!s || !live() || importing) return;
    const rows = rowsOf(s.todos || []);
    /* never drop a row Claude added that this device hasn't picked up yet */
    const ids = new Set((s.todos || []).map(t => t.id)), names = new Set((s.todos || []).map(t => t.t));
    for (const r of live().list || []) {
      if (!r.Item || /^app$/i.test(String(r.Source || "")) || ids.has(String(r.ID)) || names.has(String(r.Item).trim())) continue;
      rows.push([r.ID || "", r.Added || "", r.Item, r.Area || "", r["Planned day"] || "", r.Status || "New", r.Source || "Claude"]);
    }
    const sig = JSON.stringify(rows);
    if (sig === mirrorSig) return;
    try {
      await B().clear("List!A2:G600");
      if (rows.length) await B().write("List!A2:G" + (rows.length + 1), rows);
      mirrorSig = sig;
    } catch (e) {}
  }
  const queueOut = () => { clearTimeout(mirrorTimer); mirrorTimer = setTimeout(listOut, 4000); };

  /* ---------- Focus ---------- */
  async function focusIn(D) {
    if (!window.apFocus) return;
    const t = today();
    for (const r of D.focus || []) {
      if (!r.Date || r.Date < t || !String(r.Plan || "").trim() || /in app|skip/i.test(r.Status || "")) continue;
      if (window.apFocus.has(r.Date)) continue;
      const err = window.apFocus.put(r.Date, String(r.Plan));
      try { await B().write(`Focus!C${r._row}`, [[err ? "Error: " + err : "In app"]]); } catch (e) {}
    }
  }

  /* ---------- Grades (School tab) ---------- */
  let editing = null;
  function gradesBox() {
    let el = $("brGrades");
    if (!el) {
      const sc = $("scBox"); if (!sc) return null;
      el = document.createElement("div"); el.id = "brGrades"; sc.before(el);
      el.addEventListener("click", onGrade);
      el.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.matches(".gr-in")) saveScore(+e.target.dataset.row); });
    }
    return el;
  }
  const num = v => (v === "" || v == null || isNaN(+v)) ? null : +v;
  function drawGrades() {
    const el = gradesBox(); if (!el) return;
    const s = B() && B().get(), D = s && s.data;
    if (!D || !(D.courses || []).length) { el.innerHTML = ""; return; }
    const target = +(D.settings || {}).grade_target || 85;
    el.innerHTML = `<div class="gr-head"><h3>Grades</h3><p>What you have, and what you need on the rest for ${target}%.</p></div>
      <div class="gr-list">${D.courses.map(c => {
        const cur = num(c["Current %"]), need = num(c["Needed on the rest %"]), graded = num(c["Graded weight %"]) || 0;
        const items = (D.grades || []).filter(g => g.Course === c.Code && g.Item);
        const open = editing && editing.course === c.Code;
        const needTxt = !graded ? "Add a mark to start" : need == null ? "All marks in" : need > 100 ? `Needs ${Math.round(need)}% on the rest. Aim as high as you can` : need <= 0 ? "Target already locked in" : `Need ${Math.round(need)}% on the rest`;
        return `<div class="gr-course${open ? " open" : ""}">
          <button class="gr-row" data-act="toggle" data-course="${esc(c.Code)}">
            <span class="gr-l"><b>${esc(c.Code)}</b><i>${esc(needTxt)}</i></span>
            <span class="gr-n">${cur == null ? "—" : Math.round(cur)}<small>${cur == null ? "" : "%"}</small></span>
          </button>
          ${open ? `<div class="gr-items">${items.map(g => {
            const sc = num(g["Score %"]), w = num(g["Weight %"]);
            return `<div class="gr-item"><span><b>${esc(g.Item)}</b><i>${w == null ? "weight?" : w + "% of grade"}</i></span>
              ${editing.row === g._row
                ? `<input class="gr-in" id="grW" type="number" inputmode="decimal" placeholder="weight" value="${w ?? ""}" data-row="${g._row}" aria-label="Weight percent"><input class="gr-in" id="grS" type="number" inputmode="decimal" placeholder="mark" value="${sc ?? ""}" data-row="${g._row}" aria-label="Mark percent"><button class="mo-pill blue sm" data-act="save" data-row="${g._row}">Save</button>`
                : `<button class="gr-score" data-act="edit" data-row="${g._row}">${sc == null ? "Add mark" : sc + "%"}</button>`}
            </div>`; }).join("")}</div>` : ""}
        </div>`; }).join("")}</div>`;
  }
  async function saveScore(row) {
    const w = $("grW"), sc = $("grS"); if (!w || !sc) return;
    const wv = w.value === "" ? "" : +w.value, sv = sc.value === "" ? "" : +sc.value;
    if ((wv !== "" && !(wv >= 0 && wv <= 100)) || (sv !== "" && !(sv >= 0 && sv <= 100))) { sc.focus(); return; }
    try {
      await B().write(`Grades!C${row}:E${row}`, [[wv, sv, sv === "" ? "Add score" : "Done"]]);
      B().log("Saved mark", "Grades", `row ${row}: ${sv}%`);
    } catch (e) { if (e && e.code === "auth") B().connect(); return; }
    editing = { course: editing.course, row: null };
    B().load();
  }
  function onGrade(e) {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const a = b.dataset.act;
    if (a === "toggle") { editing = editing && editing.course === b.dataset.course ? null : { course: b.dataset.course, row: null }; drawGrades(); }
    if (a === "edit") { editing = { course: editing.course, row: +b.dataset.row }; drawGrades(); setTimeout(() => $("grS")?.focus(), 30); }
    if (a === "save") saveScore(+b.dataset.row);
  }

  /* ---------- wiring ---------- */
  let lastAt = 0;
  async function onBrain(s) {
    drawGrades();
    if (s.status !== "ready" || !s.data || s.at === lastAt) return;
    lastAt = s.at; importing = true;
    try { await listIn(s.data); await focusIn(s.data); } catch (e) {}
    importing = false;
    listOut();
  }
  function start() {
    if (!B()) return;
    B().on(onBrain);
    onBrain(B().get());
    /* mirror the list a few seconds after it changes */
    let sig = "";
    setInterval(() => { const s = ST(); if (!s || !live()) return; const n = JSON.stringify(rowsOf(s.todos || [])); if (n !== sig) { sig = n; queueOut(); } }, 3000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
