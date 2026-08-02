const mongoose = require('mongoose');
const Subject = require('../models/Attendance');
console.log('Subject model name:', Subject.modelName);
console.log('Subject schema paths:', Object.keys(Subject.schema.paths));
