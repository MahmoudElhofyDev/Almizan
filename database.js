
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "mizan.json");

function ensureDatabase() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
      users: [],
      cases: [],
      powers: [],
      nextCaseId: 1,
      nextPowerId: 1
    }, null, 2), "utf8");
  }
}

function readDatabase() {
  ensureDatabase();
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  const db = JSON.parse(raw || "{}");
  db.users = Array.isArray(db.users) ? db.users : [];
  db.cases = Array.isArray(db.cases) ? db.cases : [];
  db.powers = Array.isArray(db.powers) ? db.powers : [];
  db.nextCaseId = Number(db.nextCaseId) || 1;
  db.nextPowerId = Number(db.nextPowerId) || 1;
  return db;
}

function writeDatabase(db) {
  ensureDatabase();
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf8");
  fs.renameSync(tmp, DATA_FILE);
}

module.exports = { readDatabase, writeDatabase, ensureDatabase, DATA_FILE };
