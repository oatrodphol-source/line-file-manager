const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  fileUrl: { type: String, required: true },
  fileType: { type: String, required: true },
  fileName: { type: String },
  
  // 🟢 ส่วนที่เพิ่มเข้ามาใหม่สำหรับ Phase 1
  ownerId: { type: String, required: true, default: 'system' }, // ผูกกับ LINE ID ของคนส่ง
  folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }, // ระบุว่าอยู่โฟลเดอร์ไหน
  tags: [{ type: String }], // เก็บแฮชแท็ก เช่น ['#สำคัญ', '#สหกิจ']
  note: { type: String } // เก็บข้อความอธิบายยาวๆ
  
}, { timestamps: true });

module.exports = mongoose.model('Media', mediaSchema);