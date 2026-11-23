/* ARVIN redesign layer (preview first).
   1  Today: the live scene fills the screen, headline on it, thin numbers at the bottom that fade as you scroll.
   2  School: big swipe cards (giant course code on the live art) + a stats row for the card in view.
   3  Schedule: thin day strip, class blocks show their course art, Day / Week / List kept.
   4  Due dates: giant thin day counts in quiet rows.
   5  Numbers: thin, hairline-divided, no boxes.
   Wraps the app's own render functions, so data and sync stay exactly as they are. */
(function () {
  "use strict";
  if (!document.querySelector(".hero")) return;
  document.body.classList.add("rd");
  const q = s => document.querySelector(s);
  const el = (tag, cls, html) => { const x = document.createElement(tag); if (cls) x.className = cls; if (html != null) x.innerHTML = html; return x; };
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safe = fn => function () { try { return fn.apply(this, arguments); } catch (e) { console.warn("[rd]", e); } };
  const A = window.AP; if (!A) return;
  const RD = window.__rd = window.__rd || {};
  const wrap = (name, after) => { RD[name] = safe(after); };

  /* ---------------- 1 · Today ---------------- */
  const hero = q(".hero"), intro = q("#hero");
  if (hero && intro && intro.parentElement !== hero) hero.append(intro);
  let bar = q("#rdBar");
  if (!bar) { bar = el("div", "rdbar"); bar.id = "rdBar"; bar.setAttribute("aria-label", "At a glance"); hero.append(bar); }

  function heroBar() {
    const p = A.heroPick(), e = p.cur || p.next, n = p.n, cells = [];
    if (e) {
      const k = e.start.slice(0, 10), s = A.minOf(e.start);
      cells.push([A.t12(s).replace(/\s?(AM|PM)$/, ""), p.cur ? "now" : k === n.key ? "next" : A.relDay(n.key, k).toLowerCase()]);
      const li = A.leaveInfo ? A.leaveInfo(e) : null;
      if (li && !p.cur) cells.push([A.t12(li.leave).replace(/\s?(AM|PM)$/, ""), "leave by"]);
    }
    const due = A.EV.filter(x => ["exam", "due"].includes(A.classify(x).key) && !A.isDone(x) && A.isAhead(x, n) && A.diffDays(n.key, x.start.slice(0, 10)) < 14).length;
    const dueCell = [String(due), "due soon"];
    try {
      const wt = A.wxText(A.condAt()); if (wt) { const [c, t] = wt.split(" · "); cells.push([(t || "").replace(/\s/g, ""), (c || "").toLowerCase()]); }
    } catch (x) {}
    if (cells.length < 3) cells.splice(Math.min(cells.length, 1), 0, dueCell);
    if (cells.length < 3) cells.push(dueCell);
    bar.innerHTML = cells.slice(0, 3).map(([v, l]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("");
  }
  wrap("renderHero", heroBar);

  /* pull the picture up under the header so it fills the screen */
  const place = () => {
    const st = q(".hstage"), hdr = q("#bar"); if (!st || !hero.offsetHeight) return;
    st.style.marginTop = "0px";
    const H = Math.max(560, Math.min(innerWidth >= 900 ? 900 : 1200, innerHeight));
    hero.style.setProperty("height", H + "px", "important");
    const top = st.getBoundingClientRect().top + scrollY;
    st.style.setProperty("margin-top", `${-top}px`, "important");
    document.documentElement.style.setProperty("--rdhdr", (hdr ? hdr.offsetHeight : 64) + "px");
  };
  addEventListener("resize", () => requestAnimationFrame(place));
  setTimeout(place, 60); setTimeout(place, 800);
  window.__rdPlace = place;
  document.addEventListener("click", e => { if (e.target.closest("[data-t]")) { setTimeout(place, 60); setTimeout(place, 400); } });

  /* numbers fade away as you scroll; header turns clear over the picture */
  let raf = 0;
  const onScroll = () => {
    raf = 0;
    const y = scrollY, h = hero.offsetHeight || 1;
    bar.style.opacity = Math.max(0, 1 - y / (h * 0.28)).toFixed(3);
    bar.style.transform = `translateY(${Math.min(24, y * 0.08).toFixed(1)}px)`;
    document.body.classList.toggle("rd-over", A.TAB === "today" && y < h - 80);
  };
  addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(onScroll); }, { passive: true });
  setInterval(onScroll, 1000);

  /* ---------------- 2 · School ---------------- */
  const GIANT = { work: "SWIM", gym: "GYM", tutor: "TUTOR" };
  function coursePill(key, n) {
    const ex = A.EV.find(e => A.classify(e).key === "exam" && (e.title.match(A.COURSE) || [])[1] === key && A.isAhead(e, n) && !A.isDone(e));
    if (ex) { const d = A.diffDays(n.key, ex.start.slice(0, 10)); if (d <= 14) return d === 0 ? "Exam today" : `Exam in ${d} day${d === 1 ? "" : "s"}`; }
    const wk = (A.DUE || []).filter(([c, d]) => c === key && d >= n.key && A.diffDays(n.key, d) <= 7).length;
    if (wk) return `${wk} due this week`;
    const nx = A.EV.filter(e => (A.classify(e).course === key || (key === "work" && A.classify(e).key === "work") || (key === "gym" && A.classify(e).key === "gym")) && A.isAhead(e, n))[0];
    return nx ? `Next · ${A.relDay(n.key, nx.start.slice(0, 10)).replace(/day$/, "")} ${A.t12(A.minOf(nx.start))}` : "";
  }
  function courseStats(key, n) {
    const isC = window.STUDY && window.STUDY[key];
    const nx = A.EV.filter(e => (A.classify(e).course === key || A.classify(e).key === key) && A.isAhead(e, n))[0];
    const nxt = nx ? (nx.start.slice(0, 10) === n.key ? A.t12(A.minOf(nx.start)) : A.DOW[A.dateOf(nx.start.slice(0, 10)).getDay()]) : "—";
    if (isC) {
      const g = (A.ST.grades || {})[key];
      const due = (A.DUE || []).filter(([c, d]) => c === key && d >= n.key && A.diffDays(n.key, d) <= 14).length;
      return [[g != null ? g + "%" : "—", "grade"], [String(due), "due · 2 wks"], [nxt, "next class"]];
    }
    let m = 0; const w = A.weekStart(n.key);
    for (let i = 0; i < 7; i++) for (const x of A.eventsOn(A.addDays(w, i))) if (!x.allDay && (A.classify(x).key === key || (key === "tutor" && /tutor/i.test(x.title || "")))) m += (A.minOf(x.end) || 1440) - A.minOf(x.start);
    return [[(Math.round(m / 6) / 10) + " h", "this week"], [nxt, key === "work" ? "next shift" : "next"]];
  }
  function decorateRail(rail) {
    if (!rail) return;
    const n = A.nowParts();
    rail.querySelectorAll(".tile").forEach(t => {
      const key = t.dataset.k, art = t.querySelector(".art"); if (!art) return;
      art.querySelectorAll(".rdg,.rdpill").forEach(x => x.remove());
      art.append(el("div", "rdg", esc(GIANT[key] || key)));
      const p = coursePill(key, n); if (p) art.append(el("span", "rdpill", esc(p)));
    });
    let dots = rail.nextElementSibling;
    if (!dots || !dots.classList.contains("rddots")) { dots = el("div", "rddots"); rail.after(dots); }
    let stats = dots.nextElementSibling;
    if (!stats || !stats.classList.contains("rdstats")) { stats = el("div", "rdstats"); dots.after(stats); }
    const tiles = [...rail.querySelectorAll(".tile")];
    const pick = () => {
      const r = rail.getBoundingClientRect();
      let best = 0, bd = 1e9;
      tiles.forEach((t, i) => { const d = Math.abs(t.getBoundingClientRect().left - r.left - parseFloat(getComputedStyle(rail).paddingLeft || 0)); if (d < bd) { bd = d; best = i; } });
      dots.innerHTML = tiles.length > 1 ? tiles.map((_, i) => `<i class="${i === best ? "on" : ""}"></i>`).join("") : "";
      const t = tiles[best]; if (!t) { stats.innerHTML = ""; return; }
      const name = (t.querySelector("h3") || {}).textContent || "";
      stats.innerHTML = `<div class="rdname">${esc(name)}</div><div class="rdrow">` + courseStats(t.dataset.k, A.nowParts()).map(([v, l]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("") + "</div>";
    };
    if (!rail.dataset.rd) { rail.dataset.rd = 1; rail.addEventListener("scroll", () => requestAnimationFrame(pick), { passive: true }); }
    pick();
  }
  wrap("renderRail", () => { decorateRail(q("#rail")); decorateRail(q("#rail2")); });
  /* one tap opens the course (the old "tap for specs" step is gone) */
  document.addEventListener("click", e => { const t = e.target.closest(".rd .tile"); if (t) t.classList.add("open"); }, true);

  /* ---------------- 3 · Schedule ---------------- */
  function decorateGrid() {
    const cal = q("#cal"); if (!cal || !A.S || A.S.view === "list") return;
    const ds = A.days(), cols = cal.querySelectorAll(".grid .col");
    cols.forEach((col, di) => {
      const k = ds[di]; if (!k) return;
      const evs = A.layout(A.eventsOn(k).filter(e => !e.allDay)), btns = col.querySelectorAll(".ev");
      btns.forEach((b, i) => {
        const x = evs[i]; if (!x || b.querySelector(".rdart")) return;
        let sc = A.sceneFor(x.e); if (sc === "soft") sc = "sunset";
        const cv = document.createElement("canvas"); cv.className = "rdart"; cv.setAttribute("aria-hidden", "true");
        b.prepend(cv); b.classList.add("rdph"); A.railLive(cv, sc, x.e.start);
      });
    });
  }
  wrap("renderGrid", decorateGrid);

  /* ---------------- 4 · Due dates ---------------- */
  function dueRows() {
    const box = q("#dgrid"), tl = q("#tl30"); if (!box) return;
    if (tl) tl.hidden = true;
    const n = A.nowParts(), all = A.EV.filter(e => ["exam", "due"].includes(A.classify(e).key) && A.isAhead(e, n)).slice(0, 14);
    box.textContent = "";
    const head = el("div", "rdduehd", `<span class="rdeye"><i></i>Next ${all.length ? Math.max(1, Math.ceil(A.diffDays(n.key, all[all.length - 1].start.slice(0, 10)) / 7)) + " weeks" : "2 weeks"}</span>`);
    box.append(head);
    if (!all.length) { box.append(el("p", "rdempty", "Nothing due. Enjoy it.")); return; }
    const ul = el("ul", "rddue");
    for (const e of all) {
      const c = A.classify(e), k = e.start.slice(0, 10), dd = A.diffDays(n.key, k), done = A.isDone(e);
      const at = c.key === "due" ? (A.minOf(e.end) || A.minOf(e.start)) : A.minOf(e.start);
      const course = (e.title.match(A.COURSE) || [])[1] || c.label;
      const li = el("li", "rdd" + (done ? " done" : "") + (c.key === "exam" ? " exam" : ""));
      li.innerHTML = `<button class="rdn" aria-label="${esc(A.clean(e.title))}, in ${dd} days"><b>${dd === 0 ? "0" : dd}</b><span>${dd === 0 ? "today" : dd === 1 ? "day" : "days"}</span></button>
        <button class="rdt"><b>${esc(A.clean(e.title).replace(/\s*\((\d.*?)\)\s*$/, ""))}</b><span><i style="background:${c.c}"></i>${esc(A.COURSE_NAMES && A.COURSE_NAMES[course] ? A.COURSE_NAMES[course] : course)} · ${esc(A.DOW[A.dateOf(k).getDay()])} ${esc(A.t12(at))}</span></button>`;
      li.querySelectorAll("button").forEach(b => b.onclick = () => A.openEvent(e));
      if (A.canDone && A.canDone(e)) {
        const cb = el("button", "rdck" + (done ? " on" : ""), '<svg viewBox="0 0 12 12"><path d="M2 6.5l2.5 2.5L10 3.5"/></svg>');
        cb.setAttribute("aria-label", done ? "Mark as not done" : "Mark as done");
        cb.onclick = ev => { ev.stopPropagation(); A.toggleDone(e); };
        li.append(cb);
      }
      ul.append(li);
    }
    box.append(ul);
  }
  wrap("renderDeadlines", dueRows);

  /* ---------------- first paint ---------------- */
  const boot = () => {  try { A.render(); } catch (e) { safe(heroBar)(); } onScroll(); };
  boot();
})();
