const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  fileUrl: { type: String, required: true },
  fileType: { type: String, required: true },
  fileName: { type: String, default: 'Untitled' },
  ownerId: { type: String, required: true },
  sourceType: { type: String },
  groupId: { type: String },
  tags: { type: [String], default: [] },
  note: { type: String, default: '' },
  folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
  version: { type: Number, default: 1 }, // เลขเวอร์ชันปัจจุบัน
  
  // 🟢 สิ่งที่เพิ่มเข้ามาใหม่สำหรับระบบ File Versioning (Phase 4)
  versions: [{
    fileUrl: { type: String },
    versionNumber: { type: Number },
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Media', mediaSchema);