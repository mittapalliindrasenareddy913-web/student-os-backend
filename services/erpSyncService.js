const Department = require('../models/Department');
const Timetable = require('../models/Timetable');

/**
 * Ensures that an HOD is linked to their designated department
 * and removed from any other departments in the same college.
 */
const syncHODDepartmentLink = async (collegeCode, userId, deptCode) => {
  if (!collegeCode || !userId) return;

  // 1. Remove this user from any other department's HOD assignment slot in this college
  await Department.updateMany(
    { collegeCode: collegeCode.toUpperCase(), hodId: userId, code: { $ne: deptCode ? deptCode.toUpperCase() : '' } },
    { $set: { hodId: null } }
  );

  // 2. Assign the user as the HOD of the specified department
  if (deptCode) {
    await Department.findOneAndUpdate(
      { collegeCode: collegeCode.toUpperCase(), code: deptCode.toUpperCase() },
      { $set: { hodId: userId } }
    );
  }
};

/**
 * Scans all timetables for the college and automatically assigns the
 * faculty's User ID to any slots teaching their assigned subjects.
 */
const syncFacultyTimetableAssignments = async (collegeCode, facultyUser) => {
  if (!collegeCode || !facultyUser || !facultyUser.assignedClasses || facultyUser.assignedClasses.length === 0) return;

  for (const cls of facultyUser.assignedClasses) {
    if (!cls.year || !cls.section || !cls.subject) continue;

    // Find all timetable slots matching this class
    const timetables = await Timetable.find({
      collegeCode: collegeCode.toUpperCase(),
      department: facultyUser.assignedDepartment ? facultyUser.assignedDepartment.toUpperCase() : '',
      year: cls.year,
      section: cls.section.toUpperCase()
    });

    for (const tt of timetables) {
      let modified = false;
      for (const slot of tt.slots) {
        if (slot.subjectCode && slot.subjectCode.toUpperCase() === cls.subject.toUpperCase()) {
          slot.facultyId = facultyUser._id;
          modified = true;
        }
      }
      if (modified) {
        await tt.save();
      }
    }
  }
};

module.exports = {
  syncHODDepartmentLink,
  syncFacultyTimetableAssignments
};
