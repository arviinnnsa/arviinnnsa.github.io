/* Money tab (payday-first): next paycheque, the $500 TFSA split, shifts to confirm,
   your stocks with daily news, and pay over time. All numbers come from the private ARVIN Brain sheet. */
(function () {
  "use strict";
  const B = () => window.apBrain;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = n => String(n).padStart(2, "0");
  const keyOf = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const today = () => keyOf(new Date());
  const dOf = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const days = (a, b) => Math.round((dOf(b) - dOf(a)) / 864e5);
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const short = k => { const d = dOf(k); return MON[d.getMonth()] + " " + d.getDate(); };
  const dow = k => DAY[dOf(k).getDay()];
  const money = (n, cents = true) => (n < 0 ? "−" : "") + "$" + Math.abs(+n || 0).toLocaleString("en-CA", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
  const pct = n => (n >= 0 ? "+" : "−") + Math.abs(n * 100).toFixed(2) + "%";
  const hrs = n => (Math.round(n * 10) / 10).toString().replace(/\.0$/, "");
  const tap = () => { try { window.apHaptic && window.apHaptic(); } catch (e) {} };
  const CK = '<svg viewBox="0 0 12 12"><path d="M2 6.5l2.5 2.5L10 3.5"/></svg>';

  /* sample numbers so the design can be reviewed before signing in */
  const SAMPLE = (() => {
    const t = today(), add = n => { const d = dOf(t); d.setDate(d.getDate() + n); return keyOf(d); };
    return {
      sample: true, usdcad: 1.38, portfolio: 612.4,
      settings: { invest_per_paycheque: 500, pedalheads_rate: 22, cpp_rate: .0595, ei_rate: .0164, income_tax_rate: .05, gas_price: 1.75, fuel_l_per_100km: 7.5, km_richmond: 38, km_jericho: 33, km_fremont: 7, km_gtv: 28, km_parkroyal: 30, min_richmond: 40, min_jericho: 45, min_fremont: 15, min_gtv: 35, min_parkroyal: 50 },
      pay: [-35, -21, -7, 7, 21, 35].map((o, i) => ({ Payday: add(o), Hours: [30.5, 36.2, 33.9, 37.9, 38.2, 36.4][i], Gross: [671, 796.4, 745.8, 833.8, 840.4, 800.8][i], "Take-home": [586.4, 696, 651.8, 728.8, 734.5, 699.9][i], Invest: 500, Spend: [86.4, 196, 151.8, 228.8, 234.5, 199.9][i], Status: o < 0 ? "Paid" : o === 7 ? "Next" : "Upcoming" })),
      shifts: [[-6, "GTV", 5.08], [-5, "Sunday", 5.08], [-4, "Richmond", 4], [-2, "Fremont", 5.08]].map(([o, l, h], i) => ({ _row: 90 + i, Date: add(o), Location: l, Start: "07:55", End: "13:00", "Sched hours": h, "Confirmed hours": "", Status: "Assumed worked", Payday: add(7) })),
      tutoring: [{ _row: 3, Date: add(-2), Amount: 25, Paid: "" }, { _row: 2, Date: add(-7), Amount: 25, Paid: "" }],
      spending: [{ Date: add(-3), Amount: 18.4, What: "Gas" }, { Date: add(-1), Amount: 12.75, What: "Lunch" }],
      stocks: [
        { Ticker: "XEQT", Name: "iShares Core Equity ETF Portfolio", Currency: "CAD", Shares: 2.24, Price: 45.52, "Day change %": -0.0013, Value: 102.1, "Gain %": 0.007 },
        { Ticker: "NVDA", Name: "NVIDIA", Currency: "USD", Shares: 2.39, Price: 162.85, "Day change %": -0.0201, Value: 389.8, "Gain %": -0.068 }
      ],
      prices: [],
      news: [
        { Date: t, Ticker: "XEQT", "Move %": -0.0013, Headline: "Global stocks flat", "Why it matters to you": "XEQT holds thousands of companies, so a quiet day barely moves it. Nothing to do." },
        { Date: t, Ticker: "NVDA", "Move %": -0.0201, Headline: "Chip stocks dip ahead of earnings", "Why it matters to you": "NVIDIA reports soon, and prices often swing before earnings. Your thesis hasn't changed." }
      ]
    };
  })();

  let open = false, editRow = null, busy = new Set(), cover = { pool: "richmond", h: 4 };
  const POOLS = [["richmond", "Richmond"], ["jericho", "Jericho"], ["fremont", "Fremont"], ["gtv", "GTV"], ["parkroyal", "Park Royal"]];

  function mount() {
    if ($("money")) return;
    const sec = document.createElement("section");
    sec.id = "money"; sec.dataset.tab = "money"; sec.setAttribute("aria-label", "Money"); sec.className = "off";
    sec.innerHTML = '<div id="moBox"></div>';
    const after = $("focus");
    if (after) after.after(sec); else document.querySelector("main")?.append(sec);
    const icon = '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12.5" rx="2.5"/><circle cx="12" cy="12.25" r="2.6"/><path d="M6.5 9.5v.01M17.5 15v.01"/></svg>';
    const tb = $("tabbar"), list = tb && tb.querySelector('button[data-t="todo"]');
    if (tb && !tb.querySelector('[data-t="money"]')) {
      const b = document.createElement("button"); b.dataset.t = "money"; b.innerHTML = icon + "Money";
      b.onclick = () => window.goTab && window.goTab("money");
      list ? list.before(b) : tb.append(b);
    }
    const tn = document.querySelector(".topnav");
    if (tn && !tn.querySelector('[data-t="money"]')) {
      const b = document.createElement("button"); b.dataset.t = "money"; b.textContent = "Money";
      b.onclick = () => window.goTab && window.goTab("money");
      const l = tn.querySelector('[data-t="todo"]'); l ? l.before(b) : tn.append(b);
    }
    sec.addEventListener("click", onClick);
    sec.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.matches(".mo-hin")) saveHours(e.target); });
  }

  /* ---------- small drawings ---------- */
  function spark(points, up) {
    if (!points || points.length < 2) return '<svg class="mo-spark" viewBox="0 0 100 32" aria-hidden="true"><path d="M2 16H98" class="flat"/></svg>';
    const ys = points.map(p => +p), mn = Math.min(...ys), mx = Math.max(...ys), r = mx - mn || 1;
    const d = ys.map((y, i) => (i ? "L" : "M") + (2 + i * 96 / (ys.length - 1)).toFixed(1) + " " + (29 - (y - mn) / r * 26).toFixed(1)).join("");
    return `<svg class="mo-spark ${up ? "up" : "dn"}" viewBox="0 0 100 32" aria-hidden="true"><path d="${d}"/></svg>`;
  }
  function bars(pay, nextKey) {
    const show = pay.filter(p => p.Payday && (+p["Take-home"] > 0 || p.Payday >= nextKey)).slice(-8);
    const idx = show.findIndex(p => p.Payday === nextKey);
    const view = idx > 5 ? show.slice(idx - 5, idx + 3) : show.slice(0, 8);
    const mx = Math.max(1, ...view.map(p => +p["Take-home"] || 0));
    return '<div class="mo-bars">' + view.map(p => {
      const v = +p["Take-home"] || 0, h = Math.max(3, v / mx * 100), cls = p.Payday === nextKey ? "now" : p.Payday < nextKey ? "past" : "fut";
      return `<div class="mo-bar ${cls}"><i style="height:${h}%"></i><b>${v ? money(v, false) : "—"}</b><span>${short(p.Payday)}</span></div>`;
    }).join("") + "</div>";
  }

  /* ---------- render ---------- */
  function draw() {
    const box = $("moBox"); if (!box) return;
    const st = B() ? B().get() : { status: "signedout" };
    const live = st.data;
    const D = live || SAMPLE;
    const t = today();
    const pay = (D.pay || []).filter(p => p.Payday);
    const next = pay.find(p => p.Payday >= t) || pay[pay.length - 1] || {};
    const nk = next.Payday || t;
    const dleft = days(t, nk);
    const take = +next["Take-home"] || 0, inv = +next.Invest || 0, spend = +next.Spend || 0;
    const invTarget = +(D.settings || {}).invest_per_paycheque || 500;

    /* shifts waiting for a tap: worked already, in a paycheque that hasn't landed yet */
    const toConfirm = (D.shifts || []).filter(s => s.Date && s.Date < t && s.Payday >= t && !/confirmed|adjusted/i.test(s.Status || ""));
    const tutOpen = (D.tutoring || []).filter(r => r.Date && (+r.Amount || 0) > 0 && !/^y/i.test(String(r.Paid || "")));
    const tutOwed = tutOpen.reduce((a, r) => a + (+r.Amount || 0), 0);

    /* left to spend: the spend part of your last cheque, minus what you've logged since */
    const lastPaid = [...pay].reverse().find(p => p.Payday <= t && +p["Take-home"] > 0 && p.Payday !== nk) || null;
    const since = lastPaid ? lastPaid.Payday : t;
    const spentRows = (D.spending || []).filter(r => r.Date && r.Date >= since && +r.Amount).sort((a, b) => a.Date < b.Date ? 1 : -1);
    const spent = spentRows.reduce((a, r) => a + (+r.Amount || 0), 0);
    const left = (lastPaid ? +lastPaid.Spend || 0 : 0) - spent;

    /* cover-shift check */
    const S = D.settings || {}, rate = +S.pedalheads_rate || 22;
    const netR = 1 - (+S.cpp_rate || 0) - (+S.ei_rate || 0) - (+S.income_tax_rate || 0);
    const km = +S["km_" + cover.pool] || 30, mins = +S["min_" + cover.pool] || 35;
    const cNet = cover.h * rate * netR, cGas = 2 * km * (+S.fuel_l_per_100km || 7.5) / 100 * (+S.gas_price || 1.75);
    const cReal = (cNet - cGas) / (cover.h + 2 * mins / 60);

    /* stocks */
    const stocks = (D.stocks || []).map(s => {
      const pts = (D.prices || []).filter(p => p.Ticker === s.Ticker).sort((a, b) => a.Date < b.Date ? -1 : 1).slice(-30).map(p => +p.Close);
      if (pts.length && +s.Price) pts.push(+s.Price);
      const news = (D.news || []).filter(n => n.Ticker === s.Ticker).sort((a, b) => a.Date < b.Date ? 1 : -1)[0];
      return { ...s, pts, news };
    });
    const dayMove = stocks.reduce((a, s) => {
      const v = (+s.Value || 0) * (s.Currency === "USD" ? D.usdcad || 1.38 : 1), c = +s["Day change %"] || 0;
      return a + v - v / (1 + c);
    }, 0);
    const port = +D.portfolio || stocks.reduce((a, s) => a + (+s.Value || 0) * (s.Currency === "USD" ? D.usdcad || 1.38 : 1), 0);
    const [whole, cents] = money(take).split(".");

    let banner = "";
    if (!live || st.status === "signedout" || (st.error && (st.error.code === "auth" || st.error.code === "scope"))) {
      banner = `<div class="mo-note"><span>${live ? "Sign in again to refresh your numbers." : "Sample numbers. Connect your brain to see your real money."}</span><button class="mo-pill blue" data-act="connect">Connect brain</button></div>`;
    } else if (st.error && st.error.code === "api") {
      banner = `<div class="mo-note"><span>One step left: turn on Google Sheets for your ARVIN sign-in.</span><a class="mo-pill blue" href="${esc(st.error.link)}" target="_blank" rel="noopener">Turn on</a></div>`;
    } else if (st.error) {
      banner = `<div class="mo-note"><span>Couldn't reach your brain. Showing the last numbers.</span><button class="mo-pill" data-act="reload">Try again</button></div>`;
    }

    box.innerHTML = `
      <div class="mo-hero">
        <p class="mo-k">${dleft <= 0 ? "Payday is today" : "Next payday · " + dow(nk) + ", " + short(nk)}</p>
        <h2 class="mo-big" aria-label="Take-home ${money(take)}">${whole}<small>.${cents || "00"}</small></h2>
        <p class="mo-sub">${dleft > 0 ? `In ${dleft} day${dleft === 1 ? "" : "s"} · ` : ""}${hrs(+next.Hours || 0)} hrs · est. take-home</p>
        <div class="mo-split" aria-label="Paycheque split">
          <div class="mo-sbar"><i class="inv" style="flex:${Math.max(inv, 0.01)}"></i><i class="sp" style="flex:${Math.max(spend, 0.01)}"></i></div>
          <div class="mo-slbl"><span><b>${money(inv, false)}</b> to TFSA</span><span><b>${money(spend, false)}</b> to spend</span></div>
          ${take && take < invTarget ? `<p class="mo-warn">This cheque is under your $${invTarget} plan, so all of it goes to the TFSA.</p>` : ""}
        </div>
        <div class="mo-acts">
          ${toConfirm.length ? `<button class="mo-pill blue" data-act="jump-confirm">Confirm ${toConfirm.length} shift${toConfirm.length === 1 ? "" : "s"}</button>` : ""}
          <a class="mo-pill line" href="${esc(B() ? B().url() : "#")}" target="_blank" rel="noopener">Open brain</a>
        </div>
      </div>
      <div class="mo-page">
        ${banner}
        ${toConfirm.length ? `
        <section class="mo-sec" id="moConfirm">
          <h3>Shifts to confirm</h3><p class="mo-hint">Tap ✓ if you worked it as planned, or fix the hours if you stayed late or left early.</p>
          <div class="mo-list">${toConfirm.map(s => {
            const h = +s["Confirmed hours"] || +s["Sched hours"] || 0, edit = editRow === s._row;
            return `<div class="mo-row${busy.has(s._row) ? " busy" : ""}">
              <div class="mo-l"><b>${esc(dow(s.Date).slice(0, 3))}, ${short(s.Date)}</b><span>${esc(s.Location === "Sunday" ? "Sunday pool" : s.Location)} · ${esc(s.Start)}–${esc(s.End)}</span></div>
              ${edit ? `<input class="mo-hin" type="number" inputmode="decimal" step="0.25" min="0" max="14" value="${hrs(h)}" data-row="${s._row}" aria-label="Hours worked"><button class="mo-pill blue sm" data-act="save" data-row="${s._row}">Save</button>`
                     : `<button class="mo-hrs" data-act="edit" data-row="${s._row}" aria-label="Change hours">${hrs(h)} h</button><button class="mo-ok" data-act="ok" data-row="${s._row}" aria-label="Worked as planned">${CK}</button>`}
            </div>`; }).join("")}</div>
        </section>` : ""}

        <section class="mo-sec">
          <div class="mo-safe"><h3>Left to spend</h3><b class="${left < 0 ? "dn" : ""}">${money(left, false)}</b></div>
          <p class="mo-hint">${lastPaid ? `From your ${short(lastPaid.Payday)} cheque, after the TFSA share. ${money(spent)} logged since.` : "Starts after your next cheque."}</p>
          <div class="mo-list">
            <div class="mo-add"><input id="moWhat" placeholder="What did you buy?" maxlength="40" aria-label="What"><input id="moAmt" class="amt" type="number" inputmode="decimal" step="0.01" min="0" placeholder="$" aria-label="Amount"><button class="mo-pill blue sm" data-act="spend">Add</button></div>
            ${spentRows.slice(0, 4).map(r => `<div class="mo-row"><div class="mo-l"><b>${esc(r.What || "Purchase")}</b><span>${short(r.Date)}</span></div><b class="mo-amt">${money(+r.Amount)}</b></div>`).join("")}
          </div>
        </section>

        <section class="mo-sec">
          <div class="mo-sh"><h3>Stocks</h3><span class="mo-tot"><b>${money(port)}</b><i class="${dayMove >= 0 ? "up" : "dn"}">${dayMove >= 0 ? "+" : "−"}${money(Math.abs(dayMove)).slice(1)} today</i></span></div>
          <div class="mo-list">${stocks.map(s => `
            <div class="mo-stk">
              <div class="mo-l"><b>${esc(s.Ticker)}</b><span>${esc(s.Name)} · ${(+s.Shares || 0).toFixed(4).replace(/0+$/, "").replace(/\.$/, "")} sh</span></div>
              ${spark(s.pts, (+s["Day change %"] || 0) >= 0)}
              <div class="mo-r"><b>${s.Currency === "USD" ? "US" : ""}${money(+s.Price || 0)}</b><span class="${(+s["Day change %"] || 0) >= 0 ? "up" : "dn"}">${pct(+s["Day change %"] || 0)}</span></div>
              ${s.news ? `<p class="mo-news"><b>${s.news.Date === t ? "Today" : short(s.news.Date)}</b> ${esc(s.news["Why it matters to you"] || s.news.Headline)}</p>` : ""}
            </div>`).join("")}</div>
          <p class="mo-hint">${live && !stocks.some(s => s.pts.length > 2) ? "Charts fill in as daily prices are saved. " : ""}Shares update from your Wealthsimple emails. News is written every morning at 6.</p>
        </section>

        <section class="mo-sec">
          <h3>Pay over time</h3>
          ${bars(pay, nk)}
          <p class="mo-hint">Take-home is an estimate after tax, CPP and EI. Your real pay stub may differ slightly.</p>
        </section>

        ${tutOpen.length ? `
        <section class="mo-sec">
          <div class="mo-sh"><h3>Tutoring owed</h3><span class="mo-tot"><b>${money(tutOwed, false)}</b></span></div>
          <div class="mo-list">${tutOpen.map(r => `<div class="mo-row${busy.has("t" + r._row) ? " busy" : ""}"><div class="mo-l"><b>${esc(dow(r.Date).slice(0, 3))}, ${short(r.Date)}</b><span>${money(+r.Amount, false)} session</span></div><button class="mo-paid" data-act="paid" data-row="${r._row}">Mark paid</button></div>`).join("")}</div>
        </section>` : ""}

        <section class="mo-sec">
          <h3>Is a cover shift worth it?</h3>
          <div class="mo-chips">${POOLS.map(([k, n]) => `<button class="mo-chip" data-act="pool" data-pool="${k}" aria-pressed="${cover.pool === k}">${n}</button>`).join("")}</div>
          <p class="mo-hint"><span class="mo-step"><button data-act="hless" aria-label="Fewer hours">−</button>${hrs(cover.h)} hour shift<button data-act="hmore" aria-label="More hours">+</button></span></p>
          <div class="mo-cover">
            <div><b>${money(cNet, false)}</b><span>added take-home</span></div>
            <div><b>${money(cGas, false)}</b><span>gas, round trip</span></div>
            <div><b>${money(Math.max(cReal, 0))}</b><span>per hour with driving</span></div>
          </div>
          <p class="mo-hint">Uses ${km} km each way and ${mins} minutes of driving. These are estimates you can fix in the brain's Settings tab.</p>
        </section>
      </div>`;
  }

  /* ---------- actions ---------- */
  async function confirm(row, hours) {
    const st = B().get(); if (!st.data) { draw(); return; }
    const s = st.data.shifts.find(x => x._row === row); if (!s) return;
    busy.add(row); draw();
    try {
      const h = hours == null ? +s["Sched hours"] : hours;
      const status = hours == null || Math.abs(h - +s["Sched hours"]) < 0.01 ? "Confirmed" : "Adjusted";
      await B().write(`Shifts!F${row}:G${row}`, [[h, status]]);
      s["Confirmed hours"] = h; s.Status = status;
      B().log(status === "Confirmed" ? "Confirmed shift" : "Adjusted hours", "Shifts", `${s.Date} ${s.Location} ${h}h`);
      B().load();
    } catch (e) { if (e && e.code === "auth") B().connect(); }
    busy.delete(row); editRow = null; draw();
  }
  function saveHours(inp) {
    const v = parseFloat(inp.value);
    if (!(v >= 0 && v <= 14)) { inp.focus(); return; }
    confirm(+inp.dataset.row, v);
  }
  async function addSpend() {
    const w = $("moWhat"), a = $("moAmt"), amt = parseFloat(a.value);
    if (!(amt > 0)) { a.focus(); return; }
    const st = B().get(); if (!st.data) { B().connect(); return; }
    const what = w.value.trim() || "Purchase";
    st.data.spending.push({ Date: today(), Amount: amt, What: what }); draw();
    try { await B().append("Spending!A1", [[today(), amt, what, "", "App"]]); } catch (e) { if (e && e.code === "auth") B().connect(); }
  }
  async function markPaid(row) {
    const st = B().get(); if (!st.data) return;
    const r = st.data.tutoring.find(x => x._row === row); if (!r) return;
    busy.add("t" + row); draw();
    try { await B().write(`Tutoring!E${row}:F${row}`, [["Yes", today()]]); r.Paid = "Yes"; B().log("Marked tutoring paid", "Tutoring", r.Date); }
    catch (e) { if (e && e.code === "auth") B().connect(); }
    busy.delete("t" + row); draw();
  }
  function onClick(e) {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const a = b.dataset.act, row = +b.dataset.row;
    if (a === "pool") { cover.pool = b.dataset.pool; draw(); return; }
    if (a === "hless") { cover.h = Math.max(1, cover.h - 0.5); draw(); return; }
    if (a === "hmore") { cover.h = Math.min(10, cover.h + 0.5); draw(); return; }
    if (a === "spend") { addSpend(); return; }
    if (a === "paid") { if (B().get().data) { tap(); markPaid(row); } return; }
    if (a === "connect") { B().connect(); return; }
    if (a === "reload") { B().load(); return; }
    if (a === "jump-confirm") { $("moConfirm")?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    if (!B().get().data) return;
    tap();
    if (a === "ok") confirm(row);
    if (a === "edit") { editRow = row; draw(); setTimeout(() => document.querySelector(".mo-hin")?.select(), 30); }
    if (a === "save") saveHours(document.querySelector(`.mo-hin[data-row="${row}"]`));
  }

  function start() {
    mount();
    if (!B()) return;
    B().on(draw);
    draw();
    B().load();
    /* refresh when coming back to the app */
    document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - (B().get().at || 0) > 5 * 60e3) B().load(); });
    try { if (localStorage.getItem("ap-tab") === "money" && window.goTab) window.goTab("money"); } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
