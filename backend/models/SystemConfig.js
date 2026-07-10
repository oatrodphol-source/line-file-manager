const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'default_config' },
  aiEnabled: { type: Boolean, default: true }, // สวิตช์เปิด-ปิด AI
  aiPrompt: { 
    type: String, 
    default: 'ช่วยอ่านข้อความในรูปภาพหรือไฟล์นี้ แล้วสรุปใจความสำคัญสั้นๆ 3 บรรทัด หากมีวันกำหนดส่งงานให้ระบุให้ชัดเจน' 
  } // คำสั่งสั่งงาน AI ที่แอดมินแก้ได้
}, { timestamps: true });

module.exports = mongoose.model('SystemConfig', configSchema);