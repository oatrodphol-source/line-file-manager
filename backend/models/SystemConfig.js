const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'default_config' },
  aiEnabled: { type: Boolean, default: true }, 
  aiPrompt: { 
    type: String, 
    default: 'ช่วยอ่านข้อความในรูปภาพหรือไฟล์นี้ แล้วสรุปใจความสำคัญสั้นๆ 3 บรรทัด หากมีวันกำหนดส่งงานให้ระบุให้ชัดเจน' 
  },
  // 🟢 เพิ่มฟิลด์สำหรับเก็บชื่อเวอร์ชันของ AI
  aiModel: { 
    type: String, 
    default: 'gemini-1.5-flash-latest' 
  }
}, { timestamps: true });

module.exports = mongoose.model('SystemConfig', configSchema);