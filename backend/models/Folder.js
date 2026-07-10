const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
  name: { type: String, required: true }, // ชื่อโฟลเดอร์
  ownerId: { type: String, required: true }, // เจ้าของโฟลเดอร์ (ใช้ LINE ID)
  type: { type: String, enum: ['private', 'shared'], default: 'private' }, // ดูคนเดียว หรือ แชร์กลุ่ม
  members: [{ type: String }] // เก็บรายชื่อ LINE ID ของเพื่อนที่เข้ามาดูได้
}, { timestamps: true });

module.exports = mongoose.model('Folder', folderSchema);