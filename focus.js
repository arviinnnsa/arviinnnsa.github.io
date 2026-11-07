/* Focus: today's three big tasks + a short errands card.
   Plans are pasted in from Claude (see the "Add today's plan" sheet for the format).
   Progress is saved on this device, one plan per day. No times are shown on purpose. */
(function () {
  "use strict";

  const $ = id => document.getElementById(id);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const dayKey = (off = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + off);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };

  /* scene kinds: picture scenes use the three illustrations; "plain" is a colour fill for anything else */
  const SC = {
    brief: { img: "brief", align: "max", k: "#c9a46b" },
    fmgt:  { img: "fmgt",  align: "max", k: "#6fa8dc" },
    gym:   { img: "gym0",  align: "mid", k: "#e0745c" },
    plain: { img: null,    align: "mid", k: "#8fa3b8" }
  };
  const IC = {
    open: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    ask: '<svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>'
  };
  const CK = '<svg viewBox="0 0 12 12"><path d="M2 6.5l2.5 2.5L10 3.5"/></svg>';

  const EX_TEXT = `Briefing note | POLI 1100 | brief | Open Google Doc
- Open the doc and write the title :: The doc exists and has a title. That's it.
- Outline the three sections :: 3 headings, 2 bullet points under each.
- Background + options :: One background paragraph and 2–3 options, one line each.
- Recommendation + proofread :: One clear recommendation, and you've read it out loud once.
+ Briefing note workshop :: Oct 1
+ How to write a briefing note :: POLI lesson

Accounting HW 7 | FMGT 1115 · due Sun 11:29 PM | fmgt | Open MyLab
- Questions 1–5 :: 5 answers saved in MyLab.
- Questions 6–10 :: All 10 submitted, score showing.
+ Ch 6 lesson: inventory costing :: School tab

Gym: push day | Personal | gym | Open your routine
- Warm-up :: 5 min on the bike and band pull-aparts.
- Main lifts :: Every set of bench and overhead press.
- Finisher :: Dips and triceps until you can't.

Errands
- Book dentist appointment
- Buy shampoo
- Return package
- Pick up groceries`;

  /* ---------- storage: ST.focus = { "YYYY-MM-DD": { tasks, errands } } ----------
     Lives in the app's own synced state (ST), so it follows the account to other devices. */
  let lastSig = "";
  const appState = () => (window.apState && window.apState.get()) || null;
  const bag = () => {
    const s = appState();
    if (!s) return {};
    if (!s.focus || typeof s.focus !== "object") s.focus = {};
    return s.focus;
  };
  const today = () => bag()[dayKey()] || null;
  const sig = () => JSON.stringify(today());
  const save = () => { lastSig = sig(); if (window.apState) window.apState.save(); };
  const prune = () => {
    const b = bag(), t = dayKey();
    let changed = false;
    for (const k of Object.keys(b)) if (k < t) { delete b[k]; changed = true; }
    return changed;
  };

  /* ---------- plan text <-> data ---------- */
  function parse(text, all) {
    let lines = String(text).replace(/\r/g, "").split("\n");
    let date = dayKey();
    const first = (lines.find(l => l.trim()) || "").trim();
    if (/^for tomorrow$/i.test(first)) { date = dayKey(1); lines = lines.slice(lines.indexOf(first) + 1); }
    const blocks = lines.join("\n").trim().split(/\n\s*\n/)
      .map(b => b.split("\n").map(s => s.trim()).filter(Boolean)).filter(b => b.length);
    const tasks = [], errands = [];
    blocks.forEach((b, bi) => {
      if (/^errands$/i.test(b[0])) {
        b.slice(1).forEach(l => { const t = l.replace(/^[-•]\s*/, "").trim(); if (t) errands.push({ t, done: false }); });
        return;
      }
      const h = b[0].split("|").map(s => s.trim());
      const sc = (h[2] || "plain").toLowerCase();
      const task = { id: "t" + bi + Math.random().toString(36).slice(2, 7), t: h[0] || "Untitled", tag: h[1] || "",
        scene: SC[sc] ? sc : "plain", open: h[3] || "", url: h[4] || "", mat: [], parts: [], n: 0, left: "" };
      b.slice(1).forEach(l => {
        if (/^-\s/.test(l)) { const [a, ...r] = l.slice(2).split("::"); task.parts.push([a.trim(), r.join("::").trim() || "Done when it's finished."]); }
        else if (/^\+\s/.test(l)) { const [a, ...r] = l.slice(2).split("::"); task.mat.push([a.trim(), r.join("::").trim()]); }
      });
      if (task.parts.length) tasks.push(task);
    });
    if (tasks.length > 3) return { error: `That's ${tasks.length} big tasks. Keep it to three.` };
    if (errands.length > 4) return { error: "The street has 4 shops, so keep errands to 4." };
    if (!tasks.length && !errands.length) return { error: "Nothing to save yet. Add a task with its parts, or an Errands list." };
    /* editing a plan keeps progress for tasks and errands whose names haven't changed */
    const prev = all[date];
    const keep = prev && prev.tasks;
    if (prev) {
      tasks.forEach(t => { const o = keep.find(x => x.t === t.t); if (o && o.parts.length === t.parts.length) { t.n = o.n; t.left = o.left; } });
      errands.forEach(e => { const o = prev.errands.find(x => x.t === e.t); if (o) e.done = o.done; });
    }
    return { date, plan: { tasks, errands } };
  }

  function toText(p) {
    const o = [];
    p.tasks.forEach(t => {
      o.push([t.t, t.tag, t.scene, t.open, t.url].join(" | ").replace(/(\s\|\s)+$/, ""));
      t.parts.forEach(q => o.push(`- ${q[0]} :: ${q[1]}`));
      t.mat.forEach(m => o.push(`+ ${m[0]}${m[1] ? " :: " + m[1] : ""}`));
      o.push("");
    });
    if (p.errands.length) { o.push("Errands"); p.errands.forEach(e => o.push("- " + e.t)); }
    return o.join("\n").trim();
  }

  function commit(text) {
    const r = parse(text, bag());
    if (r.error) return r.error;
    bag()[r.date] = r.plan;
    prune(); save(); buildAll();
    return null;
  }

  const getTask = id => (today()?.tasks || []).find(t => t.id === id) || null;
  const errFrac = () => { const e = today()?.errands || []; return e.length ? e.filter(x => x.done).length / e.length : 0; };

  /* ---------- scenes ---------- */
  const xl = y => 550 - .392 * (y - 466), xr = y => 903 - .387 * (y - 466);
  const para = (y0, y1, a, b) => `${a(y0)},${y0} ${b(y0)},${y0} ${b(y1)},${y1} ${a(y1)},${y1}`;
  const STORY = {
    brief: () => {
      const band = (y0, y1) => `<polygon class="fo-patch" fill="#f3efe5" points="${para(y0, y1, y => xl(y) + 7, y => xr(y) - 12)}"/>`;
      return [[band(479, 505)], [band(516, 552)], [band(556, 592), band(596, 632)], [band(636, 672)]]
        .map((g, k) => `<g data-p="${k}">${g.join("")}</g>`).join("");
    },
    fmgt: () => {
      const L = y => 500 - .34 * (y - 470), R2 = y => 752 - .34 * (y - 470);
      const band = (f, y, c) => `<polygon class="fo-patch" fill="${c}" points="${para(y - 6, y + 6, y => f(y) + 10, y => f(y) + 246)}"/>`;
      const g0 = [497, 515, 533, 551, 569, 587, 605].map(y => band(L, y, "#f4efe3"));
      const g1 = [515, 533, 551, 569, 587, 605].map(y => band(R2, y, "#efece0"));
      const calc = `<g class="fo-calc" transform="rotate(-5 1115 478)"><rect x="1064" y="458" width="102" height="42" rx="5" fill="#89b9a0"/><text x="1150" y="490" text-anchor="end" font-family="Hanken Grotesk,Arial" font-size="24" font-weight="500" fill="#1f3a2c">68,092</text></g>`;
      return calc + `<g data-p="0">${g0.join("")}</g><g data-p="1">${g1.join("")}</g>`;
    },
    gym: () => [1, 2, 3].map(k => `<g data-p="${k - 1}"><image class="fo-rev" href="img/focus/gym${k}.webp" x="0" y="0" width="1200" height="760"/></g>`).join("")
  };

  /* kind: "err" | a SC key. id: task id, or "err" */
  const live = [];
  function makeScene(host, kind, id) {
    const el = document.createElement("div");
    el.className = "fo-scene";
    if (kind === "err") {
      el.innerHTML = `<div class="fo-lay"><svg viewBox="0 0 1200 760" preserveAspectRatio="xMidYMax slice">${window.STREET_SVG || ""}</svg></div><canvas></canvas><div class="fo-shine"></div>`;
    } else if (kind === "plain") {
      el.style.setProperty("--k", SC.plain.k);
      el.innerHTML = `<div class="fo-plain"></div><div class="fo-fill"></div><div class="fo-shine"></div>`;
    } else {
      const k = SC[kind];
      const asp = k.align === "max" ? "xMidYMax slice" : "xMidYMid slice";
      const op = k.align === "max" ? "50% 100%" : "50% 50%";
      const layer = cls => `<div class="fo-lay ${cls}"><img src="img/focus/${k.img}.webp" alt="" style="object-position:${op}"><svg viewBox="0 0 1200 760" preserveAspectRatio="${asp}">${STORY[kind]()}</svg></div>`;
      el.innerHTML = layer("fo-grey") + layer("fo-colr") + `<canvas></canvas><div class="fo-shine"></div>`;
    }
    host.prepend(el);
    const s = { el, cv: el.querySelector("canvas"), kind, id, align: (kind === "err" || SC[kind]?.align === "max") ? "max" : "mid" };
    live.push(s);
    return s;
  }

  function fracOf(s) {
    if (s.kind === "err") return errFrac();
    const t = getTask(s.id);
    return t ? t.n / t.parts.length : 0;
  }

  function paintScene(s, anim) {
    const el = s.el, f = fracOf(s);
    el.style.setProperty("--f", f.toFixed(3));
    if (s.kind === "err") {
      const errs = today()?.errands || [];
      el.querySelectorAll(".shop").forEach(sh => sh.classList.toggle("lit", !!errs[+sh.dataset.i]?.done));
    } else if (s.kind !== "plain") {
      const t = getTask(s.id);
      if (t) {
        const n = t.parts.length, all = t.n >= n;
        el.querySelectorAll("g[data-p]").forEach(g => {
          const p = +g.dataset.p, show = all || p < t.n;
          g.querySelectorAll(".fo-patch").forEach((q, j) => { q.style.transitionDelay = anim && show ? (.15 + j * .1) + "s" : "0s"; q.classList.toggle("off", show); });
          g.querySelectorAll(".fo-rev").forEach(q => q.classList.toggle("on", show));
        });
        el.querySelectorAll(".fo-calc").forEach(e => e.style.opacity = all ? 1 : 0);
      }
    }
    if (anim) { const sh = el.querySelector(".fo-shine"); sh.classList.remove("on"); void sh.offsetWidth; sh.classList.add("on"); }
  }

  /* light motion that grows with progress */
  const dust = [...Array(60)].map(() => ({ x: Math.random(), y: Math.random(), z: Math.random(), p: Math.random() * 6 }));
  function drawScene(s, t) {
    const cv = s.cv;
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    if (!r.width) return;
    const d = Math.min(2, devicePixelRatio || 1), W = Math.round(r.width * d), H = Math.round(r.height * d);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const g = cv.getContext("2d");
    g.clearRect(0, 0, W, H);
    const m = fracOf(s);
    if (m <= 0) return;
    const sc = Math.max(W / 1200, H / 760), ox = (W - 1200 * sc) / 2, oy = s.align === "max" ? H - 760 * sc : (H - 760 * sc) / 2;
    g.save(); g.translate(ox, oy); g.scale(sc, sc);
    g.globalCompositeOperation = "lighter";
    if (s.kind === "err") {
      [330, 860].forEach((x, k) => {
        const a = .18 * m * (.75 + .25 * Math.sin(t * 2 + k));
        const rg = g.createRadialGradient(x, 300, 0, x, 300, 140);
        rg.addColorStop(0, `rgba(255,217,160,${a})`); rg.addColorStop(1, "rgba(255,217,160,0)");
        g.fillStyle = rg; g.fillRect(x - 140, 160, 280, 280);
      });
    } else if (s.kind !== "plain") {
      const reg = s.kind === "gym" ? { x0: 300, w: 900, h: 640 } : { x0: 490, w: 490, h: s.kind === "brief" ? 455 : 440 };
      for (const p of dust) {
        const py = (((p.y - t * .01 * (.4 + p.z)) % 1 + 1) % 1) * reg.h;
        const px = reg.x0 + p.x * reg.w + Math.sin(t * .4 + p.p) * 6;
        g.fillStyle = `rgba(255,235,200,${.5 * m * (.3 + p.z)})`;
        g.beginPath(); g.arc(px, py, 1.2 + p.z * 1.8, 0, 7); g.fill();
      }
    }
    g.globalCompositeOperation = "source-over";
    g.restore();
  }
  const t0 = performance.now();
  (function loop(now) {
    const t = (now - t0) / 1000;
    for (let i = live.length - 1; i >= 0; i--) if (!live[i].el.isConnected) live.splice(i, 1);
    for (const s of live) drawScene(s, reduce ? 3 : t);
    requestAnimationFrame(loop);
  })(t0);

  /* ---------- sound + toast ---------- */
  let ac = null;
  function chime(v) {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const t = ac.currentTime;
      [880, 1318.5].forEach((f, k) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = "sine"; o.frequency.value = f;
        g.gain.setValueAtTime(0, t + k * .09);
        g.gain.linearRampToValueAtTime(.1 * (v || 1), t + k * .09 + .01);
        g.gain.exponentialRampToValueAtTime(.0001, t + k * .09 + .8);
        o.connect(g).connect(ac.destination); o.start(t + k * .09); o.stop(t + k * .09 + .9);
      });
    } catch (e) {}
  }
  let tt;
  function toast(m) {
    const el = $("foToast");
    el.textContent = m; el.classList.add("on");
    clearTimeout(tt); tt = setTimeout(() => el.classList.remove("on"), 1800);
  }

  /* ---------- DOM: section, cards, errands ---------- */
  let box, cardsEl, emptyEl, linksEl, errEl = null, cards = new Map(), curId = null, pageScene = null, curDay = dayKey();
  let pageEl, lowEl, sheet, closedEl;

  const OVERLAYS = `
  <div id="foSheet" role="dialog" aria-modal="true" aria-labelledby="foSheetT"><div class="fo-sb">
    <h3 id="foSheetT">Today's plan</h3>
    <p class="fo-hint">Paste the plan Claude wrote. First line is the task: <b>Title | tag | scene | open button | link</b> (scene is brief, fmgt, gym or plain; the last two are optional). Each part is a line starting with "- " and "::" before the done-when. Materials start with "+ ". Errands go in a block that starts with "Errands". Start with "For tomorrow" to plan the day ahead.</p>
    <textarea class="fo-ta" id="foText" spellcheck="false" placeholder="Paste the plan here"></textarea>
    <p class="fo-msg" id="foMsg" role="status"></p>
    <div class="fo-btns"><button class="fo-pill o" id="foCancel">Cancel</button><button class="fo-pill b" id="foSave">Save plan</button></div>
  </div></div>
  <div id="foPage" aria-hidden="true">
    <div class="fo-ppic" id="foPic"><div class="fo-ov"><button class="fo-bk" id="foBack">‹ Back</button><div class="fo-tg" id="foTag"></div><h3 id="foTitle"></h3></div></div>
    <div class="fo-low" id="foLow"></div>
  </div>
  <div id="foClosed" hidden role="dialog" aria-label="Day closed"><div class="fo-strip" id="foStrip"></div><h4>Day closed</h4><p>Everything is in colour.</p><div class="fo-btns" style="width:min(720px,calc(100% - 32px))"><button class="fo-pill b" id="foCloseDay">Done</button></div></div>
  <div id="foToast" class="fo-toast" role="status"></div>`;

  function start() {
    box = $("focusBox");
    if (!box) return;
    document.body.insertAdjacentHTML("beforeend", OVERLAYS);
    box.innerHTML = `
      <div class="fo-head"><div><h2>Focus</h2><p>Three big things today, and a few quick ones.</p></div>
        <div class="fo-count"><b id="foTot"></b><span>parts done</span></div></div>
      <div class="fo-cards" id="foCards"></div>
      <div id="foEmpty"></div>
      <div class="fo-links" id="foLinks"></div>`;
    cardsEl = $("foCards"); emptyEl = $("foEmpty"); linksEl = $("foLinks");
    pageEl = $("foPage"); lowEl = $("foLow"); sheet = $("foSheet"); closedEl = $("foClosed");

    box.addEventListener("click", e => {
      const b = e.target.closest("[data-l]");
      if (!b) return;
      const l = b.dataset.l;
      if (l === "add") openSheet("");
      else if (l === "edit") openSheet(toText(today()));
      else if (l === "example") { const err = commit(EX_TEXT); if (err) toast(err); }
      else if (l === "reset") reset();
    });

    $("foSave").onclick = () => {
      const err = commit($("foText").value);
      if (err) { $("foMsg").textContent = err; return; }
      closeSheet(); toast("Plan saved.");
    };
    $("foCancel").onclick = closeSheet;
    sheet.addEventListener("click", e => { if (e.target === sheet) closeSheet(); });
    $("foBack").onclick = closePage;
    $("foCloseDay").onclick = () => { closedEl.classList.remove("go"); closedEl.hidden = true; };

    lowEl.addEventListener("click", e => {
      const a = e.target.closest("[data-a],#foStop,#foDone,#foBack2");
      if (!a || curId == null) return;
      const t = getTask(curId);
      if (a.id === "foDone") finish(curId);
      else if (a.id === "foBack2") closePage();
      else if (a.id === "foStop") stopClick(t);
      else if (a.dataset.a === "open") openLink(t);
      else if (a.dataset.a === "ask") askPrompt(t);
    });

    document.addEventListener("keydown", e => {
      if (e.key !== "Escape") return;
      closeSheet();
      if (pageEl.classList.contains("open")) closePage();
    });

    /* new day, or a change that arrived from another device: rebuild (not while the task page is open) */
    setInterval(() => {
      if (pageEl.classList.contains("open")) return;
      if (dayKey() !== curDay) { curDay = dayKey(); if (prune()) save(); buildAll(); return; }
      if (sig() !== lastSig) buildAll();
    }, 3000);

    if (prune()) save();
    buildAll();
  }

  function buildAll() {
    if (!cardsEl) return;
    cardsEl.innerHTML = "";
    cards = new Map();
    errEl = null;
    live.length = 0;
    if (pageScene) { pageScene.el.remove(); pageScene = null; }
    const p = today();
    if (p) {
      p.tasks.forEach(t => {
        const el = document.createElement("div");
        el.className = "fo-card";
        el.setAttribute("role", "button");
        el.tabIndex = 0;
        el.innerHTML = `<div class="fo-ov"><div class="fo-r1"><div><b>${esc(t.t)}</b><i><span class="fo-dot" style="background:${SC[t.scene].k}"></span>${esc(t.tag)}</i></div><span class="fo-fr"></span><span class="fo-ok">${CK}</span></div><div class="fo-bo"><small></small><b></b><span></span></div></div>`;
        makeScene(el, t.scene, t.id);
        el.addEventListener("click", () => openTask(t.id));
        el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openTask(t.id); } });
        cardsEl.appendChild(el);
        cards.set(t.id, el);
      });
      if (p.errands.length) {
        errEl = document.createElement("div");
        errEl.className = "fo-err";
        errEl.innerHTML = `<div class="fo-pic"><div class="fo-ov"><div class="fo-r1"><div><b>Errands</b><i><span class="fo-dot" style="background:#8fc49a"></span>Quick ones · a bonus</i></div><span class="fo-fr"></span></div></div></div><ul>${p.errands.map((e, i) => `<li data-i="${i}"><span class="fo-c">${CK}</span><span>${esc(e.t)}</span></li>`).join("")}</ul>`;
        makeScene(errEl.querySelector(".fo-pic"), "err", "err");
        errEl.querySelector("ul").addEventListener("click", e => {
          const li = e.target.closest("li");
          if (li) toggleErr(+li.dataset.i);
        });
        cardsEl.appendChild(errEl);
      }
    }
    cardsEl.hidden = !(p && (p.tasks.length || p.errands.length));
    lastSig = sig();
    refresh(null);
  }

  function refresh(changed) {
    if (!cardsEl) return;
    const p = today(), tasks = p ? p.tasks : [], errs = p ? p.errands : [];
    const has = tasks.length || errs.length;
    emptyEl.innerHTML = has ? "" : emptyHTML();
    linksEl.innerHTML = p
      ? `<button data-l="edit">Edit plan</button><button data-l="reset">Reset progress</button>`
      : `<button data-l="add">Add today's plan</button><button data-l="example">Try the example</button>`;

    const d = tasks.reduce((a, t) => a + t.n, 0), n = tasks.reduce((a, t) => a + t.parts.length, 0);
    $("foTot").innerHTML = `${d}<small>/${n}</small>`;

    const active = tasks.find(t => t.n < t.parts.length);
    tasks.forEach((t, i) => {
      const el = cards.get(t.id);
      if (!el) return;
      const N = t.parts.length, isDone = t.n >= N;
      el.classList.toggle("big", t === active);
      el.classList.toggle("done", isDone);
      el.style.order = isDone ? 10 + i : i;
      el.querySelector(".fo-fr").innerHTML = `${t.n}<small>/${N}</small>`;
      const bo = el.querySelector(".fo-bo");
      if (!isDone) {
        bo.querySelector("small").textContent = `Part ${t.n + 1} of ${N}`;
        bo.querySelector("b").textContent = t.parts[t.n][0];
        bo.querySelector("span").textContent = t.left ? `Left off: “${t.left}”` : `Done when: ${t.parts[t.n][1]}`;
      } else {
        bo.querySelector("small").textContent = "";
        bo.querySelector("b").textContent = "";
        bo.querySelector("span").textContent = "";
      }
    });

    if (errEl && errs.length) {
      errEl.style.order = 5;
      const dn = errs.filter(e => e.done).length;
      errEl.querySelector(".fo-fr").innerHTML = `${dn}<small>/${errs.length}</small>`;
      errEl.querySelectorAll("li").forEach((li, j) => li.classList.toggle("d", !!errs[j]?.done));
    }

    live.forEach(s => paintScene(s, changed != null && s.id === changed));
  }

  function emptyHTML() {
    const tm = bag()[dayKey(1)];
    return `<div class="fo-empty"><h3>Nothing planned for today</h3><p>Plan the night before or right before you start. Ask Claude to split each big task into parts, then paste the plan here.</p>${tm ? `<p>Tomorrow's plan is set: ${tm.tasks.length} task${tm.tasks.length === 1 ? "" : "s"}${tm.errands.length ? ` and ${tm.errands.length} errands` : ""}. It starts tomorrow.</p>` : ""}</div>`;
  }

  function openSheet(text) {
    $("foText").value = text || "";
    $("foMsg").textContent = "";
    sheet.classList.add("on");
    setTimeout(() => $("foText").focus(), 50);
  }
  function closeSheet() { sheet.classList.remove("on"); }

  function toggleErr(i) {
    const p = today();
    const e = p && p.errands[i];
    if (!e) return;
    e.done = !e.done;
    save();
    if (e.done) chime(.7);
    refresh("err");
    if (p.errands.every(x => x.done)) toast("All errands done. The street is lit.");
  }

  function reset() {
    const p = today();
    if (!p) return;
    p.tasks.forEach(t => { t.n = 0; t.left = ""; });
    p.errands.forEach(e => { e.done = false; });
    save(); buildAll();
    toast("Progress reset.");
  }

  /* ---------- task page ---------- */
  function openTask(id) {
    const t = getTask(id);
    const el = cards.get(id);
    if (!t || !el) return;
    curId = id;
    const r = el.getBoundingClientRect();
    pageEl.style.setProperty("--t", r.top + "px");
    pageEl.style.setProperty("--l", r.left + "px");
    pageEl.style.setProperty("--r", (innerWidth - r.right) + "px");
    pageEl.style.setProperty("--b", (innerHeight - r.bottom) + "px");
    pageEl.style.setProperty("--fk", SC[t.scene].k);
    if (pageScene) { pageScene.el.remove(); live.splice(live.indexOf(pageScene), 1); }
    pageScene = makeScene($("foPic"), t.scene, id);
    $("foTag").innerHTML = `<span class="fo-dot" style="background:${SC[t.scene].k}"></span>${esc(t.tag)}`;
    $("foTitle").textContent = t.t + ".";
    lowEl.innerHTML = lowHTML(t);
    lowEl.scrollTop = 0;
    paintScene(pageScene, false);
    requestAnimationFrame(() => pageEl.classList.add("open"));
    pageEl.setAttribute("aria-hidden", "false");
  }

  function closePage() {
    pageEl.classList.remove("open");
    pageEl.setAttribute("aria-hidden", "true");
    curId = null;
    setTimeout(() => {
      if (!pageEl.classList.contains("open") && pageScene) {
        pageScene.el.remove();
        live.splice(live.indexOf(pageScene), 1);
        pageScene = null;
      }
    }, 650);
    refresh(null);
  }

  function lowHTML(t) {
    const d = t.n, N = t.parts.length;
    let h = "";
    t.parts.forEach((p, j) => {
      if (j === d && d < N) {
        h += `<div class="fo-cur"><small>Part ${j + 1} of ${N} · now</small><h4>${esc(p[0])}</h4>
          <div class="fo-dw"><b>Done when</b>${esc(p[1])}</div>
          ${t.left ? `<div class="fo-lo"><b>Where you left off</b>${esc(t.left)}</div>` : ""}
          <div class="fo-acts"><button class="fo-chip pri" data-a="open">${IC.open}${esc(t.open || "Open")}</button><button class="fo-chip" data-a="ask">${IC.ask}Ask Claude</button></div>
          ${t.mat.length ? `<div class="fo-mat"><b>What you need</b>${t.mat.map(m => `<div>${esc(m[0])}${m[1] ? ` <span style="color:#86868b">· ${esc(m[1])}</span>` : ""}</div>`).join("")}</div>` : ""}
          <div class="fo-stopq" id="foStopQ"><label for="foLo">Where did you leave off? One line for next time.</label><input id="foLo" placeholder="e.g. start with option 2"></div>
          <div class="fo-btns"><button class="fo-pill o" id="foStop">Stop for now</button><button class="fo-pill b" id="foDone">Done</button></div></div>`;
      } else {
        h += `<div class="fo-pl${j < d ? " d" : ""}"><span class="fo-c">${CK}</span><span>${esc(p[0])}</span></div>`;
      }
    });
    if (d >= N) h += `<div class="fo-btns"><button class="fo-pill b" id="foBack2">Back to today</button></div>`;
    return h;
  }

  function stopClick(t) {
    const q = $("foStopQ"), b = $("foStop");
    if (!q.classList.contains("on")) {
      q.classList.add("on"); b.textContent = "Save and stop"; $("foLo").focus();
      return;
    }
    const v = $("foLo").value.trim();
    if (v) { t.left = v; save(); }
    toast(v ? "Saved. It'll be the first thing you see." : "Stopped for now.");
    closePage();
  }

  function openLink(t) {
    if (t.url) window.open(t.url, "_blank", "noopener");
    else toast("No link saved for this one. Add it in the plan.");
  }

  function askPrompt(t) {
    const p = t.parts[t.n];
    const txt = `I'm working on "${t.t}", part ${t.n + 1} of ${t.parts.length}: ${p[0]}. Done when: ${p[1]}${t.left ? ` Where I left off: ${t.left}.` : ""} Help me get through this part.`;
    Promise.resolve().then(() => navigator.clipboard.writeText(txt))
      .then(() => toast("Prompt copied. Paste it in Claude."))
      .catch(() => toast("Couldn't copy. Open Claude and paste it yourself."));
  }

  function finish(id) {
    const t = getTask(id);
    const N = t.parts.length;
    if (t.n >= N) return;
    t.n++;
    t.left = "";
    save();
    chime(1);
    const p = today();
    const allDone = p.tasks.every(x => x.n >= x.parts.length);
    const pageOpen = pageEl.classList.contains("open") && curId === id;
    if (pageOpen) lowEl.innerHTML = lowHTML(t);
    refresh(id);
    if (pageOpen && allDone) { setTimeout(() => { closePage(); setTimeout(showClosed, 700); }, 1300); return; }
    if (pageOpen && t.n >= N) { toast(`${t.t}: in full colour.`); setTimeout(closePage, 1400); return; }
    if (t.n >= N) toast(`${t.t}: in full colour.`);
    if (allDone) setTimeout(showClosed, 1400);
  }

  function showClosed() {
    const p = today();
    if (!p) return;
    const strip = $("foStrip");
    strip.innerHTML = p.tasks.slice(0, 3).map(t => t.scene === "plain"
      ? `<div style="background:${SC.plain.k}"></div>`
      : `<div><img src="img/focus/${t.scene === "gym" ? "gym3" : SC[t.scene].img}.webp" alt=""></div>`).join("");
    closedEl.hidden = false;
    closedEl.classList.remove("go");
    void closedEl.offsetWidth;
    closedEl.classList.add("go");
    chime(1);
    setTimeout(() => chime(.8), 250);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
