function isAuthenticated(req, res, next) {
  if (req.session && (req.session.student || req.session.admin)) {
    return next();
  }
  req.session.flash = { type: 'danger', message: 'Please sign in to access this page.' };
  return res.redirect('/auth/login');
}

function isStudent(req, res, next) {
  if (req.session && req.session.student) {
    return next();
  }
  req.session.flash = { type: 'warning', message: 'Student access required.' };
  return res.redirect('/auth/login?role=student');
}

function isAdmin(req, res, next) {
  if (req.session && req.session.admin) {
    return next();
  }
  req.session.flash = { type: 'warning', message: 'Administrator credentials required.' };
  return res.redirect('/auth/login?role=admin');
}

function setLocals(req, res, next) {
  res.locals.currentStudent = req.session.student || null;
  res.locals.currentAdmin = req.session.admin || null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  res.locals.currentPath = req.path;
  next();
}

module.exports = {
  isAuthenticated,
  isStudent,
  isAdmin,
  setLocals
};
