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

  const userId = event.source.userId; // 🟢 ดึง LINE ID ของคนที่ส่งข้อความมา

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

      // 🟢 บันทึกข้อมูลลงฐานข้อมูล พร้อมระบุเจ้าของไฟล์ (ownerId)
      const newMedia = new Media({
        fileUrl: uploadResult.secure_url,
        fileType: event.message.type,
        fileName: event.message.fileName || `file_${Date.now()}`,
        ownerId: userId // ผูกไฟล์นี้กับคนที่ส่งเข้ามา
      });
      await newMedia.save();

      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: 'บันทึกไฟล์ของคุณเรียบร้อยแล้ว! 🎉'
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