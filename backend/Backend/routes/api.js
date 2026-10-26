const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database/db');

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'College Event Management API'
  });
});

// List all events
router.get('/events', (req, res) => {
  try {
    const events = db.prepare(`
      SELECT e.*, v.name as venue_name, v.location as venue_location,
             (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status != 'Cancelled') as registrations
      FROM events e
      LEFT JOIN venues v ON e.venue_id = v.id
      ORDER BY e.event_date ASC, e.event_time ASC
    `).all();

    // Map fields for frontend compatibility
    const mapped = events.map(e => ({
      id: e.id,
      title: e.title,
      category: e.category,
      date: e.event_date,
      time: e.event_time,
      venue: e.venue_name || 'Main Campus',
      description: e.description,
      image: e.banner_image || 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1200&q=80',
      registrations: e.registrations || 0,
      tag: e.status || 'Upcoming'
    }));

    res.json(mapped);
  } catch (err) {
    console.error('API /events error:', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Get single event
router.get('/events/:id', (req, res) => {
  try {
    const event = db.prepare(`
      SELECT e.*, v.name as venue_name, v.location as venue_location, v.capacity as venue_capacity,
             (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status != 'Cancelled') as registrations
      FROM events e
      LEFT JOIN venues v ON e.venue_id = v.id
      WHERE e.id = ?
    `).get(req.params.id);

    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch event detail' });
  }
});

// Create event (Admin)
router.post('/events', (req, res) => {
  try {
    const { title, category, date, time, venue, description, image, max_participants } = req.body;
    if (!title || !date) {
      return res.status(400).json({ error: 'Title and date are required' });
    }

    // Find or create venue
    let venueId = null;
    if (venue) {
      const v = db.prepare('SELECT id FROM venues WHERE name = ?').get(venue);
      if (v) {
        venueId = v.id;
      } else {
        const ins = db.prepare('INSERT INTO venues (name, location, capacity) VALUES (?, ?, ?)')
          .run(venue, 'Main Campus', 300);
        venueId = ins.lastInsertRowid;
      }
    }

    const stmt = db.prepare(`
      INSERT INTO events (title, description, category, venue_id, organizer, event_date, event_time, max_participants, deadline, banner_image, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      title.trim(),
      description || 'Campus Event',
      category || 'Fest',
      venueId,
      'College Organizing Committee',
      date,
      time || '10:00 AM',
      max_participants || 200,
      date,
      image || 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1200&q=80',
      'Upcoming'
    );

    res.status(201).json({ id: result.lastInsertRowid, message: 'Event created successfully' });
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Delete event (Admin)
router.delete('/events/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
    res.json({ message: 'Event deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// Auth Login
router.post('/auth/login', (req, res) => {
  try {
    const { role, email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (role === 'admin') {
      const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(email.trim().toLowerCase());
      if (!admin || !bcrypt.compareSync(password, admin.password)) {
        return res.status(401).json({ error: 'Invalid admin credentials' });
      }
      return res.json({
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: 'admin'
      });
    } else {
      const student = db.prepare('SELECT * FROM students WHERE email = ?').get(email.trim().toLowerCase());
      if (!student || !bcrypt.compareSync(password, student.password)) {
        return res.status(401).json({ error: 'Invalid student email or password' });
      }
      return res.json({
        id: student.id,
        name: student.name,
        email: student.email,
        roll_no: student.roll_no,
        department: student.department,
        role: 'student'
      });
    }
  } catch (err) {
    res.status(500).json({ error: 'Login server error' });
  }
});

module.exports = router;
