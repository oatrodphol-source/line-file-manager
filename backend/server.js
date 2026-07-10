require('dotenv').config();
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const cors = require('cors');
const Media = require('./models/Media');

const app = express();

app.use(express.json());
app.use(cors()); 

const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('🛢️ Connected to MongoDB Atlas successfully!'))
    .catch((err) => console.error('❌ MongoDB connection error:', err.message));

app.get('/', (req, res) => {
    res.send('🚀 Backend is running!');
});

// ประตูส่งข้อมูล: API สำหรับดึงข้อมูลทั้งหมด
app.get('/api/media', async (req, res) => {
    try {
        const mediaFiles = await Media.find().sort({ createdAt: -1 });
        res.status(200).json(mediaFiles);
    } catch (error) {
        console.error('❌ ดึงข้อมูลล้มเหลว:', error.message);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    }
});

// 🟢 API สำหรับรับ Webhook จาก LINE 
app.post('/webhook', async (req, res) => {
    const events = req.body.events;

    if (events && events.length > 0) {
        for (const event of events) {
            
            if (event.type === 'message' && event.message.type === 'text') {
                const userText = event.message.text;
                try {
                    await axios.post('https://api.line.me/v2/bot/message/reply', {
                        replyToken: event.replyToken,
                        messages: [{ type: 'text', text: `บอทได้รับข้อความ: "${userText}"` }]
                    }, { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LINE_ACCESS_TOKEN}` } });
                } catch (error) { console.error('❌ ตอบกลับข้อความล้มเหลว'); }
            } 
            
            // 2️⃣ 👈 (แก้ไขใหม่) ดักจับทั้ง "image" และ "file"
            else if (event.type === 'message' && (event.message.type === 'image' || event.message.type === 'file')) {
                const messageId = event.message.id;
                const lineUserId = event.source.userId;
                const msgType = event.message.type; 
                
                // ถ้าเป็นไฟล์เอกสาร LINE จะส่งชื่อไฟล์มาให้ด้วย ถ้าเป็นรูปจะให้ชื่อว่า "Image File"
                const fileName = event.message.fileName || "Image File"; 
                
                console.log(`\n📄 เจอ ${msgType}! กำลังดาวน์โหลด ID: ${messageId}`);

                try {
                    const response = await axios.get(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
                        headers: { 'Authorization': `Bearer ${LINE_ACCESS_TOKEN}` },
                        responseType: 'arraybuffer'
                    });
                    
                    const fileBuffer = Buffer.from(response.data, 'binary');
                    console.log(`☁️ โหลดจาก LINE สำเร็จ กำลังส่งไป Cloudinary...`);

                    const uploadResult = await new Promise((resolve, reject) => {
                        const uploadStream = cloudinary.uploader.upload_stream(
                            { 
                                folder: "line-files",
                                resource_type: "auto" // 👈 (เพิ่มใหม่) สำคัญมาก! บอกให้ Cloudinary รับไฟล์ได้ทุกประเภท ไม่ใช่แค่รูป
                            },
                            (error, result) => {
                                if (error) reject(error);
                                else resolve(result);
                            }
                        );
                        uploadStream.end(fileBuffer);
                    });

                    console.log('✅ อัปโหลดขึ้น Cloudinary สำเร็จ!');

                    // บันทึกข้อมูลลง MongoDB
                    const newMedia = new Media({
                        messageId: messageId,
                        lineUserId: lineUserId,
                        fileUrl: uploadResult.secure_url,
                        fileType: msgType, // ใส่ว่าเป็น image หรือ file
                        fileName: fileName // ใส่ชื่อไฟล์ลงไปด้วย
                    });
                    
                    await newMedia.save();
                    console.log('💾 บันทึกข้อมูลลงฐานข้อมูล MongoDB สำเร็จ!');

                    await axios.post('https://api.line.me/v2/bot/message/reply', {
                        replyToken: event.replyToken,
                        messages: [{ type: 'text', text: `บันทึกไฟล์ [${fileName}] ถาวรสำเร็จ! 🎉\nURL: ${uploadResult.secure_url}` }]
                    }, { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LINE_ACCESS_TOKEN}` } });

                } catch (error) {
                    console.error('❌ เกิดข้อผิดพลาดในระบบ:', error.message);
                }
            }
        }
    }
    res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});