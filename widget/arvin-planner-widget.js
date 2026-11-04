// Arvin Planner widget for Scriptable (iPhone Lock Screen + Home Screen)
// Shows what's next, a countdown and when to leave, in the planner's look.
// Reads your events from the iPhone Calendar app, so turn on your Google
// account there: Settings > Calendar > Accounts > Google > Calendars.
//
// Lock Screen: rectangular, inline (above the clock) or circular.
// Home Screen: small or medium.
// Tapping the widget opens the planner.

const APP_URL = "https://arviinnnsa.github.io/";

// Minutes from home, same as the planner's Settings. Change any to match.
const DRIVE = { langara: 35, parkroyal: 50, jericho: 45, richmond: 40, fremont: 15, gtv: 35, pool: 35 };
const BUFFER = 10; // minutes to park and walk in

// Planner colours (night palette, so they read on the dark card)
const C = {
  work: "#F0C23C", econ: "#4CC48A", poli: "#F28A5F", fmgt: "#8C98F2", cls: "#8C98F2",
  exam: "#FF5C70", due: "#C38BEA", gym: "#6FC79A", tutor: "#E08BBE", life: "#E99A93"
};
const BG_TOP = "#1C1D21", BG_BOTTOM = "#0D0E10", INK = "#FBFCFF", MUTED = "#A3A5A8";

// ---------- events ----------
const now = new Date();
const later = new Date(now.getTime() + 2 * 864e5);
let events = [];
try {
  events = await CalendarEvent.between(now, later, []);
} catch (e) {}
events = events
  .filter(e => !e.isAllDay && e.endDate > now && !/^\s*✅/.test(e.title || "") && !/holiday/i.test(e.calendar?.title || ""))
  .sort((a, b) => a.startDate - b.startDate);

function clean(t) {
  return (t || "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}️]/gu, "").replace(/\s+/g, " ").trim();
}
function short(t) {
  const c = clean(t);
  const m = c.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (m) return m[1];
  return c.split(/\s[—–]\s/)[0];
}
function kind(e) {
  const t = e.title || "";
  if (/midterm|final exam|\bexam\b/i.test(t)) return C.exam;
  if (/\bdue\b/i.test(t)) return C.due;
  if (/pedalheads|swim/i.test(t)) return C.work;
  if (/\bECON\b/i.test(t)) return C.econ;
  if (/\bPOLI\b/i.test(t)) return C.poli;
  if (/\bFMGT\b/i.test(t)) return C.fmgt;
  if (/[A-Z]{3,4}\s?\d{4}/.test(t)) return C.cls;
  if (/gym|workout|sport/i.test(t)) return C.gym;
  if (/tutor/i.test(t)) return C.tutor;
  return C.life;
}
function place(e) {
  const s = `${e.location || ""} ${e.title || ""}`.toLowerCase();
  if (/\bdue\b/.test(s)) return null;
  if (/park\s*royal/.test(s)) return "parkroyal";
  if (/jericho/.test(s)) return "jericho";
  if (/richmond/.test(s)) return "richmond";
  if (/fremont/.test(s)) return "fremont";
  if (/\bgtv\b/.test(s)) return "gtv";
  if (/langara/.test(s) || /[a-z]{3,4}\s?\d{4}/.test(s)) return "langara";
  if (/pedalheads|swim/.test(s)) return "pool";
  return null;
}
const df = new DateFormatter();
df.useNoDateStyle(); df.useShortTimeStyle();
const t12 = d => df.string(d).replace(":00", "").replace(/\s?([AP]M)/i, " $1");
function until(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return `${m}m`;
  const H = Math.floor(m / 60), M = m % 60;
  return M ? `${H}h ${M}m` : `${H}h`;
}

const cur = events.find(e => e.startDate <= now);
const next = events.find(e => e.startDate > now);
const focus = cur || next;
let leave = null;
if (next && !cur) {
  const p = place(next);
  if (p) leave = new Date(next.startDate.getTime() - (DRIVE[p] + BUFFER) * 60000);
}
const countdown = focus ? (cur ? until(cur.endDate - now) : until(focus.startDate - now)) : "";
const label = focus ? (cur ? "left" : "until") : "";

// ---------- widgets ----------
const fam = config.widgetFamily || "medium";
const w = new ListWidget();
w.url = APP_URL;
w.refreshAfterDate = new Date(now.getTime() + 5 * 60000);

if (fam.startsWith("accessory")) {
  // Lock Screen: the system tints these, so keep them simple and clear
  if (!focus) {
    const t = w.addText(fam === "accessoryInline" ? "Nothing else today" : "Free");
    t.font = Font.semiboldSystemFont(13);
  } else if (fam === "accessoryInline") {
    w.addText(`${short(focus.title)} ${cur ? "now" : t12(focus.startDate)} · ${countdown}${cur ? " left" : ""}`);
  } else if (fam === "accessoryCircular") {
    w.addAccessoryWidgetBackground = true;
    const s = w.addStack(); s.layoutVertically(); s.centerAlignContent();
    const a = s.addText(countdown.split(" ")[0]); a.font = Font.thinSystemFont(22); a.centerAlignText(); a.minimumScaleFactor = .6;
    const b = s.addText(countdown.split(" ")[1] || (cur ? "left" : "to go")); b.font = Font.mediumSystemFont(10); b.centerAlignText();
  } else {
    const top = w.addText(`${cur ? "NOW" : "UP NEXT"} · ${t12(focus.startDate)}`.toUpperCase());
    top.font = Font.semiboldSystemFont(11); top.textOpacity = .75;
    const title = w.addText(short(focus.title));
    title.font = Font.semiboldSystemFont(15); title.lineLimit = 1; title.minimumScaleFactor = .7;
    const sub = w.addText(leave && leave > now ? `in ${countdown} · leave ${t12(leave)}` : `${cur ? countdown + " left" : "in " + countdown}${focus.location ? " · " + clean(focus.location).split(",")[0] : ""}`);
    sub.font = Font.lightSystemFont(13); sub.lineLimit = 1; sub.minimumScaleFactor = .7;
  }
} else {
  // Home Screen: dark glass card like the app
  const g = new LinearGradient();
  g.colors = [new Color(BG_TOP), new Color(BG_BOTTOM)];
  g.locations = [0, 1];
  w.backgroundGradient = g;
  w.setPadding(14, 16, 14, 16);

  const head = w.addStack(); head.centerAlignContent();
  const wm = head.addText("Arvin"); wm.font = Font.semiboldSystemFont(12); wm.textColor = new Color(INK);
  const wm2 = head.addText("Planner"); wm2.font = Font.lightSystemFont(12); wm2.textColor = new Color(INK);
  head.addSpacer();
  const day = head.addText(new Intl.DateTimeFormat("en-CA", { weekday: "short", day: "numeric" }).format(now).toUpperCase());
  day.font = Font.mediumSystemFont(10); day.textColor = new Color(MUTED);
  w.addSpacer(fam === "small" ? 6 : 8);

  const body = w.addStack();
  const left = body.addStack(); left.layoutVertically();
  if (focus) {
    const big = left.addText(countdown);
    big.font = Font.thinSystemFont(fam === "small" ? 34 : 40); big.textColor = new Color(INK); big.minimumScaleFactor = .6; big.lineLimit = 1;
    const l = left.addText(`${label} ${short(focus.title)}`.toUpperCase());
    l.font = Font.semiboldSystemFont(9); l.textColor = new Color(MUTED); l.lineLimit = 2;
    left.addSpacer(6);
    const pill = left.addStack();
    pill.backgroundColor = new Color("#FFFFFF", .1); pill.cornerRadius = 10; pill.setPadding(4, 8, 4, 8);
    const pt = pill.addText(leave && leave > now ? `Leave by ${t12(leave)}` : `${t12(focus.startDate)} – ${t12(focus.endDate)}`);
    pt.font = Font.mediumSystemFont(10); pt.textColor = new Color(INK); pt.lineLimit = 1;
  } else {
    const big = left.addText("Free");
    big.font = Font.thinSystemFont(40); big.textColor = new Color(INK);
    const l = left.addText("NOTHING ELSE TODAY"); l.font = Font.semiboldSystemFont(9); l.textColor = new Color(MUTED);
  }

  if (fam !== "small") {
    body.addSpacer(14);
    const right = body.addStack(); right.layoutVertically(); right.size = new Size(150, 0);
    const list = events.filter(e => e !== cur).slice(0, 3);
    if (!list.length) { const t = right.addText("Nothing else coming up"); t.font = Font.lightSystemFont(12); t.textColor = new Color(MUTED); }
    for (const e of list) {
      const row = right.addStack(); row.centerAlignContent();
      const bar = row.addStack(); bar.size = new Size(3, 26); bar.cornerRadius = 2; bar.backgroundColor = new Color(kind(e));
      row.addSpacer(8);
      const col = row.addStack(); col.layoutVertically();
      const tm = col.addText(`${e.startDate.toDateString() === now.toDateString() ? "" : "Tmrw "}${t12(e.startDate)}`);
      tm.font = Font.mediumSystemFont(10); tm.textColor = new Color(MUTED);
      const ti = col.addText(short(e.title)); ti.font = Font.semiboldSystemFont(12); ti.textColor = new Color(INK); ti.lineLimit = 1;
      right.addSpacer(6);
    }
  }
  body.addSpacer();
}

if (config.runsInWidget) Script.setWidget(w);
else if (config.runsInAccessoryWidget) Script.setWidget(w);
else await w.presentMedium();
Script.complete();
