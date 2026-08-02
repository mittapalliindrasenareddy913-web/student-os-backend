const mongoose = require('mongoose');

const BusRouteSchema = new mongoose.Schema(
  {
    busNumber:   { type: String, required: true, unique: true, uppercase: true },
    driverName:  { type: String, required: true },
    routeFrom:   { type: String, required: true },
    routeTo:     { type: String, required: true },
    stops:       [{ type: String }],
    collegeCode: { type: String, required: true, uppercase: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.BusRoute || mongoose.model('BusRoute', BusRouteSchema);
