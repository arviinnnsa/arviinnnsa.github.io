/* ARVIN Brain: the private Google Sheet that holds money, stocks, school and to-do data.
   The app reads it with your own Google sign-in. No numbers live in this public code. */
(function () {
  "use strict";
  const DEFAULT_ID = "1oionirOeOYxCzuNe9_XByD-dq4HI249J06spaJ0w6jM";
  const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
  const API = "https://sheets.googleapis.com/v4/spreadsheets/";
  const CACHE = "ap-brain-cache";

  const id = () => { try { return localStorage.getItem("ap-brain-id") || DEFAULT_ID; } catch (e) { return DEFAULT_ID; } };
  const token = () => {
    try { const t = JSON.parse(localStorage.getItem("ap-tok") || "null"); return t && t.exp > Date.now() ? t.token : null; } catch (e) { return null; }
  };

  /* serial date from Sheets -> "YYYY-MM-DD" */
  const pad = n => String(n).padStart(2, "0");
  const fromSerial = v => {
    if (typeof v !== "number") return typeof v === "string" ? v.slice(0, 10) : "";
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5);
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
  };
  const toRows = (values) => {
    if (!values || !values.length) return [];
    const [head, ...rows] = values;
    return rows.filter(r => r.some(c => c !== "" && c != null)).map((r, i) => {
      const o = { _row: i + 2 };
      head.forEach((h, j) => { o[h] = r[j] === undefined ? "" : r[j]; });
      return o;
    });
  };

  let state = { status: "idle", error: null, data: null, at: 0 };
  try { const c = JSON.parse(localStorage.getItem(CACHE) || "null"); if (c && c.data) state = { status: "cached", error: null, data: c.data, at: c.at }; } catch (e) {}
  const subs = new Set();
  const emit = () => subs.forEach(f => { try { f(state); } catch (e) {} });

  async function call(path, opts = {}) {
    const t = token();
    if (!t) throw { code: "auth" };
    const r = await fetch(API + id() + path, { ...opts, headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" } });
    if (r.status === 401) throw { code: "auth" };
    if (!r.ok) {
      let m = "", link = "";
      try { const j = await r.json(); m = j.error?.message || ""; } catch (e) {}
      const u = m.match(/https:\/\/console\.developers\.google\.com\S+/);
      if (u) link = u[0].replace(/[.)]+$/, "");
      if (r.status === 403 && /insufficient|scope/i.test(m)) throw { code: "scope" };
      if (r.status === 403 && link) throw { code: "api", link };
      throw { code: "http", status: r.status, message: m };
    }
    return r.json();
  }

  const RANGES = ["Settings!A1:C30", "Pay!A1:L40", "Shifts!A1:L400", "Tutoring!A1:G300", "Stocks!A1:K8",
    "Prices!A1:D2000", "News!A1:F400", "Trades!A1:H300"];

  async function load() {
    if (!token()) { state = { ...state, status: state.data ? "cached" : "signedout", error: { code: "auth" } }; emit(); return state; }
    state = { ...state, status: "loading" }; emit();
    try {
      const q = RANGES.map(r => "ranges=" + encodeURIComponent(r)).join("&");
      const j = await call(`/values:batchGet?${q}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`);
      const out = {};
      (j.valueRanges || []).forEach((vr, i) => { out[RANGES[i].split("!")[0]] = vr.values || []; });
      const settings = {};
      toRows(out.Settings).forEach(r => { if (r.Setting) settings[r.Setting] = r.Value; });
      /* the Stocks tab has a holdings table on top and summary cells below it */
      const st = out.Stocks || [];
      const holdings = toRows(st.slice(0, 4)).filter(r => r.Ticker);
      const sumRow = k => { const r = st.find(x => x[0] === k); return r ? r[1] : ""; };
      const data = {
        settings,
        pay: toRows(out.Pay).map(r => ({ ...r, Payday: fromSerial(r.Payday), "Period start": fromSerial(r["Period start"]), "Period end": fromSerial(r["Period end"]) })),
        shifts: toRows(out.Shifts).map(r => ({ ...r, Date: fromSerial(r.Date), Payday: fromSerial(r.Payday), "Period end": fromSerial(r["Period end"]) })),
        tutoring: toRows(out.Tutoring).map(r => ({ ...r, Date: fromSerial(r.Date) })),
        stocks: holdings,
        usdcad: +sumRow("USD→CAD") || 1.38,
        portfolio: +sumRow("Total value (CAD)") || 0,
        prices: toRows(out.Prices).map(r => ({ ...r, Date: fromSerial(r.Date) })),
        news: toRows(out.News).map(r => ({ ...r, Date: fromSerial(r.Date) })),
        trades: toRows(out.Trades).map(r => ({ ...r, Date: fromSerial(r.Date) }))
      };
      state = { status: "ready", error: null, data, at: Date.now() };
      try { localStorage.setItem(CACHE, JSON.stringify({ data, at: state.at })); } catch (e) {}
    } catch (err) {
      state = { ...state, status: state.data ? "cached" : "error", error: err };
    }
    emit();
    return state;
  }

  async function write(range, values) {
    return call(`/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, { method: "PUT", body: JSON.stringify({ range, values }) });
  }
  async function append(range, values) {
    return call(`/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, { method: "POST", body: JSON.stringify({ values }) });
  }
  async function log(action, tab, detail) {
    const d = new Date();
    const when = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
    try { await append("Log!A1", [[when, "App", action, tab, detail]]); } catch (e) {}
  }

  /* Adds Sheets access to the same Google sign-in the planner already uses. */
  function connect() {
    let cid = "";
    try { cid = localStorage.getItem("ap-cid") || ""; } catch (e) {}
    if (!cid) { alert("Open Settings and sign in to Google first."); return; }
    const q = new URLSearchParams({
      client_id: cid, redirect_uri: location.origin + "/", response_type: "token", include_granted_scopes: "true",
      scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file " + SCOPE
    });
    try { sessionStorage.setItem("ap-brain-back", location.pathname); } catch (e) {}
    location.href = "https://accounts.google.com/o/oauth2/v2/auth?" + q;
  }

  window.apBrain = {
    get: () => state, load, write, append, log, connect, fromSerial,
    url: () => "https://docs.google.com/spreadsheets/d/" + id() + "/edit",
    on: f => { subs.add(f); return () => subs.delete(f); }
  };

  /* after the Google redirect lands on the main page, return to the page that asked (e.g. the preview) */
  try {
    const back = sessionStorage.getItem("ap-brain-back");
    if (back && token() && location.pathname !== back) { sessionStorage.removeItem("ap-brain-back"); location.replace(back); }
    else if (back && location.pathname === back) sessionStorage.removeItem("ap-brain-back");
  } catch (e) {}
})();
