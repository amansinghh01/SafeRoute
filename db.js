const Database = require('better-sqlite3');
const db = new Database('saferoute.db');

db.exec(`
CREATE TABLE IF NOT EXISTS hazards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Pothole','Broken Streetlight','Exposed Wiring','Damaged Sidewalk','Garbage / Debris','Other')),
  severity TEXT NOT NULL CHECK (severity IN ('Low','Medium','High')) DEFAULT 'Low',
  description TEXT NOT NULL,
  photo TEXT,
  status TEXT NOT NULL CHECK (status IN ('Reported','In Review','Resolved')) DEFAULT 'Reported',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// Seed demo data on first run
if (db.prepare('SELECT COUNT(*) AS c FROM hazards').get().c === 0) {
  const ins = db.prepare(
    `INSERT INTO hazards (location, type, severity, description, status) VALUES (?, ?, ?, ?, ?)`
  );
  [
    ['MG Road, near Bus Stand', 'Pothole', 'High', 'Large pothole in the main lane, causing vehicles to swerve suddenly.', 'Reported'],
    ['Station Road Junction', 'Broken Streetlight', 'Medium', 'Streetlight has been off for over a week, junction is dark after 8pm.', 'In Review'],
    ['Sector 4 Park Boundary', 'Exposed Wiring', 'High', 'Loose electrical wiring hanging near the park entrance, children play nearby.', 'Reported'],
    ['Old Market Footpath', 'Damaged Sidewalk', 'Medium', 'Broken paving stones have been replaced by the municipal team.', 'Resolved'],
    ['Riverside Colony Lane 2', 'Garbage / Debris', 'Low', 'Construction debris left on the road narrows passage for two-wheelers.', 'In Review'],
    ['Highway Service Road', 'Pothole', 'Medium', 'Pothole cluster near the toll booth has been filled and resurfaced.', 'Resolved'],
  ].forEach(r => ins.run(...r));
}

module.exports = db;