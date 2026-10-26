const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const db = require('../database/db');
const { isStudent } = require('../middleware/auth');

// Protect all student routes
router.use(isStudent);

// Student Dashboard
router.get('/dashboard', (req, res) => {
  const studentId = req.session.student.id;

  const totalRegistered = db.prepare(`
    SELECT COUNT(*) as count FROM registrations WHERE student_id = ? AND status != 'Cancelled'
  `).get(studentId).count;

  const attendedCount = db.prepare(`
    SELECT COUNT(*) as count FROM registrations WHERE student_id = ? AND status = 'Attended'
  `).get(studentId).count;

  const unreadNotifs = db.prepare(`
    SELECT COUNT(*) as count FROM notifications WHERE student_id = ? AND is_read = 0
  `).get(studentId).count;

  const upcomingEvents = db.prepare(`
    SELECT e.*, v.name as venue_name, r.ticket_code, r.status as reg_status
    FROM registrations r
    JOIN events e ON r.event_id = e.id
    LEFT JOIN venues v ON e.venue_id = v.id
    WHERE r.student_id = ? AND r.status != 'Cancelled'
    ORDER BY e.event_date ASC
    LIMIT 4
  `).all(studentId);

  const availableEvents = db.prepare(`
    SELECT e.*, v.name as venue_name,
           (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status != 'Cancelled') as registered_count
    FROM events e
    LEFT JOIN venues v ON e.venue_id = v.id
    WHERE e.status = 'Upcoming'
      AND e.id NOT IN (SELECT event_id FROM registrations WHERE student_id = ? AND status != 'Cancelled')
    ORDER BY e.event_date ASC
    LIMIT 3
  `).all(studentId);

  res.render('student/dashboard', {
    pageTitle: 'Student Dashboard',
    totalRegistered,
    attendedCount,
    unreadNotifs,
    upcomingEvents,
    availableEvents
  });
});

// View My Registered Events
router.get('/my-events', (req, res) => {
  const studentId = req.session.student.id;

  const registrations = db.prepare(`
    SELECT r.*, e.title as event_title, e.event_date, e.event_time, e.category, e.organizer, e.status as event_status,
           v.name as venue_name, v.location as venue_location,
           f.rating as user_rating, f.comment as user_feedback
    FROM registrations r
    JOIN events e ON r.event_id = e.id
    LEFT JOIN venues v ON e.venue_id = v.id
    LEFT JOIN feedback f ON f.event_id = e.id AND f.student_id = ?
    WHERE r.student_id = ?
    ORDER BY r.registered_at DESC
  `).all(studentId, studentId);

  res.render('student/my-events', {
    pageTitle: 'My Registered Events',
    registrations
  });
});

// Register for an event
router.post('/events/:id/register', (req, res) => {
  const studentId = req.session.student.id;
  const eventId = req.params.id;

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
  if (!event) {
    req.session.flash = { type: 'danger', message: 'Event does not exist.' };
    return res.redirect('/events');
  }

  // Check deadline
  const today = new Date().toISOString().split('T')[0];
  if (event.deadline < today) {
    req.session.flash = { type: 'danger', message: 'Registration deadline has passed for this event.' };
    return res.redirect(`/events/${eventId}`);
  }

  // Check capacity
  const currentCount = db.prepare(`
    SELECT COUNT(*) as count FROM registrations WHERE event_id = ? AND status != 'Cancelled'
  `).get(eventId).count;

  if (currentCount >= event.max_participants) {
    req.session.flash = { type: 'danger', message: 'Event registration is full.' };
    return res.redirect(`/events/${eventId}`);
  }

  // Check existing registration
  const existing = db.prepare(`
    SELECT * FROM registrations WHERE event_id = ? AND student_id = ?
  `).get(eventId, studentId);

  if (existing) {
    if (existing.status === 'Cancelled') {
      // Re-activate registration
      db.prepare(`UPDATE registrations SET status = 'Approved', registered_at = CURRENT_TIMESTAMP WHERE id = ?`).run(existing.id);
      req.session.flash = { type: 'success', message: 'Your registration has been reinstated!' };
      return res.redirect('/student/my-events');
    }
    req.session.flash = { type: 'info', message: 'You are already registered for this event.' };
    return res.redirect('/student/my-events');
  }

  // Generate unique ticket code
  const randomSuffix = Math.floor(10000 + Math.random() * 90000);
  const ticketCode = `TKT-${event.category.substring(0, 2).toUpperCase()}${eventId}-${randomSuffix}`;

  try {
    db.prepare(`
      INSERT INTO registrations (event_id, student_id, ticket_code, status)
      VALUES (?, ?, ?, 'Approved')
    `).run(eventId, studentId, ticketCode);

    // Send confirmation notification
    db.prepare(`
      INSERT INTO notifications (student_id, title, message)
      VALUES (?, ?, ?)
    `).run(
      studentId,
      `Registration Confirmed: ${event.title}`,
      `You are officially registered! Your Ticket Code is ${ticketCode}. Show your QR code at the venue entrance.`
    );

    req.session.flash = { type: 'success', message: `Successfully registered! Ticket Code: ${ticketCode}` };
    res.redirect('/student/my-events');
  } catch (err) {
    console.error('Registration error:', err);
    req.session.flash = { type: 'danger', message: 'Could not complete registration. Please try again.' };
    res.redirect(`/events/${eventId}`);
  }
});

// Cancel registration
router.post('/events/:id/cancel', (req, res) => {
  const studentId = req.session.student.id;
  const eventId = req.params.id;

  const reg = db.prepare(`
    SELECT r.*, e.title as event_title
    FROM registrations r
    JOIN events e ON r.event_id = e.id
    WHERE r.event_id = ? AND r.student_id = ? AND r.status != 'Cancelled'
  `).get(eventId, studentId);

  if (!reg) {
    req.session.flash = { type: 'danger', message: 'Active registration not found.' };
    return res.redirect('/student/my-events');
  }

  if (reg.status === 'Attended') {
    req.session.flash = { type: 'danger', message: 'Cannot cancel an event you have already attended.' };
    return res.redirect('/student/my-events');
  }

  db.prepare(`UPDATE registrations SET status = 'Cancelled' WHERE id = ?`).run(reg.id);

  db.prepare(`
    INSERT INTO notifications (student_id, title, message)
    VALUES (?, ?, ?)
  `).run(
    studentId,
    `Registration Cancelled`,
    `Your registration for ${reg.event_title} has been cancelled.`
  );

  req.session.flash = { type: 'info', message: 'Registration cancelled successfully.' };
  res.redirect('/student/my-events');
});

// View Digital Ticket & QR Code (JSON / HTML modal)
router.get('/ticket/:id', async (req, res) => {
  const studentId = req.session.student.id;
  const regId = req.params.id;

  const registration = db.prepare(`
    SELECT r.*, e.title as event_title, e.event_date, e.event_time, e.category, e.organizer,
           v.name as venue_name, v.location as venue_location,
           s.name as student_name, s.roll_no, s.department
    FROM registrations r
    JOIN events e ON r.event_id = e.id
    JOIN students s ON r.student_id = s.id
    LEFT JOIN venues v ON e.venue_id = v.id
    WHERE r.id = ? AND r.student_id = ?
  `).get(regId, studentId);

  if (!registration) {
    req.session.flash = { type: 'danger', message: 'Ticket not found.' };
    return res.redirect('/student/my-events');
  }

  try {
    // Generate QR Code containing the ticket verification payload
    const qrPayload = JSON.stringify({
      ticketCode: registration.ticket_code,
      studentRoll: registration.roll_no,
      eventId: registration.event_id
    });
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 260,
      margin: 2,
      color: {
        dark: '#1e293b',
        light: '#ffffff'
      }
    });

    res.render('student/ticket', {
      pageTitle: `Digital Ticket - ${registration.ticket_code}`,
      ticket: registration,
      qrDataUrl
    });
  } catch (err) {
    console.error('QR code generation error:', err);
    req.session.flash = { type: 'danger', message: 'Error generating ticket QR code.' };
    res.redirect('/student/my-events');
  }
});

// Download PDF Certificate
router.get('/certificate/:id', (req, res) => {
  const studentId = req.session.student.id;
  const regId = req.params.id;

  const registration = db.prepare(`
    SELECT r.*, e.title as event_title, e.event_date, e.category, e.organizer,
           s.name as student_name, s.roll_no, s.department
    FROM registrations r
    JOIN events e ON r.event_id = e.id
    JOIN students s ON r.student_id = s.id
    WHERE r.id = ? AND r.student_id = ? AND (r.status = 'Attended' OR r.status = 'Approved')
  `).get(regId, studentId);

  if (!registration) {
    req.session.flash = { type: 'warning', message: 'Certificate is only available for confirmed or attended participants.' };
    return res.redirect('/student/my-events');
  }

  // Get or create certificate record
  let cert = db.prepare('SELECT * FROM certificates WHERE registration_id = ?').get(regId);
  if (!cert) {
    const certNumber = `CERT-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const info = db.prepare(`
      INSERT INTO certificates (registration_id, certificate_number)
      VALUES (?, ?)
    `).run(regId, certNumber);
    cert = { id: info.lastInsertRowid, certificate_number: certNumber, issued_at: new Date().toISOString() };
  }

  // Create PDF Document (Landscape Certificate)
  const doc = new PDFDocument({
    layout: 'landscape',
    size: 'A4',
    margin: 40
  });

  const filename = `Certificate_${registration.ticket_code}.pdf`;
  res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-type', 'application/pdf');

  doc.pipe(res);

  // Draw decorative certificate borders
  const width = doc.page.width;
  const height = doc.page.height;

  // Outer Border
  doc.rect(20, 20, width - 40, height - 40).lineWidth(4).strokeColor('#1e3a8a').stroke();
  // Inner Border
  doc.rect(26, 26, width - 52, height - 52).lineWidth(1.5).strokeColor('#d97706').stroke();

  // Header
  doc.moveDown(1.5);
  doc.font('Helvetica-Bold').fontSize(28).fillColor('#1e3a8a').text('COLLEGE EVENT MANAGEMENT SYSTEM', { align: 'center' });
  doc.font('Helvetica').fontSize(13).fillColor('#4b5563').text('Office of Student Affairs & Extracurricular Activities', { align: 'center' });

  doc.moveDown(1.2);
  doc.font('Helvetica-Bold').fontSize(22).fillColor('#b45309').text('CERTIFICATE OF PARTICIPATION', { align: 'center', characterSpacing: 1.5 });

  doc.moveDown(1.2);
  doc.font('Helvetica').fontSize(13).fillColor('#374151').text('This is proudly presented to', { align: 'center' });

  doc.moveDown(0.8);
  doc.font('Helvetica-Bold').fontSize(26).fillColor('#0f172a').text(registration.student_name, { align: 'center' });
  doc.font('Helvetica-Oblique').fontSize(12).fillColor('#4b5563')
     .text(`Roll No: ${registration.roll_no}  |  Department: ${registration.department}`, { align: 'center' });

  doc.moveDown(1);
  doc.font('Helvetica').fontSize(13).fillColor('#374151')
     .text(`for active participation in the event`, { align: 'center' });

  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(20).fillColor('#1e3a8a').text(registration.event_title, { align: 'center' });

  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(11).fillColor('#6b7280')
     .text(`Organized by ${registration.organizer} on ${registration.event_date}`, { align: 'center' });

  // Certificate Footer & Signatures
  const bottomY = height - 120;
  doc.fontSize(10).fillColor('#4b5563');

  // Left Signature
  doc.text('_____________________________', 80, bottomY);
  doc.font('Helvetica-Bold').text('Event Coordinator', 105, bottomY + 16);
  doc.font('Helvetica').text('College Event Committee', 85, bottomY + 30);

  // Center Seal / ID
  doc.font('Helvetica-Bold').fillColor('#b45309').text(`ID: ${cert.certificate_number}`, width / 2 - 80, bottomY + 10, { width: 160, align: 'center' });
  doc.font('Helvetica').fillColor('#6b7280').text(`Issued on: ${new Date().toLocaleDateString()}`, width / 2 - 80, bottomY + 26, { width: 160, align: 'center' });

  // Right Signature
  doc.font('Helvetica').fillColor('#4b5563').text('_____________________________', width - 260, bottomY);
  doc.font('Helvetica-Bold').text('Dean of Student Affairs', width - 245, bottomY + 16);
  doc.font('Helvetica').text('College Administration', width - 235, bottomY + 30);

  doc.end();
});

// Notifications
router.get('/notifications', (req, res) => {
  const studentId = req.session.student.id;

  const notifications = db.prepare(`
    SELECT * FROM notifications WHERE student_id = ? ORDER BY created_at DESC
  `).all(studentId);

  // Mark all as read
  db.prepare(`UPDATE notifications SET is_read = 1 WHERE student_id = ?`).run(studentId);

  res.render('student/notifications', {
    pageTitle: 'My Notifications',
    notifications
  });
});

// Submit Feedback
router.post('/feedback', (req, res) => {
  const studentId = req.session.student.id;
  const { event_id, rating, comment } = req.body;

  if (!event_id || !rating) {
    req.session.flash = { type: 'danger', message: 'Rating is required.' };
    return res.redirect('/student/my-events');
  }

  // Verify attendance or approved registration
  const reg = db.prepare(`
    SELECT * FROM registrations WHERE event_id = ? AND student_id = ?
  `).get(event_id, studentId);

  if (!reg) {
    req.session.flash = { type: 'danger', message: 'You must be registered for this event to leave feedback.' };
    return res.redirect('/student/my-events');
  }

  try {
    const existing = db.prepare('SELECT id FROM feedback WHERE event_id = ? AND student_id = ?').get(event_id, studentId);
    if (existing) {
      db.prepare(`
        UPDATE feedback SET rating = ?, comment = ?, submitted_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(parseInt(rating), comment ? comment.trim() : null, existing.id);
      req.session.flash = { type: 'success', message: 'Your feedback has been updated!' };
    } else {
      db.prepare(`
        INSERT INTO feedback (event_id, student_id, rating, comment)
        VALUES (?, ?, ?, ?)
      `).run(event_id, studentId, parseInt(rating), comment ? comment.trim() : null);
      req.session.flash = { type: 'success', message: 'Thank you for submitting your feedback!' };
    }
  } catch (err) {
    console.error('Feedback error:', err);
    req.session.flash = { type: 'danger', message: 'Failed to submit feedback.' };
  }

  res.redirect('/student/my-events');
});

module.exports = router;
