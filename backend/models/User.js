const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  lineId: { type: String, required: true, unique: true }, // รหัสประจำตัวใน LINE
  displayName: { type: String, required: true }, // ชื่อใน LINE
  pictureUrl: { type: String }, // รูปโปรไฟล์
  role: { type: String, default: 'user' } // เผื่ออนาคตทำระบบ Admin
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);