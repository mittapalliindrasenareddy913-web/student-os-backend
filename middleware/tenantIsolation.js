const tenantIsolation = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized. User session missing.' });
  }

  // Super Admins bypass all tenant isolation checks
  if (req.user.role === 'super_admin') {
    return next();
  }

  // 1. Enforce College Isolation
  const reqCollegeCode = req.headers?.['x-college-code'] || req.body?.collegeCode || req.query?.collegeCode || req.params?.collegeCode;
  const userCollege = req.user.collegeCode || '';
  
  if (reqCollegeCode && reqCollegeCode.toUpperCase() !== userCollege.toUpperCase()) {
    return res.status(403).json({ message: 'Access denied. Cross-college operations are strictly forbidden.' });
  }

  // Inject current user's collegeCode into request body to guarantee isolation on write/read
  req.collegeCode = req.user.collegeCode;

  // 2. Enforce Department Isolation for HOD and Faculty
  if (req.user.role === 'hod' || req.user.role === 'faculty') {
    const reqDepartment = req.body?.department || req.query?.department || req.params?.department;
    const userDept = req.user.assignedDepartment || '';
    if (reqDepartment && reqDepartment.trim().toUpperCase() !== userDept.toUpperCase()) {
      return res.status(403).json({ message: 'Access denied. Department authorization mismatch.' });
    }
    
    // Inject current HOD/Faculty department into request
    req.assignedDepartment = req.user.assignedDepartment;
  }

  next();
};

module.exports = tenantIsolation;
