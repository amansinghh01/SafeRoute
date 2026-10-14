
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Middleware ----------
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Serve static frontend files from public folder
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// ---------- Constants ----------
const TYPES = [
  'Pothole',
  'Broken Streetlight',
  'Exposed Wiring',
  'Damaged Sidewalk',
  'Garbage / Debris',
  'Other'
];

const SEVERITIES = ['Low', 'Medium', 'High'];
const STATUSES = ['Reported', 'In Review', 'Resolved'];

// ---------- HOME PAGE ----------
app.get('/', (req, res) => {
  const publicIndex = path.join(publicPath, 'index.html');
  const rootIndex = path.join(__dirname, 'index.html');

  if (fs.existsSync(publicIndex)) {
    return res.sendFile(publicIndex);
  }

  if (fs.existsSync(rootIndex)) {
    return res.sendFile(rootIndex);
  }

  res.status(404).send(
    'SafeRoute API is running, but index.html was not found. ' +
    'Place index.html in the project root or public folder.'
  );
});

// ---------- HEALTH CHECK ----------
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'SafeRoute API is running'
  });
});

// ---------- VALIDATION ----------
function validateReport(b) {
  const errors = [];

  if (
    typeof b.location !== 'string' ||
    !b.location.trim()
  ) {
    errors.push('location is required');
  }

  if (!TYPES.includes(b.type)) {
    errors.push('type must be one of: ' + TYPES.join(', '));
  }

  if (
    b.severity !== undefined &&
    !SEVERITIES.includes(b.severity)
  ) {
    errors.push('severity must be Low, Medium or High');
  }

  if (
    typeof b.description !== 'string' ||
    !b.description.trim()
  ) {
    errors.push('description is required');
  }

  return errors;
}

// ---------- READ: ALL HAZARDS ----------
app.get('/api/hazards', (req, res) => {
  const { status } = req.query;

  if (status && !STATUSES.includes(status)) {
    return res.status(400).json({
      error: 'Invalid status filter'
    });
  }

  const rows = status
    ? db.prepare(
        'SELECT * FROM hazards WHERE status = ? ORDER BY id DESC'
      ).all(status)
    : db.prepare(
        'SELECT * FROM hazards ORDER BY id DESC'
      ).all();

  res.json(rows);
});

// ---------- READ: PIPELINE STATS ----------
app.get('/api/stats', (req, res) => {
  const rows = db.prepare(
    'SELECT status, COUNT(*) AS count FROM hazards GROUP BY status'
  ).all();

  const stats = {
    Reported: 0,
    'In Review': 0,
    Resolved: 0
  };

  rows.forEach(row => {
    stats[row.status] = row.count;
  });

  res.json({
    ...stats,
    total: stats.Reported + stats['In Review'] + stats.Resolved
  });
});

// ---------- READ: ONE HAZARD ----------
app.get('/api/hazards/:id', (req, res) => {
  const row = db.prepare(
    'SELECT * FROM hazards WHERE id = ?'
  ).get(req.params.id);

  if (!row) {
    return res.status(404).json({
      error: 'Hazard not found'
    });
  }

  res.json(row);
});

// ---------- CREATE: NEW HAZARD ----------
app.post('/api/hazards', (req, res) => {
  const errors = validateReport(req.body);

  if (errors.length) {
    return res.status(400).json({ errors });
  }

  const {
    location,
    type,
    severity = 'Low',
    description,
    photo = null
  } = req.body;

  const info = db.prepare(`
    INSERT INTO hazards
      (location, type, severity, description, photo)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    location.trim(),
    type,
    severity,
    description.trim(),
    photo
  );

  const created = db.prepare(
    'SELECT * FROM hazards WHERE id = ?'
  ).get(info.lastInsertRowid);

  res.status(201).json(created);
});

// ---------- UPDATE: FULL HAZARD ----------
app.put('/api/hazards/:id', (req, res) => {
  const existing = db.prepare(
    'SELECT * FROM hazards WHERE id = ?'
  ).get(req.params.id);

  if (!existing) {
    return res.status(404).json({
      error: 'Hazard not found'
    });
  }

  const errors = validateReport(req.body);

  if (errors.length) {
    return res.status(400).json({ errors });
  }

  const {
    location,
    type,
    severity = existing.severity,
    description
  } = req.body;

  db.prepare(`
    UPDATE hazards
    SET location = ?,
        type = ?,
        severity = ?,
        description = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    location.trim(),
    type,
    severity,
    description.trim(),
    req.params.id
  );

  res.json(
    db.prepare('SELECT * FROM hazards WHERE id = ?')
      .get(req.params.id)
  );
});

// ---------- UPDATE: STATUS ONLY ----------
app.patch('/api/hazards/:id/status', (req, res) => {
  const { status } = req.body;

  if (!STATUSES.includes(status)) {
    return res.status(400).json({
      error: 'status must be one of: ' + STATUSES.join(', ')
    });
  }

  const info = db.prepare(`
    UPDATE hazards
    SET status = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(status, req.params.id);

  if (info.changes === 0) {
    return res.status(404).json({
      error: 'Hazard not found'
    });
  }

  res.json(
    db.prepare('SELECT * FROM hazards WHERE id = ?')
      .get(req.params.id)
  );
});

// ---------- DELETE: HAZARD ----------
app.delete('/api/hazards/:id', (req, res) => {
  const info = db.prepare(
    'DELETE FROM hazards WHERE id = ?'
  ).run(req.params.id);

  if (info.changes === 0) {
    return res.status(404).json({
      error: 'Hazard not found'
    });
  }

  res.json({
    message: 'Hazard deleted'
  });
});

// ---------- 404 HANDLER ----------
app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found'
  });
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log(
    `SafeRoute API running at http://localhost:${PORT}`
  );
});
