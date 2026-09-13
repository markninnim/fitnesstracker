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

let currentWorkout = "pull";
let lastByExercise = {};

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
  const head = document.createElement("div");
  head.className = "ex-head";
  head.innerHTML = `<div class="ex-name">${ex.name}</div>` +
    `<div class="ex-prev">${prev ? `last: ${prev.weight ? prev.weight + "kg · " : ""}${prev.reps.join("/")}` : "no history yet"}</div>`;
  card.appendChild(head);

  const wRow = document.createElement("div");
  wRow.className = "weight-row";
  wRow.innerHTML = `<label>Weight / setting</label><input type="text" class="weight-input" placeholder="${prev && prev.weight ? prev.weight : "kg"}">`;
  card.appendChild(wRow);

  const sets = document.createElement("div");
  sets.className = "sets";
  for (let i=0;i<4;i++){
    const box = document.createElement("div");
    box.className = "set-box";
    const prevRep = prev && prev.reps[i] != null ? prev.reps[i] : "";
    box.innerHTML = `<label>Set ${i+1}${prevRep!=="" ? " (was "+prevRep+")" : ""}</label>` +
      `<input type="number" min="0" max="99" class="rep-input" data-idx="${i}" placeholder="${prevRep!=="" ? prevRep : "8"}">`;
    sets.appendChild(box);
  }
  card.appendChild(sets);

  const status = document.createElement("div");
  status.className = "status";
  card.appendChild(status);

  sets.querySelectorAll(".rep-input").forEach(inp => {
    inp.addEventListener("input", () => evaluateCard(card));
  });

  return card;
}

function evaluateCard(card){
  const inputs = [...card.querySelectorAll(".rep-input")];
  const reps = inputs.map(i => i.value === "" ? null : parseInt(i.value, 10));
  inputs.forEach((i, idx) => {
    i.classList.toggle("hit", reps[idx] !== null && reps[idx] >= 8);
  });
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

function collectSessionData(){
  const cards = [...document.querySelectorAll("#exercises .card")];
  const data = {};
  cards.forEach(card => {
    const exId = card.dataset.exId;
    const weight = card.querySelector(".weight-input").value.trim();
    const reps = [...card.querySelectorAll(".rep-input")].map(i => i.value === "" ? null : parseInt(i.value, 10));
    if (reps.some(r => r !== null)){
      data[exId] = { weight: weight || null, reps };
    }
  });
  return data;
}

async function loadLastSession(){
  lastByExercise = {};
  const date = document.getElementById("sessionDate").value;
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
  } catch(e){
    console.log("loadLastSession error", e);
  }
  renderExercises();
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
    toast("Session saved");
  } catch(e){
    console.log("save error", e);
    toast("Couldn't save — try again");
    return;
  }
  loadHistory();
}

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
        return `<div class="h-ex"><span>${name}</span><span>${v.weight ? v.weight+"kg " : ""}${v.reps.join("/")}</span></div>`;
      }).join("");
      card.innerHTML = `<div class="h-date">${d.date} · ${d.workout === "pull" ? "Pull day" : "Push day"}</div>${lines}`;
      list.appendChild(card);
    });
  } catch(e){
    console.log("history error", e);
    list.innerHTML = "<div class='hist-card'>Couldn't load history.</div>";
  }
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

function switchWorkout(w){
  currentWorkout = w;
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.w === w));
  loadLastSession();
}

document.querySelectorAll(".tab").forEach(t => {
  t.addEventListener("click", () => switchWorkout(t.dataset.w));
});
document.getElementById("sessionDate").addEventListener("change", loadLastSession);
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

// Register a minimal service worker so iOS treats this as an installable app.
if ("serviceWorker" in navigator){
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
