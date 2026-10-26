const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { isAdmin } = require('../middleware/auth');

// Protect all admin routes
router.use(isAdmin);

// Admin Dashboard
router.get('/dashboard', (req, res) => {
  const totalEvents = db.prepare('SELECT COUNT(*) as count FROM events').get().count;
  const upcomingEvents = db.prepare("SELECT COUNT(*) as count FROM events WHERE status = 'Upcoming'").get().count;
  const totalStudents = db.prepare('SELECT COUNT(*) as count FROM students').get().count;
  const totalRegistrations = db.prepare("SELECT COUNT(*) as count FROM registrations WHERE status != 'Cancelled'").get().count;
  const totalAttended = db.prepare("SELECT COUNT(*) as count FROM registrations WHERE status = 'Attended'").get().count;

  const recentRegistrations = db.prepare(`
    SELECT r.*, e.title as event_title, s.name as student_name, s.roll_no, s.department
    FROM registrations r
    JOIN events e ON r.event_id = e.id
    JOIN students s ON r.student_id = s.id
    ORDER BY r.registered_at DESC
    LIMIT 8
  `).all();

  const recentEvents = db.prepare(`
    SELECT e.*, v.name as venue_name,
           (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status != 'Cancelled') as reg_count
    FROM events e
    LEFT JOIN venues v ON e.venue_id = v.id
    ORDER BY e.created_at DESC
    LIMIT 5
  `).all();

  res.render('admin/dashboard', {
    pageTitle: 'Admin Dashboard',
    stats: {
      totalEvents,
      upcomingEvents,
      totalStudents,
      totalRegistrations,
      totalAttended
    },
    recentRegistrations,
    recentEvents
  });
});

// Manage Events
router.get('/events', (req, res) => {
  const events = db.prepare(`
    SELECT e.*, v.name as venue_name,
           (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status != 'Cancelled') as reg_count,
           (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'Attended') as attended_count
    FROM events e
    LEFT JOIN venues v ON e.venue_id = v.id
    ORDER BY e.event_date DESC
  `).all();

  res.render('admin/events', {
    pageTitle: 'Manage Events',
    events
  });
});

// Add Event - Form
router.get('/events/new', (req, res) => {
  const venues = db.prepare('SELECT * FROM venues ORDER BY name ASC').all();
  res.render('admin/event-form', {
    pageTitle: 'Create New Event',
    event: null,
    venues
  });
});

// Add Event - Action
router.post('/events/new', (req, res) => {
  const { title, description, category, venue_id, organizer, event_date, event_time, max_participants, deadline, banner_image, status } = req.body;

  if (!title || !category || !event_date || !max_participants || !deadline) {
    req.session.flash = { type: 'danger', message: 'Please fill all required fields.' };
    return res.redirect('/admin/events/new');
  }

  try {
    const defaultImage = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80';
    db.prepare(`
      INSERT INTO events (title, description, category, venue_id, organizer, event_date, event_time, max_participants, deadline, banner_image, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title.trim(),
      description ? description.trim() : '',
      category.trim(),
      venue_id ? parseInt(venue_id) : null,
      organizer ? organizer.trim() : 'College Administration',
      event_date,
      event_time || '10:00 AM',
      parseInt(max_participants),
      deadline,
      banner_image && banner_image.trim() ? banner_image.trim() : defaultImage,
      status || 'Upcoming'
    );

    req.session.flash = { type: 'success', message: 'Event created successfully!' };
    res.redirect('/admin/events');
  } catch (err) {
    console.error('Error creating event:', err);
    req.session.flash = { type: 'danger', message: 'Failed to create event.' };
    res.redirect('/admin/events/new');
  }
});

// Edit Event - Form
router.get('/events/:id/edit', (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) {
    req.session.flash = { type: 'danger', message: 'Event not found.' };
    return res.redirect('/admin/events');
  }

  const venues = db.prepare('SELECT * FROM venues ORDER BY name ASC').all();
  res.render('admin/event-form', {
    pageTitle: `Edit Event - ${event.title}`,
    event,
    venues
  });
});

// Edit Event - Action
router.post('/events/:id/edit', (req, res) => {
  const eventId = req.params.id;
  const { title, description, category, venue_id, organizer, event_date, event_time, max_participants, deadline, banner_image, status } = req.body;

  try {
    db.prepare(`
      UPDATE events
      SET title = ?, description = ?, category = ?, venue_id = ?, organizer = ?,
          event_date = ?, event_time = ?, max_participants = ?, deadline = ?,
          banner_image = ?, status = ?
      WHERE id = ?
    `).run(
      title.trim(),
      description ? description.trim() : '',
      category.trim(),
      venue_id ? parseInt(venue_id) : null,
      organizer ? organizer.trim() : 'College Administration',
      event_date,
      event_time,
      parseInt(max_participants),
      deadline,
      banner_image && banner_image.trim() ? banner_image.trim() : null,
      status,
      eventId
    );

    req.session.flash = { type: 'success', message: 'Event details updated successfully.' };
    res.redirect('/admin/events');
  } catch (err) {
    console.error('Error updating event:', err);
    req.session.flash = { type: 'danger', message: 'Failed to update event.' };
    res.redirect(`/admin/events/${eventId}/edit`);
  }
});

// Delete Event
router.post('/events/:id/delete', (req, res) => {
  try {
    db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
    req.session.flash = { type: 'success', message: 'Event deleted successfully.' };
  } catch (err) {
    console.error('Delete event error:', err);
    req.session.flash = { type: 'danger', message: 'Failed to delete event.' };
  }
  res.redirect('/admin/events');
});

// View Participants for a Specific Event
router.get('/events/:id/participants', (req, res) => {
  const eventId = req.params.id;
  const event = db.prepare(`
    SELECT e.*, v.name as venue_name
    FROM events e
    LEFT JOIN venues v ON e.venue_id = v.id
    WHERE e.id = ?
  `).get(eventId);

  if (!event) {
    req.session.flash = { type: 'danger', message: 'Event not found.' };
    return res.redirect('/admin/events');
  }

  const participants = db.prepare(`
    SELECT r.*, s.name as student_name, s.email as student_email, s.roll_no, s.department, s.phone
    FROM registrations r
    JOIN students s ON r.student_id = s.id
    WHERE r.event_id = ?
    ORDER BY r.registered_at DESC
  `).all(eventId);

  res.render('admin/participants', {
    pageTitle: `Participants - ${event.title}`,
    event,
    participants
  });
});

// Update Registration Status (Approve / Reject / Mark Attended)
router.post('/registrations/:id/status', (req, res) => {
  const regId = req.params.id;
  const { status, redirect_to } = req.body;

  const validStatuses = ['Approved', 'Pending', 'Rejected', 'Attended', 'Cancelled'];
  if (!validStatuses.includes(status)) {
    req.session.flash = { type: 'danger', message: 'Invalid status update.' };
    return res.redirect(redirect_to || '/admin/dashboard');
  }

  try {
    const attendedAt = status === 'Attended' ? new Date().toISOString() : null;
    db.prepare(`
      UPDATE registrations
      SET status = ?, attended_at = COALESCE(?, attended_at)
      WHERE id = ?
    `).run(status, attendedAt, regId);

    // Notify student
    const reg = db.prepare(`
      SELECT r.*, e.title as event_title FROM registrations r
      JOIN events e ON r.event_id = e.id
      WHERE r.id = ?
    `).get(regId);

    if (reg) {
      let notifMsg = `Your registration for ${reg.event_title} has been marked as ${status}.`;
      if (status === 'Attended') {
        notifMsg = `Attendance verified for ${reg.event_title}! Your certificate is now ready for download.`;
      }
      db.prepare(`
        INSERT INTO notifications (student_id, title, message)
        VALUES (?, ?, ?)
      `).run(reg.student_id, `Status Update: ${reg.event_title}`, notifMsg);
    }

    req.session.flash = { type: 'success', message: `Registration status updated to ${status}.` };
  } catch (err) {
    console.error('Update status error:', err);
    req.session.flash = { type: 'danger', message: 'Failed to update registration status.' };
  }

  res.redirect(redirect_to || '/admin/dashboard');
});

// QR Code Scanner / Attendance Verification Page
router.get('/qr-scanner', (req, res) => {
  const events = db.prepare("SELECT id, title, event_date FROM events WHERE status != 'Cancelled' ORDER BY event_date ASC").all();
  res.render('admin/qr-scanner', {
    pageTitle: 'QR Code Attendance Check-in',
    events
  });
});

// Verify Ticket by Code (AJAX or Form Post)
router.post('/verify-ticket', (req, res) => {
  const { ticket_code } = req.body;

  if (!ticket_code || !ticket_code.trim()) {
    return res.json({ success: false, message: 'Please enter or scan a valid ticket code.' });
  }

  // Handle scanned raw JSON or ticket code string
  let searchCode = ticket_code.trim();
  try {
    if (searchCode.startsWith('{') && searchCode.endsWith('}')) {
      const parsed = JSON.parse(searchCode);
      if (parsed.ticketCode) searchCode = parsed.ticketCode;
    }
  } catch (e) {
    // Treat as raw string
  }

  const reg = db.prepare(`
    SELECT r.*, e.title as event_title, e.event_date, e.event_time,
           s.name as student_name, s.roll_no, s.department, s.email as student_email
    FROM registrations r
    JOIN events e ON r.event_id = e.id
    JOIN students s ON r.student_id = s.id
    WHERE r.ticket_code = ?
  `).get(searchCode);

  if (!reg) {
    return res.json({
      success: false,
      message: `Invalid Ticket Code: "${searchCode}". No matching registration found.`
    });
  }

  if (reg.status === 'Cancelled' || reg.status === 'Rejected') {
    return res.json({
      success: false,
      message: `Registration is ${reg.status}. Access Denied.`,
      ticket: reg
    });
  }

  if (reg.status === 'Attended') {
    return res.json({
      success: true,
      alreadyAttended: true,
      message: `Student ALREADY CHECKED IN at ${reg.attended_at || 'Earlier'}.`,
      ticket: reg
    });
  }

  // Mark attendance
  const now = new Date().toISOString();
  db.prepare(`UPDATE registrations SET status = 'Attended', attended_at = ? WHERE id = ?`).run(now, reg.id);

  // Send notification
  db.prepare(`
    INSERT INTO notifications (student_id, title, message)
    VALUES (?, ?, ?)
  `).run(
    reg.student_id,
    'Attendance Verified',
    `You have been marked present for ${reg.event_title}. You can now download your Certificate of Participation.`
  );

  return res.json({
    success: true,
    alreadyAttended: false,
    message: `Attendance Successfully Verified! Welcome, ${reg.student_name}.`,
    ticket: {
      ...reg,
      status: 'Attended',
      attended_at: now
    }
  });
});

// Manage Students
router.get('/students', (req, res) => {
  const students = db.prepare(`
    SELECT s.*,
           (SELECT COUNT(*) FROM registrations r WHERE r.student_id = s.id AND r.status != 'Cancelled') as reg_count,
           (SELECT COUNT(*) FROM registrations r WHERE r.student_id = s.id AND r.status = 'Attended') as attended_count
    FROM students s
    ORDER BY s.created_at DESC
  `).all();

  res.render('admin/students', {
    pageTitle: 'Manage Registered Students',
    students
  });
});

// Manage Venues
router.get('/venues', (req, res) => {
  const venues = db.prepare(`
    SELECT v.*,
           (SELECT COUNT(*) FROM events e WHERE e.venue_id = v.id) as event_count
    FROM venues v
    ORDER BY v.name ASC
  `).all();

  res.render('admin/venues', {
    pageTitle: 'College Venues',
    venues
  });
});

// Add Venue
router.post('/venues', (req, res) => {
  const { name, location, capacity } = req.body;

  if (!name || !capacity) {
    req.session.flash = { type: 'danger', message: 'Venue name and capacity are required.' };
    return res.redirect('/admin/venues');
  }

  try {
    db.prepare(`INSERT INTO venues (name, location, capacity) VALUES (?, ?, ?)`).run(
      name.trim(),
      location ? location.trim() : 'Campus',
      parseInt(capacity)
    );
    req.session.flash = { type: 'success', message: 'Venue added successfully.' };
  } catch (err) {
    console.error('Error adding venue:', err);
    req.session.flash = { type: 'danger', message: 'Failed to add venue.' };
  }

  res.redirect('/admin/venues');
});

// Reports and Analytics
router.get('/reports', (req, res) => {
  const totalEvents = db.prepare('SELECT COUNT(*) as count FROM events').get().count;
  const totalRegistrations = db.prepare("SELECT COUNT(*) as count FROM registrations WHERE status != 'Cancelled'").get().count;
  const totalAttended = db.prepare("SELECT COUNT(*) as count FROM registrations WHERE status = 'Attended'").get().count;

  // Breakdown by category
  const categoryStats = db.prepare(`
    SELECT category, COUNT(*) as event_count,
           SUM((SELECT COUNT(*) FROM registrations r WHERE r.event_id = events.id AND r.status != 'Cancelled')) as total_regs
    FROM events
    GROUP BY category
  `).all();

  // Top events by participation
  const topEvents = db.prepare(`
    SELECT e.title, e.category, e.event_date, e.max_participants,
           COUNT(r.id) as total_regs,
           SUM(CASE WHEN r.status = 'Attended' THEN 1 ELSE 0 END) as attended_count
    FROM events e
    LEFT JOIN registrations r ON e.id = r.event_id AND r.status != 'Cancelled'
    GROUP BY e.id
    ORDER BY total_regs DESC
    LIMIT 6
  `).all();

  res.render('admin/reports', {
    pageTitle: 'Event Reports & Analytics',
    stats: {
      totalEvents,
      totalRegistrations,
      totalAttended,
      attendanceRate: totalRegistrations > 0 ? Math.round((totalAttended / totalRegistrations) * 100) : 0
    },
    categoryStats,
    topEvents
  });
});

// Export CSV of Event Registrations
router.get('/events/:id/export-csv', (req, res) => {
  const eventId = req.params.id;
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);

  if (!event) {
    req.session.flash = { type: 'danger', message: 'Event not found.' };
    return res.redirect('/admin/events');
  }

  const participants = db.prepare(`
    SELECT r.ticket_code, r.status, r.registered_at, r.attended_at,
           s.name, s.roll_no, s.email, s.department, s.phone
    FROM registrations r
    JOIN students s ON r.student_id = s.id
    WHERE r.event_id = ?
    ORDER BY r.registered_at ASC
  `).all(eventId);

  let csvContent = 'Ticket Code,Student Name,Roll No,Department,Email,Phone,Status,Registered At,Attended At\n';
  participants.forEach(p => {
    const row = [
      `"${p.ticket_code}"`,
      `"${p.name}"`,
      `"${p.roll_no}"`,
      `"${p.department}"`,
      `"${p.email}"`,
      `"${p.phone || ''}"`,
      `"${p.status}"`,
      `"${p.registered_at}"`,
      `"${p.attended_at || 'N/A'}"`
    ].join(',');
    csvContent += row + '\n';
  });

  const safeTitle = event.title.replace(/[^a-zA-Z0-9]/g, '_');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}_participants.csv"`);
  res.send(csvContent);
});

module.exports = router;
