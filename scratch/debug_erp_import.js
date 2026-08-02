const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Force Google DNS for Atlas SRV lookups

require('dotenv').config({ path: 'e:\\indra projects\\STUDENT OS\\backend\\.env' });
const mongoose = require('mongoose');
const User = require('../models/User');
const Department = require('../models/Department');
const Subject = require('../models/Subject');
const Timetable = require('../models/Timetable');
const StudentRecord = require('../models/StudentRecord');
const ErpImport = require('../models/ErpImport');

// Mock import controller function to catch exact error stack
const { executeImportData } = require('../controllers/erpController');

async function debugImport() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.');

  const mockRecords = [
    {
      'Roll Number': '25G2A04LA3',
      'Admission Number': 'ADM25G0403',
      'Student Name': 'MITTAPALLI INDRASENA REDDY',
      'Department': 'ECE',
      'Semester': '4',
      'Section': 'A',
      'Gender': 'Male',
      'DOB': '2004-05-12',
      'Blood Group': 'O+',
      'Address': 'Nellore Andhra Pradesh',
      'Parent Name': 'M Subba Reddy',
      'Parent Mobile': '9988776655',
      'Email': 'indrasena@gmail.com',
      'Phone': '8899001122'
    },
    {
      'Roll Number': '25G2A0501',
      'Admission Number': 'ADM25G0501',
      'Student Name': 'KAVYA RANI K',
      'Department': 'CSE',
      'Semester': '4',
      'Section': 'A',
      'Gender': 'Female',
      'DOB': '2005-02-14',
      'Blood Group': 'B+',
      'Address': 'Gudur Andhra Pradesh',
      'Parent Name': 'K Srinivasa Rao',
      'Parent Mobile': '9988776611',
      'Email': 'kavya@gmail.com',
      'Phone': '8899001133'
    },
    {
      'Roll Number': '25G2A0201',
      'Admission Number': 'ADM25G0201',
      'Student Name': 'SAI KUMAR P',
      'Department': 'EEE',
      'Semester': '4',
      'Section': 'A',
      'Gender': 'Male',
      'DOB': '2004-11-20',
      'Blood Group': 'A+',
      'Address': 'Tirupati Andhra Pradesh',
      'Parent Name': 'P Venkat Rao',
      'Parent Mobile': '9988776622',
      'Email': 'saikumar@gmail.com',
      'Phone': '8899001144'
    },
    {
      'Roll Number': '25G2A0301',
      'Admission Number': 'ADM25G0301',
      'Student Name': 'PAVAN KALYAN M',
      'Department': 'ME',
      'Semester': '4',
      'Section': 'A',
      'Gender': 'Male',
      'DOB': '2004-08-30',
      'Blood Group': 'O-',
      'Address': 'Nellore Andhra Pradesh',
      'Parent Name': 'M Ramana',
      'Parent Mobile': '9988776633',
      'Email': 'pavan@gmail.com',
      'Phone': '8899001155'
    },
    {
      'Roll Number': '25G2A0101',
      'Admission Number': 'ADM25G0101',
      'Student Name': 'SRAVANI CH',
      'Department': 'CE',
      'Semester': '4',
      'Section': 'A',
      'Gender': 'Female',
      'DOB': '2005-06-18',
      'Blood Group': 'A-',
      'Address': 'Gudur Andhra Pradesh',
      'Parent Name': 'Ch Krishna',
      'Parent Mobile': '9988776644',
      'Email': 'sravani@gmail.com',
      'Phone': '8899001166'
    },
    {
      'Roll Number': '25G2A1201',
      'Admission Number': 'ADM25G1201',
      'Student Name': 'MANOJ KUMAR D',
      'Department': 'IT',
      'Semester': '4',
      'Section': 'B',
      'Gender': 'Male',
      'DOB': '2004-04-05',
      'Blood Group': 'AB+',
      'Address': 'Tirupati Andhra Pradesh',
      'Parent Name': 'D Hari Prasad',
      'Parent Mobile': '9988776666',
      'Email': 'manoj@gmail.com',
      'Phone': '8899001177'
    }
  ];

  const req = {
    body: {
      importType: 'students',
      records: mockRecords,
      fileName: 'test.csv',
      duplicateStrategy: 'Update Existing Records',
      dryRun: false
    },
    user: {
      collegeCode: 'ASCET001',
      _id: new mongoose.Types.ObjectId()
    },
    ip: '127.0.0.1',
    headers: {
      'user-agent': 'Node.js Test'
    },
    app: {
      get: (key) => null
    }
  };

  const res = {
    status: (code) => {
      console.log('Response Status:', code);
      return res;
    },
    json: (data) => {
      console.log('Response JSON:', data);
      return res;
    }
  };

  try {
    await executeImportData(req, res);
    console.log('Finished calling executeImportData. Waiting 10 seconds for background task to complete...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    console.log('Finished waiting.');
  } catch (err) {
    console.error('CRITICAL ERROR CAUGHT:');
    console.error(err.stack || err);
  } finally {
    process.exit(0);
  }
}

debugImport();
