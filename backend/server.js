require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const line = require('@line/bot-sdk');
const { GoogleGenerativeAI } = require("@google/generative-ai"); 

const Media = require('./models/Media');
const User = require('./models/User');
const SystemConfig = require('./models/SystemConfig');

const app = express();
app.use(cors());

// ตั้งค่า AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);


// ตั้งค่าระบบอื่นๆ
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};
const client = new line.Client(config);

mongoose.connect(process.env.MONGODB_URI).then(() => console.log('✅ Connected to MongoDB')).catch(err => console.error(err));

// --- API ---
app.post('/api/users', express.json(), async (req, res) => {
  try {
    const { lineId, displayName, pictureUrl } = req.body;
    const user = await User.findOneAndUpdate({ lineId }, { displayName, pictureUrl }, { new: true, upsert: true });
    res.json(user);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/media', async (req, res) => {
  try {
    const userId = req.query.userId;
    let filter = userId ? { ownerId: userId } : {};
    const media = await Media.find(filter).sort({ createdAt: -1 });
    res.json(media);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- 🟢 API สำหรับอัปเดตข้อมูลไฟล์ (Tag & Note) จากหน้าเว็บ ---
app.put('/api/media/:id', express.json(), async (req, res) => {
  try {
    const { tags, note } = req.body;
    const updatedMedia = await Media.findByIdAndUpdate(
      req.params.id,
      { tags, note },
      { new: true } // ให้ส่งข้อมูลที่อัปเดตแล้วกลับมา
    );
    res.json(updatedMedia);
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
});

// --- 🔴 API สำหรับลบไฟล์ (Delete) ---
app.delete('/api/media/:id', async (req, res) => {
  try {
    const deletedMedia = await Media.findByIdAndDelete(req.params.id);
    if (!deletedMedia) return res.status(404).json({ error: 'ไม่พบไฟล์ที่ต้องการลบ' });
    res.json({ message: 'ลบไฟล์สำเร็จเรียบร้อย' });
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
});

app.get('/api/admin/config', async (req, res) => {
  try {
    let sysConfig = await SystemConfig.findOne({ key: 'default_config' });
    if (!sysConfig) sysConfig = await SystemConfig.create({ key: 'default_config' });
    res.json(sysConfig);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/admin/config', express.json(), async (req, res) => {
  try {
    const { userId, aiEnabled, aiPrompt, aiModel } = req.body; // 🟢 เพิ่ม aiModel
    const user = await User.findOne({ lineId: userId });
    if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    
    const sysConfig = await SystemConfig.findOneAndUpdate(
      { key: 'default_config' },
      { aiEnabled, aiPrompt, aiModel }, // 🟢 บันทึก aiModel ลงฐานข้อมูล
      { new: true, upsert: true }
    );
    res.json(sysConfig);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/webhook', line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent)).then((result) => res.json(result)).catch((err) => res.status(500).end());
});

// --- ฟังก์ชันหลัก ---
async function handleEvent(event) {
  if (event.type !== 'message') return Promise.resolve(null);
  const userId = event.source.userId;
  const sourceType = event.source.type;
  const groupId = event.source.groupId || null;

  if (event.message.type === 'text') {
    const text = event.message.text;
    if (text.includes('#')) {
      const tags = text.match(/#[^\s#]+/g);
      if (tags && tags.length > 0) {
        try {
          const latestMedia = await Media.findOne({ ownerId: userId, groupId }).sort({ createdAt: -1 });
          if (latestMedia) {
            latestMedia.tags = [...new Set([...(latestMedia.tags || []), ...tags])];
            await latestMedia.save();
            return client.replyMessage(event.replyToken, { type: 'text', text: `🏷️ บอทจัดการติดแท็ก ${tags.join(', ')} ให้ไฟล์ล่าสุดเรียบร้อยครับ!` });
          }
        } catch (err) { console.error(err); }
      }
    }
    return Promise.resolve(null);
  }

  if (event.message.type === 'image' || event.message.type === 'file') {
    try {
      const stream = await client.getMessageContent(event.message.id);
      let chunks = [];
      for await (const chunk of stream) { chunks.push(chunk); }
      const buffer = Buffer.concat(chunks);

      let summary = '';
      const sysConfig = await SystemConfig.findOne({ key: 'default_config' });
      
      // 🟢 ตรวจสอบสถานะว่าแอดมินเปิด AI ไว้หรือไม่
      if (sysConfig && sysConfig.aiEnabled) {
         try {
            // 1. ดักจับไฟล์ PDF (ให้ AI อ่านเฉพาะรูปภาพเท่านั้น)
            if (event.message.type !== 'image') {
                summary = "🤖 ตอนนี้ AI ของผมรองรับเฉพาะการอ่าน 'รูปภาพ' เท่านั้นครับ รบกวนส่งเป็นรูปมาน้า 😅";
            } else {
                // 2. ล้างช่องว่างล่องหน (Trim) ที่อาจแถมมาตอนพิมพ์ในหน้าเว็บ
                let rawModelName = sysConfig.aiModel ? sysConfig.aiModel.trim() : "gemini-1.5-flash";
                
                const mimeType = 'image/jpeg';
                const dynamicModel = genAI.getGenerativeModel({ model: rawModelName });
    
                const result = await dynamicModel.generateContent([
                  sysConfig.aiPrompt || "ช่วยสรุปข้อความให้หน่อย", 
                  { inlineData: { data: buffer.toString("base64"), mimeType } }
                ]);
                summary = result.response.text();
            }
         } catch (aiErr) {
            console.error("AI Generation Error:", aiErr);
            summary = "ไม่สามารถสรุปได้ (อาจจะใส่ชื่อโมเดล AI ในตั้งค่าผิด หรือ Google งอแงครับ)";
         }
      }

      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream({ resource_type: 'auto', folder: 'line_files' }, (error, result) => {
          if (error) reject(error); else resolve(result);
        });
        uploadStream.end(buffer);
      });

      const newMedia = new Media({
        fileUrl: uploadResult.secure_url,
        fileType: event.message.type,
        fileName: event.message.fileName || `file_${Date.now()}`,
        ownerId: userId,
        sourceType: sourceType,
        groupId: groupId,
        note: summary // 🟢 บันทึกผลลัพธ์จาก AI ลงฐานข้อมูล
      });
      await newMedia.save();

      let replyText = sourceType === 'group' ? '🤖 บอทแอบเซฟไฟล์จากแชทกลุ่มเข้าคลังเรียบร้อยแล้ว!' : '🎉 บันทึกไฟล์เรียบร้อยแล้ว!';
      
      // 🟢 นำผลสรุป AI มาต่อท้ายข้อความตอบกลับ
      if (summary) {
        replyText = `🤖 AI สรุปให้:\n${summary}\n\n${replyText}`;
      }

      return client.replyMessage(event.replyToken, { type: 'text', text: replyText });

    } catch (error) {
      console.error("Upload Error:", error);
      return client.replyMessage(event.replyToken, { type: 'text', text: 'เกิดข้อผิดพลาดในการบันทึกไฟล์ครับ 🥲' });
    }
  }
  return Promise.resolve(null);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server on ${PORT}`));