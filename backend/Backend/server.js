const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./database/db');
const { setLocals } = require('./middleware/auth');

const cors = require('cors');

const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const studentRoutes = require('./routes/student');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for frontend clients
app.use(cors({ origin: true, credentials: true }));

// Middleware for parsing body
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static Files
app.use(express.static(path.join(__dirname, 'public')));

// View Engine (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session Configuration
app.use(
  session({
    secret: 'college-events-super-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24 hours
  })
);

// Global locals for templates (currentStudent, currentAdmin, flash messages)
app.use(setLocals);

// Mount Modular Routes
app.use('/api', apiRoutes);
app.use('/auth', authRoutes);
app.use('/events', eventRoutes);
app.use('/student', studentRoutes);
app.use('/admin', adminRoutes);

// Landing Home Page
app.get('/', (req, res) => {
  const featuredEvents = db.prepare(`
    SELECT e.*, v.name as venue_name,
           (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status != 'Cancelled') as registered_count
    FROM events e
    LEFT JOIN venues v ON e.venue_id = v.id
    WHERE e.status = 'Upcoming'
    ORDER BY e.event_date ASC
    LIMIT 3
  `).all();

  const totalEvents = db.prepare('SELECT COUNT(*) as count FROM events').get().count;
  const totalStudents = db.prepare('SELECT COUNT(*) as count FROM students').get().count;
  const totalRegistrations = db.prepare("SELECT COUNT(*) as count FROM registrations WHERE status != 'Cancelled'").get().count;

  res.render('index', {
    pageTitle: 'Home - College Event Management System',
    featuredEvents,
    stats: {
      totalEvents,
      totalStudents,
      totalRegistrations
    }
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).render('partials/404', {
    pageTitle: 'Page Not Found'
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).send('Internal Server Error');
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🎓 College Event Management System is running!`);
  console.log(`🌐 Local URL: http://localhost:${PORT}`);
  console.log(`🔑 Admin Login: admin@college.edu | admin123`);
  console.log(`🎓 Student Login: student@college.edu | student123`);
  console.log(`====================================================`);
});
