require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const line = require('@line/bot-sdk');

// นำเข้า Models ที่เราเพิ่งสร้าง
const Media = require('./models/Media');
const User = require('./models/User');

const app = express();
app.use(cors());

// ตั้งค่า Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ตั้งค่า LINE
const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};
const client = new line.Client(config);

// เชื่อมต่อ MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas successfully!'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// 🟢 1. API สำหรับบันทึก/อัปเดตข้อมูลผู้ใช้ตอนเปิดหน้าเว็บ
app.post('/api/users', express.json(), async (req, res) => {
  try {
    const { lineId, displayName, pictureUrl } = req.body;
    // ค้นหาว่ามี User นี้ไหม ถ้ามีให้อัปเดต ถ้าไม่มีให้สร้างใหม่ (upsert)
    const user = await User.findOneAndUpdate(
      { lineId: lineId },
      { displayName, pictureUrl },
      { new: true, upsert: true }
    );
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🟢 2. API ดึงข้อมูลไฟล์ (กรองตามเจ้าของไฟล์)
app.get('/api/media', async (req, res) => {
  try {
    const userId = req.query.userId; // รับ LINE ID จากหน้าเว็บ
    let filter = {};
    if (userId) {
      filter.ownerId = userId; // กรองเอาเฉพาะไฟล์ของคนนี้
    }
    const media = await Media.find(filter).sort({ createdAt: -1 });
    res.json(media);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const SystemConfig = require('./models/SystemConfig'); // 🟢 เพิ่มบรรทัดนี้ไว้ด้านบนสุดตรงที่นำเข้า Model

// --- 🟢 API สำหรับดึงการตั้งค่าระบบ ---
app.get('/api/admin/config', async (req, res) => {
  try {
    let config = await SystemConfig.findOne({ key: 'default_config' });
    if (!config) {
      // ถ้ายังไม่มีการตั้งค่า ให้สร้างค่าเริ่มต้นขึ้นมา
      config = await SystemConfig.create({ key: 'default_config' });
    }
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 🟢 API สำหรับแอดมินใช้อัปเดตการตั้งค่า ---
app.post('/api/admin/config', express.json(), async (req, res) => {
  try {
    const { userId, aiEnabled, aiPrompt } = req.body;
    
    // 1. เช็กก่อนว่าคนที่ส่งคำขอมา เป็น Admin จริงไหม
    const user = await User.findOne({ lineId: userId });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึง (Admin only)' });
    }

    // 2. อัปเดตการตั้งค่า
    const config = await SystemConfig.findOneAndUpdate(
      { key: 'default_config' },
      { aiEnabled, aiPrompt },
      { new: true, upsert: true }
    );
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🟢 3. Webhook รับข้อความและไฟล์จาก LINE
app.post('/webhook', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error("Webhook Error:", err);
      res.status(500).end();
    });
});

async function handleEvent(event) {
  if (event.type !== 'message') return Promise.resolve(null);

  const userId = event.source.userId; 
  // 🟢 ดึงข้อมูลเพิ่มว่าข้อความนี้มาจากกลุ่ม หรือ แชทส่วนตัว
  const sourceType = event.source.type; 
  const groupId = event.source.groupId || null;

  // 🟢 ฟีเจอร์จับแฮชแท็กจากข้อความ
  if (event.message.type === 'text') {
    const text = event.message.text;
    
    // เช็กว่าข้อความมีเครื่องหมาย # หรือไม่
    if (text.includes('#')) {
      const tags = text.match(/#[^\s#]+/g); // ดึงคำที่มี # ทั้งหมดออกมา
      
      if (tags && tags.length > 0) {
        try {
          // ค้นหาไฟล์ล่าสุดที่คุณหรือกลุ่มนี้เพิ่งส่งเข้ามา
          const latestMedia = await Media.findOne({
            ownerId: userId,
            groupId: groupId
          }).sort({ createdAt: -1 });

          if (latestMedia) {
            // เอาแท็กใหม่ไปต่อท้ายแท็กเดิม (ไม่ซ้ำกัน)
            latestMedia.tags = [...new Set([...(latestMedia.tags || []), ...tags])];
            await latestMedia.save();
            
            return client.replyMessage(event.replyToken, {
              type: 'text',
              text: `🏷️ บอทจัดการติดแท็ก ${tags.join(', ')} ให้ไฟล์ล่าสุดเรียบร้อยครับ!`
            });
          } else {
            return client.replyMessage(event.replyToken, {
              type: 'text',
              text: '🤔 ไม่พบไฟล์ล่าสุดที่ให้ติดแท็กครับ ลองส่งรูปเข้ามาก่อนนะ'
            });
          }
        } catch (err) {
          console.error("Tagging Error:", err);
        }
      }
    }
    return Promise.resolve(null);
  }

  if (event.message.type === 'image' || event.message.type === 'file') {
    try {
      const stream = await client.getMessageContent(event.message.id);
      let chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { resource_type: 'auto', folder: 'line_files' },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(buffer);
      });

      // 🟢 บันทึกข้อมูลลงฐานข้อมูล พร้อมรหัสกลุ่ม
      const newMedia = new Media({
        fileUrl: uploadResult.secure_url,
        fileType: event.message.type,
        fileName: event.message.fileName || `file_${Date.now()}`,
        ownerId: userId,
        sourceType: sourceType, // ใส่ว่าเป็นกลุ่มหรือส่วนตัว
        groupId: groupId // ใส่ ID กลุ่ม
      });
      await newMedia.save();

      // 🟢 เปลี่ยนข้อความตอบกลับให้เข้ากับสถานการณ์
      const replyText = sourceType === 'group' 
        ? '🤖 บอทแอบเซฟไฟล์จากแชทกลุ่มเข้าคลังเรียบร้อยแล้ว!' 
        : '🎉 บันทึกไฟล์ส่วนตัวของคุณเรียบร้อยแล้ว!';

      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: replyText
      });

    } catch (error) {
      console.error("Upload Error:", error);
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: 'เกิดข้อผิดพลาดในการบันทึกไฟล์ครับ 🥲'
      });
    }
  }

  return Promise.resolve(null);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});