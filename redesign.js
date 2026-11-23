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


  /* ---------------- live scenes: flat-lay art that follows time + weather ---------------- */
  const SC = window.ARVIN_SCENES || null;
  let uid = 0;
  const sceneKey = e => {
    if (!e) return "fmgt";
    const c = A.classify(e), t = e.title || "";
    if (c.key === "work" || /swim|pedalheads/i.test(t)) return "swim";
    if (c.key === "gym") return "gym";
    if (/tutor/i.test(t)) return "tutor";
    if (c.course === "ECON") return "econ";
    if (c.course === "POLI" || /briefing/i.test(t)) return "poli";
    return "fmgt";
  };
  const TILE = { ECON: "econ", POLI: "poli", FMGT: "fmgt", work: "swim", gym: "gym", tutor: "tutor" };
  function makeScene(key, cls) {
    if (!SC || !SC[key]) return null;
    const id = "z" + (uid++).toString(36);
    const w = document.createElement("div");
    w.innerHTML = SC[key].replace(/QQ/g, id);
    const svg = w.firstElementChild;
    svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add(cls);
    svg.dataset.scene = key;
    paint(svg);
    return svg;
  }
  const L = { h: 12, wx: "clear", rise: 8.5, set: 17.35, v: null };
  const lerp = (a, b, t) => a + (b - a) * t;
  function lightState(h, wx) {
    const r = L.rise, s = L.set, f = (h - r) / (s - r), day = f >= 0 && f <= 1, e = day ? Math.sin(Math.PI * f) : 0;
    const v = { day, sx: .9, sy: 1.1, so: .06, co: .18, wr: "0deg", wl: 1, wo: 0, tint: "#141a33", to: .68, gl: "#ffe2b0", go: 0, lp: 1, fg: 0, cl: 0, rn: 0, sn: 0, stm: .45, blur: 10 };
    if (day) {
      const Ln = 1.7 - 1.1 * e;
      Object.assign(v, { sx: (1 - 2 * f) * Ln * 1.3, sy: .35 + Ln * .55, so: .16 + .12 * e, co: .3, wr: ((f - .5) * 44).toFixed(1) + "deg", wl: .8 + (1 - e) * .7, wo: .10 + .06 * e, lp: 0, stm: .3, blur: 8 + (1 - e) * 8, go: .12 + .2 * e });
      if (f < .12) Object.assign(v, { tint: "#ffb27c", to: .24 * (1 - f / .12) + .06, gl: "#ffc78f" });
      else if (f > .82) Object.assign(v, { tint: "#ff9a58", to: .08 + .26 * (f - .82) / .18, gl: "#ffb070" });
      else Object.assign(v, { tint: "#fff1dc", to: .05, gl: "#fff0d0" });
    } else {
      const toSet = h - s, toRise = r - h;
      if (toSet > 0 && toSet < 1) Object.assign(v, { tint: "#5f6aa8", to: lerp(.3, .68, toSet), lp: lerp(.35, 1, toSet) });
      else if (toRise > 0 && toRise < 1) Object.assign(v, { tint: "#6a6fa8", to: lerp(.68, .32, 1 - toRise), lp: lerp(1, .3, 1 - toRise) });
      v.so = .34 * v.lp + .04;
    }
    if (wx === "clouds") { v.so *= .45; v.wo *= .25; v.blur += 10; v.cl = day ? .16 : .1; v.go *= .4; if (day) { v.tint = "#c3c9d3"; v.to = Math.max(v.to, .16); } }
    if (wx === "rain") { v.so *= .35; v.wo = 0; v.blur += 12; v.cl = .2; v.rn = day ? .32 : .22; v.go = 0; if (day) { v.tint = "#93a3b8"; v.to = .26; } v.stm = .5; }
    if (wx === "snow") { v.so *= .4; v.wo *= .2; v.blur += 10; v.sn = 1; v.go *= .3; if (day) { v.tint = "#dbe3ee"; v.to = .14; v.fg = .1; } v.stm = .55; }
    if (wx === "fog") { v.so *= .3; v.wo *= .15; v.blur += 14; v.fg = day ? .38 : .18; v.go *= .2; if (day) { v.tint = "#e3e6ea"; v.to = .1; } }
    v.dark = !day || v.to > .45;
    return v;
  }
  function paint(svg) {
    const v = L.v || (L.v = lightState(L.h, L.wx));
    for (const k of ["sx", "sy", "so", "co", "wl", "wo", "to", "go", "lp", "fg", "cl", "rn", "sn", "stm"]) svg.style.setProperty("--" + k, (+v[k]).toFixed(3));
    svg.style.setProperty("--wr", v.wr); svg.style.setProperty("--tint", v.tint); svg.style.setProperty("--gl", v.gl);
    svg.querySelectorAll(".sblur").forEach(b => b.setAttribute("stdDeviation", v.blur.toFixed(1)));
  }
  function relight() {
    const d = new Date(); L.h = d.getHours() + d.getMinutes() / 60; L.v = lightState(L.h, L.wx);
    document.querySelectorAll("svg.scene").forEach(paint);
    document.body.classList.toggle("rd-dark", L.v.dark);
    document.body.classList.toggle("rd-light", !L.v.dark);
  }
  const WMAP = c => c <= 1 ? "clear" : c <= 3 ? "clouds" : c <= 48 ? "fog" : ((c >= 71 && c <= 77) || c === 85 || c === 86) ? "snow" : "rain";
  async function weather() {
    try {
      const r = await fetch("https://api.open-meteo.com/v1/forecast?latitude=49.28&longitude=-122.79&current=weather_code&daily=sunrise,sunset&timezone=America%2FVancouver&forecast_days=1");
      const j = await r.json(), t = x => { const m = x.match(/T(\d\d):(\d\d)/); return +m[1] + +m[2] / 60; };
      L.wx = WMAP(j.current.weather_code); L.rise = t(j.daily.sunrise[0]); L.set = t(j.daily.sunset[0]);
      try { localStorage.setItem("ap-wx", JSON.stringify({ wx: L.wx, rise: L.rise, set: L.set, at: Date.now() })); } catch (e) {}
    } catch (e) {}
    relight();
  }
  try { const c = JSON.parse(localStorage.getItem("ap-wx") || "null"); if (c && Date.now() - c.at < 6 * 3600e3) Object.assign(L, { wx: c.wx, rise: c.rise, set: c.set }); } catch (e) {}
  relight(); weather();
  setInterval(relight, 60000); setInterval(weather, 30 * 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) relight(); });
  window.__rdLight = (h, wx) => { L.h = h; if (wx) L.wx = wx; L.v = lightState(h, L.wx); document.querySelectorAll("svg.scene").forEach(paint); document.body.classList.toggle("rd-dark", L.v.dark); document.body.classList.toggle("rd-light", !L.v.dark); };

  function heroScene() {
    if (!SC) return;
    const p = A.heroPick(), key = sceneKey(p.cur || p.next);
    let svg = hero.querySelector("svg.scene");
    if (svg && svg.dataset.scene === key) return;
    if (svg) svg.remove();
    svg = makeScene(key, "rdhero"); if (svg) { hero.prepend(svg); fitHero(); }
  }
  /* show the whole desk: widen or heighten the view instead of zooming in */
  function fitHero() {
    const svg = hero.querySelector("svg.rdhero"); if (!svg) return;
    const w = hero.clientWidth || innerWidth, h = hero.clientHeight || innerHeight, a = w / h, base = 600 / 700;
    if (a > base) { const vw = 700 * a; svg.setAttribute("viewBox", `${(300 - vw / 2).toFixed(0)} 0 ${vw.toFixed(0)} 700`); }
    else { const vh = 600 / a, pad = Math.min(vh - 700, 700); svg.setAttribute("viewBox", `0 ${(-pad * .62).toFixed(0)} 600 ${(700 + pad).toFixed(0)}`); }
    svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
  }
  addEventListener("resize", () => requestAnimationFrame(fitHero));

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
  wrap("renderHero", () => { heroBar(); heroScene(); });

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
      const sk = TILE[key];
      if (sk && SC) {
        let svg = art.querySelector("svg.scene");
        if (!svg || svg.dataset.scene !== sk) { if (svg) svg.remove(); svg = makeScene(sk, "rdtile"); if (svg) art.prepend(svg); }
        const wd = svg && svg.querySelector(".wd"); if (wd && GIANT[key]) wd.textContent = GIANT[key];
        art.classList.add("hasscene");
      } else art.append(el("div", "rdg", esc(GIANT[key] || key)));
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
        const svg = SC ? makeScene(sceneKey(x.e), "rdart") : null;
        if (svg) b.prepend(svg);
        else { let sc = A.sceneFor(x.e); if (sc === "soft") sc = "sunset"; const cv = document.createElement("canvas"); cv.className = "rdart"; cv.setAttribute("aria-hidden", "true"); b.prepend(cv); A.railLive(cv, sc, x.e.start); }
        b.classList.add("rdph");
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
