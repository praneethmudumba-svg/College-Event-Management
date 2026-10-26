const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database/db');

// Render login page
router.get('/login', (req, res) => {
  if (req.session.student) return res.redirect('/student/dashboard');
  if (req.session.admin) return res.redirect('/admin/dashboard');

  const initialRole = req.query.role === 'admin' ? 'admin' : 'student';
  res.render('auth/login', {
    pageTitle: 'Sign In - College Event Portal',
    role: initialRole
  });
});

// Process login
router.post('/login', (req, res) => {
  const { role, email, password } = req.body;

  if (!email || !password) {
    req.session.flash = { type: 'danger', message: 'Email and password are required.' };
    return res.redirect(`/auth/login?role=${role || 'student'}`);
  }

  if (role === 'admin') {
    const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(email.trim().toLowerCase());
    if (!admin || !bcrypt.compareSync(password, admin.password)) {
      req.session.flash = { type: 'danger', message: 'Invalid admin credentials.' };
      return res.redirect('/auth/login?role=admin');
    }

    req.session.admin = {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role
    };
    req.session.flash = { type: 'success', message: `Welcome back, ${admin.name}!` };
    return res.redirect('/admin/dashboard');
  } else {
    const student = db.prepare('SELECT * FROM students WHERE email = ?').get(email.trim().toLowerCase());
    if (!student || !bcrypt.compareSync(password, student.password)) {
      req.session.flash = { type: 'danger', message: 'Invalid student email or password.' };
      return res.redirect('/auth/login?role=student');
    }

    req.session.student = {
      id: student.id,
      name: student.name,
      email: student.email,
      roll_no: student.roll_no,
      department: student.department
    };
    req.session.flash = { type: 'success', message: `Welcome back, ${student.name}!` };
    return res.redirect('/student/dashboard');
  }
});

// Render student registration
router.get('/register', (req, res) => {
  if (req.session.student) return res.redirect('/student/dashboard');
  res.render('auth/register', {
    pageTitle: 'Student Registration - College Event Portal'
  });
});

// Process student registration
router.post('/register', (req, res) => {
  const { name, email, roll_no, department, phone, password, confirm_password } = req.body;

  if (!name || !email || !roll_no || !department || !password) {
    req.session.flash = { type: 'danger', message: 'Please fill all mandatory fields.' };
    return res.redirect('/auth/register');
  }

  if (password !== confirm_password) {
    req.session.flash = { type: 'danger', message: 'Passwords do not match.' };
    return res.redirect('/auth/register');
  }

  // Check unique constraints
  const existingEmail = db.prepare('SELECT id FROM students WHERE email = ?').get(email.trim().toLowerCase());
  if (existingEmail) {
    req.session.flash = { type: 'danger', message: 'A student with this email address already exists.' };
    return res.redirect('/auth/register');
  }

  const existingRoll = db.prepare('SELECT id FROM students WHERE roll_no = ?').get(roll_no.trim().toUpperCase());
  if (existingRoll) {
    req.session.flash = { type: 'danger', message: 'A student with this Roll/Registration Number already exists.' };
    return res.redirect('/auth/register');
  }

  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    const stmt = db.prepare(`
      INSERT INTO students (name, email, password, roll_no, department, phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      name.trim(),
      email.trim().toLowerCase(),
      hashedPassword,
      roll_no.trim().toUpperCase(),
      department.trim(),
      phone ? phone.trim() : null
    );

    // Create welcome notification
    db.prepare(`
      INSERT INTO notifications (student_id, title, message)
      VALUES (?, ?, ?)
    `).run(
      info.lastInsertRowid,
      'Welcome to CampusEvents!',
      'Your student account has been created successfully. Browse events and register today!'
    );

    // Auto login
    req.session.student = {
      id: info.lastInsertRowid,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      roll_no: roll_no.trim().toUpperCase(),
      department: department.trim()
    };

    req.session.flash = { type: 'success', message: 'Registration successful! Welcome to the portal.' };
    res.redirect('/student/dashboard');
  } catch (err) {
    console.error('Registration error:', err);
    req.session.flash = { type: 'danger', message: 'Registration failed. Please try again.' };
    res.redirect('/auth/register');
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;
