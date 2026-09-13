const WORKOUTS = {
  pull: [
    { group: null, exercises: [
      { id: "single_arm_row", name: "Single arm row (bench + dumbbell)" },
    ]},
    { group: null, exercises: [
      { id: "lat_pulldown", name: "Lat pull down machine" },
    ]},
    { group: "Superset · short bar", exercises: [
      { id: "cable_bicep_curl", name: "Cable bicep curl" },
      { id: "cable_high_pull", name: "Cable high pull" },
    ]},
    { group: "Superset · rope", exercises: [
      { id: "tricep_extension", name: "Tricep extension" },
      { id: "face_pull", name: "Face pull" },
    ]},
    { group: null, exercises: [
      { id: "assisted_pullup", name: "Assisted pull up (finisher)" },
    ]},
  ],
  push: [
    { group: "Superset · flat bench", exercises: [
      { id: "db_chest_press", name: "Dumbbell chest press" },
      { id: "db_chest_fly", name: "Dumbbell chest fly" },
    ]},
    { group: null, exercises: [
      { id: "smith_incline_press", name: "Smith machine incline chest press" },
    ]},
    { group: null, exercises: [
      { id: "shoulder_press_machine", name: "Shoulder press machine" },
    ]},
    { group: null, exercises: [
      { id: "cable_fly_incline", name: "Cable machine chest fly (incline)" },
    ]},
    { group: null, exercises: [
      { id: "cable_fly_decline", name: "Cable machine chest fly (decline)" },
    ]},
    { group: "Superset", exercises: [
      { id: "lateral_raise", name: "Lateral raise" },
      { id: "front_raise", name: "Front raise" },
    ]},
    { group: null, exercises: [
      { id: "shoulder_shrugs", name: "Shoulder shrugs" },
    ]},
  ],
};

const WEIGHT_STEP = 2;

let currentWorkout = "pull";
let lastByExercise = {};   // most recent prior session per exercise (for placeholders)
let sparkByExercise = {};  // recent history per exercise (for sparklines)
let editingExisting = null; // the loaded session doc if we're editing a saved one, else null
let restInterval = null;

function todayStr(){
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off*60000).toISOString().slice(0,10);
}

function toast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"), 1800);
}

// ---------- rendering ----------

function renderExercises(){
  const container = document.getElementById("exercises");
  container.innerHTML = "";
  const groups = WORKOUTS[currentWorkout];
  groups.forEach(g => {
    const gWrap = document.createElement("div");
    gWrap.className = "group";
    if (g.group){
      const lab = document.createElement("div");
      lab.className = "group-label";
      lab.textContent = g.group;
      gWrap.appendChild(lab);
    }
    g.exercises.forEach(ex => {
      gWrap.appendChild(renderExerciseCard(ex));
    });
    container.appendChild(gWrap);
  });
}

function renderExerciseCard(ex){
  const card = document.createElement("div");
  card.className = "card";
  card.dataset.exId = ex.id;

  const prev = lastByExercise[ex.id];
  const existing = editingExisting && editingExisting.exercises && editingExisting.exercises[ex.id];

  const head = document.createElement("div");
  head.className = "ex-head";
  const prevText = prev ? `last: ${prev.weight ? prev.weight + "kg · " : ""}${prev.reps.map(r=>r==null?"–":r).join("/")}` : "no history yet";
  head.innerHTML = `<div class="ex-name">${ex.name}</div>` +
    `<div class="ex-prev">${prevText}${sparkSvg(sparkByExercise[ex.id])}</div>`;
  card.appendChild(head);

  // starting weight: editing an existing session -> that value; else remembered last weight
  const startWeight = existing ? (existing.weight != null ? Number(existing.weight) : 0)
                     : (prev && prev.weight ? Number(prev.weight) : 0);

  const wRow = document.createElement("div");
  wRow.className = "weight-row";
  wRow.innerHTML = `<label>Weight / setting</label>
    <div class="stepper weight-stepper">
      <button type="button" class="w-down">&minus;</button>
      <span class="stepper-val w-val">${startWeight ? startWeight + "kg" : "—"}</span>
      <button type="button" class="w-up">+</button>
    </div>`;
  card.appendChild(wRow);
  card.dataset.weight = startWeight || "";

  const sets = document.createElement("div");
  sets.className = "sets";
  for (let i=0;i<4;i++){
    const box = document.createElement("div");
    box.className = "set-box";
    let startRep = null;
    if (existing && existing.reps && existing.reps[i] != null) startRep = existing.reps[i];
    const isHit = startRep != null && startRep >= 8;
    box.innerHTML = `<label>Set ${i+1}</label>
      <div class="rep-stepper" data-idx="${i}">
        <button type="button" class="rep-up">+</button>
        <div class="rep-val ${startRep==null ? "empty" : (isHit ? "hit" : "")}">${startRep==null ? "–" : startRep}</div>
        <button type="button" class="rep-down">&minus;</button>
      </div>`;
    sets.appendChild(box);
  }
  card.appendChild(sets);

  const status = document.createElement("div");
  status.className = "status";
  card.appendChild(status);

  const noteRow = document.createElement("div");
  noteRow.className = "note-row";
  noteRow.innerHTML = `<textarea placeholder="Notes (form cues, how it felt...)">${existing && existing.note ? existing.note : ""}</textarea>`;
  card.appendChild(noteRow);

  const restRow = document.createElement("div");
  restRow.style.marginTop = "8px";
  restRow.innerHTML = `<span class="history-toggle start-rest" style="margin:0;">Start rest timer</span>`;
  card.appendChild(restRow);
  restRow.querySelector(".start-rest").addEventListener("click", () => startRestTimer());

  // wire steppers
  const wVal = wRow.querySelector(".w-val");
  wRow.querySelector(".w-up").addEventListener("click", () => {
    const cur = Number(card.dataset.weight) || 0;
    const next = cur + WEIGHT_STEP;
    card.dataset.weight = next;
    wVal.textContent = next + "kg";
  });
  wRow.querySelector(".w-down").addEventListener("click", () => {
    const cur = Number(card.dataset.weight) || 0;
    const next = Math.max(0, cur - WEIGHT_STEP);
    card.dataset.weight = next;
    wVal.textContent = next ? next + "kg" : "—";
  });

  sets.querySelectorAll(".rep-stepper").forEach(stepper => {
    const valEl = stepper.querySelector(".rep-val");
    const setRep = (n) => {
      if (n == null){
        stepper.dataset.rep = "";
        valEl.textContent = "–";
        valEl.className = "rep-val empty";
      } else {
        n = Math.max(0, Math.min(99, n));
        stepper.dataset.rep = n;
        valEl.textContent = n;
        valEl.className = "rep-val" + (n >= 8 ? " hit" : "");
      }
      evaluateCard(card);
    };
    if (startRepForIdx(existing, stepper) != null) stepper.dataset.rep = startRepForIdx(existing, stepper);
    stepper.querySelector(".rep-up").addEventListener("click", () => {
      const cur = stepper.dataset.rep === "" || stepper.dataset.rep === undefined ? -1 : Number(stepper.dataset.rep);
      setRep(cur + 1 < 0 ? 0 : cur + 1);
    });
    stepper.querySelector(".rep-down").addEventListener("click", () => {
      const cur = stepper.dataset.rep === "" || stepper.dataset.rep === undefined ? null : Number(stepper.dataset.rep);
      if (cur == null) return;
      if (cur <= 0) setRep(null);
      else setRep(cur - 1);
    });
  });

  evaluateCard(card);
  return card;
}

function startRepForIdx(existing, stepperEl){
  if (!existing || !existing.reps) return null;
  const idx = Number(stepperEl.dataset.idx);
  return existing.reps[idx] != null ? existing.reps[idx] : null;
}

function sparkSvg(points){
  if (!points || points.length < 2) return "";
  // points: array of {date, hit} oldest->newest, hit = true if 8/8/8/8
  const w = 60, h = 16, n = points.length;
  const step = w / (n - 1);
  const coords = points.map((p, i) => `${(i*step).toFixed(1)},${p.hit ? 2 : h-2}`);
  const dots = points.map((p, i) => `<circle cx="${(i*step).toFixed(1)}" cy="${p.hit ? 2 : h-2}" r="1.6" fill="${p.hit ? 'var(--good)' : 'var(--build)'}"/>`).join("");
  return `<svg class="spark" width="${w}" height="${h}"><polyline points="${coords.join(" ")}" fill="none" stroke="var(--border)" stroke-width="1"/>${dots}</svg>`;
}

function evaluateCard(card){
  const reps = [...card.querySelectorAll(".rep-stepper")].map(s => s.dataset.rep === "" || s.dataset.rep === undefined ? null : Number(s.dataset.rep));
  const statusEl = card.querySelector(".status");
  const filled = reps.filter(r => r !== null);
  if (filled.length < 4){
    statusEl.classList.remove("show");
    return;
  }
  const allEight = reps.every(r => r >= 8);
  statusEl.classList.add("show");
  if (allEight){
    statusEl.className = "status show up";
    statusEl.textContent = "8/8/8/8 — go up a touch next time (+2kg or the next dumbbell).";
  } else {
    const low = Math.min(...reps);
    statusEl.className = "status show build";
    statusEl.textContent = `Sweet spot — that's your number to build on. Beat ${low} next time.`;
  }
}

// ---------- data collection / save ----------

function collectSessionData(){
  const cards = [...document.querySelectorAll("#exercises .card")];
  const data = {};
  cards.forEach(card => {
    const exId = card.dataset.exId;
    const weight = Number(card.dataset.weight) || null;
    const reps = [...card.querySelectorAll(".rep-stepper")].map(s => s.dataset.rep === "" || s.dataset.rep === undefined ? null : Number(s.dataset.rep));
    const note = card.querySelector(".note-row textarea").value.trim();
    if (reps.some(r => r !== null) || note){
      data[exId] = { weight, reps, note: note || undefined };
    }
  });
  return data;
}

// ---------- loading (last-session placeholders + edit-existing) ----------

async function loadSessionForDate(){
  const date = document.getElementById("sessionDate").value;
  const docId = `${date}_${currentWorkout}`;
  editingExisting = null;
  lastByExercise = {};

  // 1) try to load the exact session for this date (edit mode)
  try {
    const res = await fetch(`/api/sessions/by-id/${docId}`);
    if (res.ok){
      editingExisting = await res.json();
    }
  } catch(e){ console.log("load-existing error", e); }

  // 2) always load recent history before this date for placeholders/comparison
  try {
    const res = await fetch(`/api/sessions?workout=${currentWorkout}&before=${date}&limit=5`);
    const rows = await res.json();
    rows.forEach(d => {
      const ex = d.exercises || {};
      Object.keys(ex).forEach(exId => {
        if (!lastByExercise[exId]){
          lastByExercise[exId] = { date: d.date, weight: ex[exId].weight, reps: ex[exId].reps };
        }
      });
    });
  } catch(e){ console.log("loadLastSession error", e); }

  document.getElementById("editingBadge").style.display = editingExisting ? "inline-block" : "none";

  await loadSparklines();
  renderExercises();
}

async function loadSparklines(){
  sparkByExercise = {};
  try {
    const res = await fetch(`/api/sessions/all?workout=${currentWorkout}&limit=8`);
    const rows = await res.json();
    const ordered = [...rows].reverse(); // oldest -> newest
    ordered.forEach(d => {
      const ex = d.exercises || {};
      Object.keys(ex).forEach(exId => {
        if (!sparkByExercise[exId]) sparkByExercise[exId] = [];
        const reps = ex[exId].reps || [];
        const hit = reps.length === 4 && reps.every(r => r != null && r >= 8);
        sparkByExercise[exId].push({ date: d.date, hit });
      });
    });
  } catch(e){ console.log("sparkline error", e); }
}

async function saveSession(){
  const date = document.getElementById("sessionDate").value;
  const data = collectSessionData();
  if (Object.keys(data).length === 0){
    toast("Log at least one set first");
    return;
  }
  const docId = `${date}_${currentWorkout}`;
  try {
    const res = await fetch(`/api/sessions/${docId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, workout: currentWorkout, exercises: data }),
    });
    if (!res.ok) throw new Error("bad response");
    toast(editingExisting ? "Session updated" : "Session saved");
  } catch(e){
    console.log("save error", e);
    toast("Couldn't save — try again");
    return;
  }
  loadSessionForDate();
  loadHistory();
  loadStreak();
}

// ---------- history list ----------

async function loadHistory(){
  const list = document.getElementById("historyList");
  try {
    const res = await fetch("/api/sessions/history?limit=10");
    const rows = await res.json();
    if (rows.length === 0){
      list.innerHTML = "<div class='hist-card'>No sessions logged yet.</div>";
      return;
    }
    list.innerHTML = "";
    rows.forEach(d => {
      const card = document.createElement("div");
      card.className = "hist-card";
      const lines = Object.entries(d.exercises || {}).map(([id, v]) => {
        const name = findExName(id);
        const noteLine = v.note ? `<div class="h-note">${escapeHtml(v.note)}</div>` : "";
        return `<div class="h-ex"><span>${name}</span><span>${v.weight ? v.weight+"kg " : ""}${(v.reps||[]).map(r=>r==null?"–":r).join("/")}</span></div>${noteLine}`;
      }).join("");
      card.innerHTML = `<div class="h-date"><span>${d.date} · ${d.workout === "pull" ? "Pull day" : "Push day"}</span><span class="h-edit">edit &rsaquo;</span></div>${lines}`;
      card.addEventListener("click", () => {
        switchWorkout(d.workout, d.date);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      list.appendChild(card);
    });
  } catch(e){
    console.log("history error", e);
    list.innerHTML = "<div class='hist-card'>Couldn't load history.</div>";
  }
}

function escapeHtml(s){
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function findExName(id){
  for (const w of Object.values(WORKOUTS)){
    for (const g of w){
      for (const ex of g.exercises){
        if (ex.id === id) return ex.name;
      }
    }
  }
  return id;
}

// ---------- streak ----------

async function loadStreak(){
  const el = document.getElementById("streak");
  try {
    const res = await fetch("/api/sessions/history?limit=200");
    const rows = await res.json();
    if (rows.length === 0){ el.textContent = ""; return; }
    // count distinct ISO weeks with at least one session, walking back from the most recent week with no gap
    const weekKey = (dateStr) => {
      const d = new Date(dateStr + "T00:00:00");
      const day = (d.getDay() + 6) % 7; // Mon=0
      const monday = new Date(d);
      monday.setDate(d.getDate() - day);
      return monday.toISOString().slice(0,10);
    };
    const weeks = new Set(rows.map(r => weekKey(r.date)));
    const sortedWeeks = [...weeks].sort().reverse();
    let streak = 0;
    let cursor = new Date(weekKey(todayStr()) + "T00:00:00");
    for (;;){
      const key = cursor.toISOString().slice(0,10);
      if (weeks.has(key)){
        streak++;
        cursor.setDate(cursor.getDate() - 7);
      } else if (streak === 0 && key !== sortedWeeks[0]) {
        // this week has no session yet — check last week before giving up
        cursor.setDate(cursor.getDate() - 7);
        if (weeks.has(cursor.toISOString().slice(0,10))) continue;
        break;
      } else break;
    }
    el.innerHTML = streak > 0 ? `<b>${streak}</b> week${streak===1?"":"s"} streak` : "Log a session to start a streak";
  } catch(e){
    console.log("streak error", e);
  }
}

// ---------- rest timer ----------

function startRestTimer(seconds){
  seconds = seconds || 90;
  const box = document.getElementById("restTimer");
  const clock = document.getElementById("restClock");
  box.style.display = "flex";
  clearInterval(restInterval);
  let remaining = seconds;
  const render = () => {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    clock.textContent = `${m}:${String(s).padStart(2,"0")}`;
  };
  render();
  restInterval = setInterval(() => {
    remaining--;
    if (remaining <= 0){
      clearInterval(restInterval);
      box.style.display = "none";
      toast("Rest done — next set!");
      return;
    }
    render();
  }, 1000);
}

document.getElementById("restAdd30").addEventListener("click", () => {
  // just restart with +30s from whatever's currently shown
  const clock = document.getElementById("restClock");
  const [m, s] = clock.textContent.split(":").map(Number);
  startRestTimer(m*60 + s + 30);
});
document.getElementById("restSkip").addEventListener("click", () => {
  clearInterval(restInterval);
  document.getElementById("restTimer").style.display = "none";
});

// ---------- workout switching ----------

function switchWorkout(w, date){
  currentWorkout = w;
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.w === w));
  if (date) document.getElementById("sessionDate").value = date;
  loadSessionForDate();
}

document.querySelectorAll(".tab").forEach(t => {
  t.addEventListener("click", () => switchWorkout(t.dataset.w));
});
document.getElementById("sessionDate").addEventListener("change", loadSessionForDate);
document.getElementById("saveBtn").addEventListener("click", saveSession);
document.getElementById("historyToggle").addEventListener("click", () => {
  const list = document.getElementById("historyList");
  const showing = list.style.display !== "none";
  list.style.display = showing ? "none" : "block";
  document.getElementById("historyToggle").textContent = showing ? "Show recent history ↓" : "Hide history ↑";
  if (!showing) loadHistory();
});

document.getElementById("sessionDate").value = todayStr();
switchWorkout("pull");
loadHistory();
loadStreak();

// Register a minimal service worker so iOS treats this as an installable app.
if ("serviceWorker" in navigator){
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
