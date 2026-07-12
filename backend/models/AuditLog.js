const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true }, // 'UPLOAD', 'DELETE', 'RENAME', 'MOVE', 'CREATE_FOLDER'
  details: { type: String, required: true }, // รายละเอียด เช่น "อัปโหลดไฟล์รายงาน.pdf"
  performedBy: { type: String, default: 'System' }, // ชื่อผู้ใช้งานที่ทำรายการ
  ownerId: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);