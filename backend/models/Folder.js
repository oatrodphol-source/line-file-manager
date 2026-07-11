const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  ownerId: { type: String, required: true }, // LINE ID ของผู้สร้าง
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }, // ถ้า null คือหน้าแรกสุด
  sharedWith: [{ 
    userId: String, 
    role: { type: String, enum: ['viewer', 'editor'] } 
  }],
}, { timestamps: true });

module.exports = mongoose.model('Folder', folderSchema);