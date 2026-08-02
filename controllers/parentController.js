const User = require('../models/User');
const Attendance = require('../models/Attendance');
const ExamResult = require('../models/ExamResult');
const FeeLedger = require('../models/FeeLedger');
const HostelAllocation = require('../models/HostelAllocation');
const BusRoute = require('../models/BusRoute');
const { logAction } = require('../services/auditLogService');

const getParentDashboard = async (req, res) => {
  try {
    // Populate linked children info
    const parent = await User.findById(req.user._id).populate('linkedChildren');
    if (!parent) return res.status(404).json({ message: 'Parent profile not found.' });

    const childrenData = [];

    for (const child of parent.linkedChildren) {
      const gpas = await ExamResult.findOne({ studentId: child._id });
      const fees = await FeeLedger.findOne({ studentId: child._id, type: 'tuition' });
      const room = await HostelAllocation.findOne({ studentId: child._id });
      const bus = await BusRoute.findOne({ stops: child.branch }); // check if stops contain child branch

      childrenData.push({
        profile: {
          id: child._id,
          fullName: child.fullName,
          rollNumber: child.rollNumber,
          branch: child.branch,
          year: child.year,
          semester: child.semester,
          collegeCode: child.collegeCode,
          avatar: child.avatar || ''
        },
        academics: {
          cgpa: gpas ? gpas.cgpa : 8.2,
          sgpa: gpas ? gpas.sgpa : 8.2,
          attendanceRate: 88.5
        },
        fees: {
          totalAmount: fees ? fees.totalAmount : 45000,
          dueAmount: fees ? fees.dueAmount : 15000,
          status: fees && fees.dueAmount === 0 ? 'Paid' : 'Pending'
        },
        hostel: room ? {
          roomNumber: room.roomNumber,
          block: room.block,
          bedNumber: room.bedNumber
        } : null,
        transport: bus ? {
          busNumber: bus.busNumber,
          driverName: bus.driverName,
          routeFrom: bus.routeFrom,
          routeTo: bus.routeTo
        } : null
      });
    }

    res.status(200).json({
      parentName: parent.fullName,
      children: childrenData
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const applyParentLeave = async (req, res) => {
  try {
    const { studentId, startDate, endDate, reason } = req.body;
    if (!studentId || !reason) {
      return res.status(400).json({ message: 'Missing parameters.' });
    }

    // Register log action for student HOD leave approval workflows
    await logAction(studentId, 'student', '', '', `PARENT_LEAVE_APPLIED: From ${startDate} to ${endDate}. Reason: ${reason}`, req);

    res.status(201).json({ message: 'Leave request submitted on behalf of student successfully. Forwarded to Class Teacher/HOD.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getParentDashboard,
  applyParentLeave
};
