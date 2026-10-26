const express = require('express');
const router = express.Router();
const db = require('../database/db');

// List events with search and filters
router.get('/', (req, res) => {
  const { search, category, status } = req.query;

  let query = `
    SELECT e.*, v.name as venue_name, v.location as venue_location,
           (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status != 'Cancelled') as registered_count
    FROM events e
    LEFT JOIN venues v ON e.venue_id = v.id
    WHERE 1=1
  `;
  const params = [];

  if (search && search.trim()) {
    query += ` AND (e.title LIKE ? OR e.description LIKE ? OR e.organizer LIKE ?)`;
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }

  if (category && category !== 'All') {
    query += ` AND e.category = ?`;
    params.push(category);
  }

  if (status && status !== 'All') {
    query += ` AND e.status = ?`;
    params.push(status);
  }

  query += ` ORDER BY e.event_date ASC, e.event_time ASC`;

  const events = db.prepare(query).all(...params);

  // Distinct categories for filter dropdown
  const categories = db.prepare(`SELECT DISTINCT category FROM events WHERE category IS NOT NULL`).all().map(c => c.category);

  res.render('events/list', {
    pageTitle: 'Explore College Events',
    events,
    categories,
    selectedSearch: search || '',
    selectedCategory: category || 'All',
    selectedStatus: status || 'All'
  });
});

// Event detail page
router.get('/:id', (req, res) => {
  const eventId = req.params.id;
  const event = db.prepare(`
    SELECT e.*, v.name as venue_name, v.location as venue_location, v.capacity as venue_capacity,
           (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status != 'Cancelled') as registered_count
    FROM events e
    LEFT JOIN venues v ON e.venue_id = v.id
    WHERE e.id = ?
  `).get(eventId);

  if (!event) {
    req.session.flash = { type: 'warning', message: 'Event not found.' };
    return res.redirect('/events');
  }

  // Check if current logged in student is already registered
  let studentRegistration = null;
  if (req.session.student) {
    studentRegistration = db.prepare(`
      SELECT * FROM registrations WHERE event_id = ? AND student_id = ?
    `).get(eventId, req.session.student.id);
  }

  // Get feedbacks for this event
  const feedbacks = db.prepare(`
    SELECT f.*, s.name as student_name, s.department as student_department
    FROM feedback f
    JOIN students s ON f.student_id = s.id
    WHERE f.event_id = ?
    ORDER BY f.submitted_at DESC
  `).all(eventId);

  // Average rating
  const avgRating = db.prepare(`
    SELECT AVG(rating) as avg, COUNT(*) as count FROM feedback WHERE event_id = ?
  `).get(eventId);

  res.render('events/detail', {
    pageTitle: `${event.title} - College Events`,
    event,
    studentRegistration,
    feedbacks,
    avgRating: avgRating.avg ? Number(avgRating.avg).toFixed(1) : null,
    totalRatings: avgRating.count || 0
  });
});

module.exports = router;
