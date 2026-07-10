const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  fileUrl: { type: String, required: true },
  fileType: { type: String, required: true },
  fileName: { type: String },
  
  ownerId: { type: String, required: true, default: 'system' }, 
  folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }, 
  tags: [{ type: String }], 
  note: { type: String },
  
  // 🟢 2 บรรทัดที่เพิ่มใหม่สำหรับระบบแชทกลุ่ม
  sourceType: { type: String, default: 'user' }, // เก็บว่ามาจาก 'user' (ส่วนตัว) หรือ 'group' (กลุ่ม)
  groupId: { type: String, default: null } // เก็บ ID ของกลุ่มแชทนั้นๆ
  
}, { timestamps: true });

module.exports = mongoose.model('Media', mediaSchema);