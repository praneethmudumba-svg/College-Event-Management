const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'college_events.sqlite');
const rawDb = new DatabaseSync(dbPath);

// Enable Foreign Keys and WAL Mode for performance
rawDb.exec('PRAGMA journal_mode = WAL;');
rawDb.exec('PRAGMA foreign_keys = ON;');

// Create a wrapper that matches better-sqlite3 API
class DatabaseWrapper {
  constructor(db) {
    this._db = db;
  }

  pragma(str) {
    return this._db.exec(`PRAGMA ${str};`);
  }

  exec(sql) {
    return this._db.exec(sql);
  }

  prepare(sql) {
    const stmt = this._db.prepare(sql);
    return {
      run: (...args) => {
        const flat = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
        return stmt.run(...flat);
      },
      get: (...args) => {
        const flat = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
        return stmt.get(...flat);
      },
      all: (...args) => {
        const flat = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
        return stmt.all(...flat);
      }
    };
  }
}

const db = new DatabaseWrapper(rawDb);

// Initialize database tables
function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'Administrator',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      roll_no TEXT NOT NULL UNIQUE,
      department TEXT NOT NULL,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS venues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      capacity INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      venue_id INTEGER,
      organizer TEXT NOT NULL,
      event_date TEXT NOT NULL,
      event_time TEXT NOT NULL,
      max_participants INTEGER NOT NULL,
      deadline TEXT NOT NULL,
      banner_image TEXT,
      status TEXT DEFAULT 'Upcoming',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      ticket_code TEXT NOT NULL UNIQUE,
      status TEXT DEFAULT 'Approved',
      registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      attended_at DATETIME,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      UNIQUE(event_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS certificates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      registration_id INTEGER NOT NULL UNIQUE,
      certificate_number TEXT NOT NULL UNIQUE,
      issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE
    );
  `);

  // Seed sample data if empty
  const adminCount = db.prepare('SELECT COUNT(*) as count FROM admins').get().count;
  if (adminCount === 0) {
    const adminHash = bcrypt.hashSync('admin123', 10);
    const studentHash = bcrypt.hashSync('student123', 10);

    // 1. Admins
    db.prepare('INSERT INTO admins (name, email, password, role) VALUES (?, ?, ?, ?)').run(
      'Faculty Event Coordinator',
      'admin@college.edu',
      adminHash,
      'Super Admin'
    );

    // 2. Students
    const studentStmt = db.prepare('INSERT INTO students (name, email, password, roll_no, department, phone) VALUES (?, ?, ?, ?, ?, ?)');
    const s1 = studentStmt.run('Varshitha Reddy', 'student@college.edu', studentHash, '22CS101', 'Computer Science & Engineering', '+91 9876543210');
    const s2 = studentStmt.run('Rahul Sharma', 'rahul@college.edu', studentHash, '22EC204', 'Electronics & Communication', '+91 9876543211');

    // 3. Venues
    const venueStmt = db.prepare('INSERT INTO venues (name, location, capacity) VALUES (?, ?, ?)');
    const v1 = venueStmt.run('APJ Abdul Kalam Auditorium', 'Main Campus Block A, Ground Floor', 600);
    const v2 = venueStmt.run('Sir MV Seminar Hall', 'CS Engineering Block, 2nd Floor', 180);
    const v3 = venueStmt.run('Central Open Amphitheatre', 'Near Student Recreation Center', 800);
    const v4 = venueStmt.run('Indoor Sports Complex', 'Sports Ground North Wing', 400);

    // 4. Events
    const eventStmt = db.prepare(`
      INSERT INTO events (title, description, category, venue_id, organizer, event_date, event_time, max_participants, deadline, banner_image, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const e1 = eventStmt.run(
      'HackSphere 2026: Annual Inter-College Hackathon',
      'A thrilling 36-hour hackathon bringing together the brightest minds to solve real-world problems using AI, Web3, and Cloud computing. Exciting cash prizes worth ₹1,50,000!',
      'Technical',
      v2.lastInsertRowid,
      'Department of Computer Science & Coding Club',
      '2026-10-24',
      '09:00 AM',
      120,
      '2026-10-22',
      'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80',
      'Upcoming'
    );

    const e2 = eventStmt.run(
      'Tarang 2026: Grand Annual Cultural Festival',
      'The biggest cultural celebration of the year featuring battle of the bands, classical & western dance showdowns, stage plays, and fashion parade followed by celebrity DJ night.',
      'Cultural',
      v3.lastInsertRowid,
      'Student Cultural Committee',
      '2026-11-05',
      '04:30 PM',
      500,
      '2026-11-03',
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
      'Upcoming'
    );

    const e3 = eventStmt.run(
      'Generative AI & Agentic Systems Workshop',
      'Hands-on interactive masterclass covering LLMs, autonomous coding agents, and LangChain orchestration conducted by industry tech leads from top AI research labs.',
      'Workshop',
      v2.lastInsertRowid,
      'AI & Data Science Association',
      '2026-10-18',
      '10:30 AM',
      100,
      '2026-10-16',
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
      'Upcoming'
    );

    const e4 = eventStmt.run(
      'Inter-Department Badminton Championship',
      'Annual men & women singles and doubles tournament. Trophies, medals, and university athletic credit points for all category winners.',
      'Sports',
      v4.lastInsertRowid,
      'Physical Education Department',
      '2026-10-28',
      '08:00 AM',
      64,
      '2026-10-25',
      'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1200&q=80',
      'Upcoming'
    );

    // 5. Sample Registrations & Tickets
    const regStmt = db.prepare('INSERT INTO registrations (event_id, student_id, ticket_code, status, registered_at) VALUES (?, ?, ?, ?, ?)');
    const r1 = regStmt.run(e1.lastInsertRowid, s1.lastInsertRowid, 'TKT-HS26-90412', 'Approved', '2026-10-07 14:20:00');
    regStmt.run(e3.lastInsertRowid, s1.lastInsertRowid, 'TKT-AI26-38194', 'Approved', '2026-10-08 11:15:00');
    regStmt.run(e1.lastInsertRowid, s2.lastInsertRowid, 'TKT-HS26-74921', 'Pending', '2026-10-08 12:00:00');

    // 6. Notifications
    const notifStmt = db.prepare('INSERT INTO notifications (student_id, title, message) VALUES (?, ?, ?)');
    notifStmt.run(
      s1.lastInsertRowid,
      'Registration Confirmed!',
      'Your registration for HackSphere 2026 has been approved. Your digital ticket (TKT-HS26-90412) is now ready in your portal.'
    );
    notifStmt.run(
      s1.lastInsertRowid,
      'Upcoming Workshop Reminder',
      'Generative AI Workshop is scheduled for 18th Oct at 10:30 AM in Sir MV Seminar Hall.'
    );
  }
}

initDb();

module.exports = db;
