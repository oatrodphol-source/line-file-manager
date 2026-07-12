const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: String, required: true }, // เก็บเป็น YYYY-MM-DD
  isAllDay: { type: Boolean, default: true }, // เปิด-ปิด ทำทั้งวัน
  startTime: { type: String, default: '' },
  endTime: { type: String, default: '' },
  url: { type: String, default: '' },
  description: { type: String, default: '' },
  ownerId: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);