const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  fileUrl: { type: String, required: true },
  fileType: { type: String, required: true },
  fileName: { type: String, default: 'Untitled' },
  ownerId: { type: String, required: true }, // LINE ID ของเจ้าของ
  sourceType: { type: String },
  groupId: { type: String },
  tags: { type: [String], default: [] },
  note: { type: String, default: '' },
  
  // 🟢 สิ่งที่เพิ่มเข้ามาใหม่สำหรับ Phase นี้
  folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }, // เก็บว่าไฟล์นี้อยู่โฟลเดอร์ไหน
  uploadedBy: { type: String }, // ใครเป็นคนอัปโหลด (กรณีเป็นโฟลเดอร์แชร์)
  version: { type: Number, default: 1 }, // สำหรับระบบ File Versioning
  sharedWith: [{ 
    userId: String, 
    role: { type: String, enum: ['viewer', 'editor'] } 
  }]
}, { timestamps: true });

module.exports = mongoose.model('Media', mediaSchema);