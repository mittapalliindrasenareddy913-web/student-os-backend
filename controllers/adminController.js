const User = require('../models/User');
const FeeLedger = require('../models/FeeLedger');
const HostelAllocation = require('../models/HostelAllocation');
const BusRoute = require('../models/BusRoute');
const Inventory = require('../models/Inventory');
const Book = require('../models/Book');
const PlacementDrive = require('../models/PlacementDrive');
const { logAction } = require('../services/auditLogService');
const { sendFcmNotification } = require('../services/notificationService');

// =============================================================
// GLOBAL ADMIN STATS
// =============================================================
const getDashboardStats = async (req, res) => {
  try {
    const collegeCode = req.user.collegeCode;

    const totalFeesCount = await FeeLedger.countDocuments({ collegeCode });
    const totalBuses = await BusRoute.countDocuments({ collegeCode });
    const hostelOccupied = await HostelAllocation.countDocuments({ collegeCode, status: 'Allocated' });
    const placementCount = await PlacementDrive.countDocuments({ collegeCode });
    const booksCount = await Book.countDocuments({ collegeCode });

    res.status(200).json({
      totalFeesCount,
      totalBuses,
      hostelOccupied,
      placementCount,
      booksCount
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// ACCOUNTS FEES LEDGER
// =============================================================
const saveFeeLedger = async (req, res) => {
  try {
    const { studentId, totalAmount, paidAmount, type } = req.body;
    const collegeCode = req.user.collegeCode;

    if (!studentId || !totalAmount) {
      return res.status(400).json({ message: 'Missing parameters.' });
    }

    const paidVal = paidAmount || 0;
    const dueAmount = totalAmount - paidVal;
    const status = dueAmount <= 0 ? 'Paid' : paidVal > 0 ? 'Partial' : 'Unpaid';

    let ledger = await FeeLedger.findOne({ studentId, type, collegeCode });
    if (ledger) {
      ledger.totalAmount = totalAmount;
      ledger.paidAmount = paidVal;
      ledger.dueAmount = dueAmount;
      ledger.status = status;
      await ledger.save();
    } else {
      ledger = await FeeLedger.create({
        studentId,
        totalAmount,
        paidAmount: paidVal,
        dueAmount,
        status,
        type: type || 'tuition',
        collegeCode
      });
    }

    // Push notification to Student OS
    await sendFcmNotification({
      collegeCode,
      title: '💳 Fee Account Update',
      body: `Fee invoice updated. Current Balance: Rs. ${dueAmount}.`
    });

    res.status(200).json({ message: 'Fee ledger registered successfully.', ledger });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getFeeLedgers = async (req, res) => {
  try {
    const list = await FeeLedger.find({ collegeCode: req.user.collegeCode })
      .populate('studentId', 'fullName rollNumber branch')
      .sort({ createdAt: -1 });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// TRANSPORT BUS ROUTES
// =============================================================
const saveBusRoute = async (req, res) => {
  try {
    const { busNumber, driverName, routeFrom, routeTo, stops } = req.body;
    const collegeCode = req.user.collegeCode;

    if (!busNumber || !driverName || !routeFrom || !routeTo) {
      return res.status(400).json({ message: 'Missing parameters.' });
    }

    let route = await BusRoute.findOne({ busNumber: busNumber.toUpperCase(), collegeCode });
    if (route) {
      route.driverName = driverName;
      route.routeFrom = routeFrom;
      route.routeTo = routeTo;
      route.stops = stops || [];
      await route.save();
    } else {
      route = await BusRoute.create({
        busNumber: busNumber.toUpperCase(),
        driverName,
        routeFrom,
        routeTo,
        stops: stops || [],
        collegeCode
      });
    }

    res.status(200).json({ message: 'Bus route registered.', route });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getBusRoutes = async (req, res) => {
  try {
    const list = await BusRoute.find({ collegeCode: req.user.collegeCode }).sort({ busNumber: 1 });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// HOSTEL BED ALLOCATIONS
// =============================================================
const saveHostelAllocation = async (req, res) => {
  try {
    const { studentId, block, roomNumber, bedNumber } = req.body;
    const collegeCode = req.user.collegeCode;

    if (!studentId || !block || !roomNumber || !bedNumber) {
      return res.status(400).json({ message: 'Missing parameters.' });
    }

    const alloc = await HostelAllocation.create({
      studentId,
      block: block.toUpperCase(),
      roomNumber,
      bedNumber,
      status: 'Allocated',
      collegeCode
    });

    res.status(201).json({ message: 'Hostel bed allocated.', alloc });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getHostelAllocations = async (req, res) => {
  try {
    const list = await HostelAllocation.find({ collegeCode: req.user.collegeCode })
      .populate('studentId', 'fullName rollNumber branch')
      .sort({ createdAt: -1 });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// INVENTORY ASSET STOCK
// =============================================================
const saveInventoryItem = async (req, res) => {
  try {
    const { itemName, category, totalStock, vendorName } = req.body;
    const collegeCode = req.user.collegeCode;

    if (!itemName || !category) {
      return res.status(400).json({ message: 'Missing inventory fields.' });
    }

    const item = await Inventory.create({
      itemName,
      category,
      totalStock: totalStock || 0,
      availableStock: totalStock || 0,
      vendorName,
      collegeCode
    });

    res.status(201).json({ message: 'Inventory item added to register.', item });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getInventoryItems = async (req, res) => {
  try {
    const list = await Inventory.find({ collegeCode: req.user.collegeCode }).sort({ itemName: 1 });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getDashboardStats,
  saveFeeLedger,
  getFeeLedgers,
  saveBusRoute,
  getBusRoutes,
  saveHostelAllocation,
  getHostelAllocations,
  saveInventoryItem,
  getInventoryItems
};
