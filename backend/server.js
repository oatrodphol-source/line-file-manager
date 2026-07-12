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
const Folder = require('./models/Folder'); // 🟢 เพิ่มการเรียกใช้โมเดลโฟลเดอร์
const Event = require('./models/Event');
const AuditLog = require('./models/AuditLog');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() }); // ให้เก็บไฟล์ในหน่วยความจำชั่วคราวก่อนส่งขึ้น Cloud
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
// --- 🟢 API สำหรับอัปเดตข้อมูลไฟล์ (Tag, Note, ชื่อไฟล์, ย้ายโฟลเดอร์) ---
app.put('/api/media/:id', express.json(), async (req, res) => {
  try {
    const { tags, note, folderId, fileName } = req.body; // 👈 🟢 เพิ่ม folderId และ fileName
    
    const updatedMedia = await Media.findByIdAndUpdate(
      req.params.id,
      { 
        tags, 
        note, 
        folderId: folderId || null, // ถ้าไม่มีค่าให้เป็น null (อยู่หน้าแรก)
        fileName 
      },
      { new: true }
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

// ==========================================
// 📁 หมวดหมู่ API สำหรับจัดการระบบโฟลเดอร์ (Phase 1)
// ==========================================

// 1. API สร้างโฟลเดอร์ใหม่
app.post('/api/folders', express.json(), async (req, res) => {
  try {
    const { name, ownerId, parentId } = req.body;
    const newFolder = new Folder({ 
      name, 
      ownerId, 
      parentId: parentId || null // ถ้าไม่ได้ระบุ parentId แปลว่าสร้างไว้หน้าแรกสุด
    });
    await newFolder.save();
    res.status(201).json(newFolder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. API ดึงรายการโฟลเดอร์ของผู้ใช้
app.get('/api/folders', async (req, res) => {
  try {
    const { userId, parentId } = req.query;
    
    // ค้นหาโฟลเดอร์ที่เป็นของผู้ใช้คนนี้
    let filter = { ownerId: userId };
    
    // เลือกระดับชั้นของโฟลเดอร์ (ถ้าส่ง parentId แปลว่าดึงโฟลเดอร์ย่อยข้างใน)
    if (parentId !== undefined) {
      filter.parentId = parentId === 'null' ? null : parentId;
    }

    const folders = await Folder.find(filter).sort({ createdAt: -1 });
    res.json(folders);
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
// --- 🟢 เติมเต็ม Phase 1: เปลี่ยนชื่อ และ ลบโฟลเดอร์ ---
app.put('/api/folders/:id', express.json(), async (req, res) => {
  try {
    const updatedFolder = await Folder.findByIdAndUpdate(req.params.id, { name: req.body.name }, { new: true });
    res.json(updatedFolder);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/folders/:id', async (req, res) => {
  try {
    // 💡 ความฉลาดของระบบ: ถอดไฟล์ออกจากโฟลเดอร์ที่กำลังจะโดนลบ ให้กลับไปอยู่หน้าแรก (ป้องกันไฟล์หาย)
    await Media.updateMany({ folderId: req.params.id }, { folderId: null });
    await Folder.findByIdAndDelete(req.params.id);
    res.json({ message: 'ลบโฟลเดอร์สำเร็จ' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- 🟢 เติมเต็ม Phase 3: แก้ไขกิจกรรมในปฏิทิน ---
app.put('/api/events/:id', express.json(), async (req, res) => {
  try {
    const updatedEvent = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedEvent);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

const PORT = process.env.PORT || 3000;
// --- 🟢 API สำหรับอัปโหลดไฟล์ผ่านหน้าเว็บ + ระบบตรวจจับเวอร์ชันซ้ำ (Phase 4) ---
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'ไม่พบไฟล์ที่อัปโหลด' });

    const { ownerId, folderId, userName } = req.body;
    const targetFolderId = folderId === 'null' || !folderId ? null : folderId;

    const stream = cloudinary.uploader.upload_stream(
      { resource_type: 'auto' },
      async (error, result) => {
        if (error) return res.status(500).json({ error });

        // 🔍 ตรวจสอบว่ามีไฟล์ชื่อนี้ในโฟลเดอร์นี้อยู่แล้วหรือไม่
        const existingFile = await Media.findOne({ 
          fileName: req.file.originalname, 
          folderId: targetFolderId, 
          ownerId: ownerId 
        });

        if (existingFile) {
          // 🔄 ตรวจพบไฟล์ซ้ำ! ทำการย้ายลิงก์ปัจจุบันไปเก็บในประวัติเวอร์ชันเก่าก่อน
          existingFile.versions.push({
            fileUrl: existingFile.fileUrl,
            versionNumber: existingFile.version
          });

          // อัปเดตลิงก์ปัจจุบันเป็นไฟล์ใหม่ที่เพิ่งอัปโหลด และเพิ่มเลขเวอร์ชัน
          existingFile.fileUrl = result.secure_url;
          existingFile.version += 1;
          await existingFile.save();

          // 📜 บันทึกประวัติประธาน (Audit Log)
          const log = new AuditLog({ action: 'UPLOAD_NEW_VERSION', details: `อัปโหลดเวอร์ชันใหม่ครอบทับไฟล์: ${req.file.originalname} (v${existingFile.version})`, performedBy: userName || 'User', ownerId });
          await log.save();

          return res.status(200).json(existingFile);
        } else {
          // 🆕 ไม่มีไฟล์ซ้ำ สร้างรายการใหม่ปกติ
          const newMedia = new Media({
            fileUrl: result.secure_url,
            fileType: result.resource_type === 'image' ? 'image' : 'document',
            fileName: req.file.originalname,
            ownerId: ownerId,
            sourceType: 'web',
            folderId: targetFolderId
          });
          await newMedia.save();

          const log = new AuditLog({ action: 'UPLOAD', details: `อัปโหลดไฟล์ใหม่: ${req.file.originalname}`, performedBy: userName || 'User', ownerId });
          await log.save();

          return res.status(201).json(newMedia);
        }
      }
    );
    stream.end(req.file.buffer);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/events', express.json(), async (req, res) => {
  try {
    const newEvent = new Event(req.body);
    await newEvent.save();
    res.status(201).json(newEvent);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/events/:id', async (req, res) => {
  try {
    await Event.findByIdAndDelete(req.params.id);
    res.json({ message: 'ลบกิจกรรมสำเร็จ' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- 🟢 API ดึงบันทึกประวัติการใช้งาน Audit Log (Phase 2) ---
app.get('/api/audit-logs', async (req, res) => {
  try {
    const logs = await AuditLog.find({ ownerId: req.query.userId }).sort({ createdAt: -1 }).limit(50);
    res.json(logs);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- 🟢 API สำหรับแจ้งเตือน (LINE Push & Broadcast) (แก้ไขการชนกันของตัวแปรแล้ว) ---

// 1. API บรอดแคสต์ประกาศจาก Admin ไปหาทุกคน
app.post('/api/admin/broadcast', express.json(), async (req, res) => {
  try {
    const { message, adminId } = req.body;
    await axios.post('https://api.line.me/v2/bot/message/broadcast', {
      messages: [{ type: 'text', text: `📢 [ประกาศจากระบบ]\n${message}` }]
    }, { 
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` 
      } 
    });
    const log = new AuditLog({ action: 'BROADCAST', details: `Admin ประกาศ: ${message}`, performedBy: 'Admin', ownerId: adminId });
    await log.save();
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// 2. API สั่งบอทแจ้งเตือนกำหนดการ (Push Notification)
app.post('/api/notify/event', express.json(), async (req, res) => {
  try {
    const { eventTitle, eventDate, userId } = req.body;
    await axios.post('https://api.line.me/v2/bot/message/push', {
      to: userId,
      messages: [{ 
        type: 'text', 
        text: `⏰ แจ้งเตือนกำหนดการ!\n📌 งาน: ${eventTitle}\n📅 วันที่: ${eventDate}\n\nอย่าลืมเตรียมตัวให้พร้อมนะครับ!` 
      }]
    }, { 
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` 
      } 
    });
    const log = new AuditLog({ action: 'NOTIFICATION', details: `แจ้งเตือนกิจกรรม: ${eventTitle}`, performedBy: 'System', ownerId: userId });
    await log.save();
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.listen(PORT, () => console.log(`🚀 Server on ${PORT}`));