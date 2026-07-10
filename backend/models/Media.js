const mongoose = require('mongoose');

const MediaSchema = new mongoose.Schema({
    messageId: { type: String, required: true },
    lineUserId: { type: String, required: true },
    fileUrl: { type: String, required: true },
    fileType: { type: String, required: true },   // เก็บว่าเป็น image หรือ file
    fileName: { type: String, required: false },  // 👈 (เพิ่มใหม่) เก็บชื่อไฟล์เอกสาร
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Media', MediaSchema);