const express = require("express");
const path = require("path");
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");

// DB_PATH lets you point at a mounted Railway volume so data survives
// redeploys, e.g. DB_PATH=/data/db.json with a volume mounted at /data.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data", "db.json");

const adapter = new FileSync(DB_PATH);
const db = low(adapter);
db.defaults({ sessions: [] }).write();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// GET /api/sessions?workout=pull&before=2026-09-13&limit=5
// Used to find the most recent session(s) before a given date, per workout.
app.get("/api/sessions", (req, res) => {
  const { workout, before, limit } = req.query;
  let rows = db.get("sessions").value();
  if (workout) rows = rows.filter((r) => r.workout === workout);
  if (before) rows = rows.filter((r) => r.date < before);
  rows = [...rows].sort((a, b) => (a.date < b.date ? 1 : -1));
  if (limit) rows = rows.slice(0, parseInt(limit, 10));
  res.json(rows);
});

// GET /api/sessions/by-id/:id  - exact lookup, used to load a session for editing
app.get("/api/sessions/by-id/:id", (req, res) => {
  const row = db.get("sessions").find({ id: req.params.id }).value();
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

// GET /api/sessions/all?workout=pull  - full history for one workout, used for streaks/sparklines
app.get("/api/sessions/all", (req, res) => {
  const { workout, limit } = req.query;
  let rows = db.get("sessions").value();
  if (workout) rows = rows.filter((r) => r.workout === workout);
  rows = [...rows].sort((a, b) => (a.date < b.date ? 1 : -1));
  if (limit) rows = rows.slice(0, parseInt(limit, 10));
  res.json(rows);
});

// GET /api/sessions/history?limit=10
app.get("/api/sessions/history", (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  let rows = db.get("sessions").value();
  rows = [...rows].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, limit);
  res.json(rows);
});

// PUT /api/sessions/:id  (id = `${date}_${workout}`) - full replace/create
app.put("/api/sessions/:id", (req, res) => {
  const id = req.params.id;
  const { date, workout, exercises } = req.body || {};
  if (!date || !workout || !exercises) {
    return res.status(400).json({ error: "date, workout and exercises are required" });
  }
  const body = { id, date, workout, exercises, savedAt: new Date().toISOString() };
  const existing = db.get("sessions").find({ id }).value();
  if (existing) {
    db.get("sessions").find({ id }).assign(body).write();
  } else {
    db.get("sessions").push(body).write();
  }
  res.json(body);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Pull & Push tracker listening on port ${PORT}`);
});
