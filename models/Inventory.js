const mongoose = require('mongoose');

const InventorySchema = new mongoose.Schema(
  {
    itemName:       { type: String, required: true, trim: true },
    category:       { 
      type: String, 
      enum: ['Furniture', 'Networking', 'Computers', 'Lab Equipment'], 
      default: 'Computers' 
    },
    totalStock:     { type: Number, default: 0 },
    availableStock: { type: Number, default: 0 },
    vendorName:     { type: String, default: '' },
    collegeCode:    { type: String, required: true, uppercase: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Inventory || mongoose.model('Inventory', InventorySchema);
