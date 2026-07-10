import { useState, useEffect } from 'react';
import axios from 'axios';
import liff from '@line/liff'; // 👈 1. นำเข้า LIFF SDK
import './App.css';

function App() {
  const [mediaFiles, setMediaFiles] = useState([]);
  const [profile, setProfile] = useState(null); // 👈 2. โกดังเก็บข้อมูลผู้ใช้

  useEffect(() => {
    // ฟังก์ชันสั่งสตาร์ท LIFF
    const initLiff = async () => {
      try {
        await liff.init({
          liffId: "2010664170-y9VzNahZ" // 👈 🔴 เอา LIFF ID มาวางทับข้อความนี้เลย
        });

        // ถ้าอยู่ในแอป LINE ให้ดึงข้อมูลโปรไฟล์มาเลย
        if (liff.isLoggedIn()) {
          const userProfile = await liff.getProfile();
          setProfile(userProfile);
        }
      } catch (err) {
        console.error("เกิดข้อผิดพลาดในการโหลด LIFF:", err);
      }
    };

    initLiff();
    fetchMedia();
  }, []);

  const fetchMedia = async () => {
    try {
      const response = await axios.get('https://teams-modes-entering-cams.trycloudflare.com/api/media');
      setMediaFiles(response.data);
    } catch (error) {
      console.error("ดึงข้อมูลไม่สำเร็จ (มือถืออาจจะมองไม่เห็น localhost):", error);
    }
  };

  return (
    <div className="container">
      
      {/* 🟢 ส่วนหัวเว็บ: โชว์โปรไฟล์ LINE ถ้ามีข้อมูล */}
      {profile ? (
        <div className="profile-box">
          <img src={profile.pictureUrl} alt="profile" className="profile-img" />
          <h2>สวัสดีคุณ {profile.displayName} 👋</h2>
        </div>
      ) : (
        <h1>📁 My LINE File Manager</h1>
      )}

      <p>ระบบจัดการไฟล์และรูปภาพจาก LINE Bot</p>

      <div className="gallery">
        {mediaFiles.map((item) => (
          <div key={item._id} className="card">
            {item.fileType === 'image' ? (
              <div className="image-container">
                <img src={item.fileUrl} alt="line-upload" />
              </div>
            ) : (
              <div className="file-container">
                <div className="file-icon">📄</div>
                <p className="file-name">{item.fileName || 'เอกสาร'}</p>
                <a href={item.fileUrl} target="_blank" rel="noreferrer" className="download-btn">
                  ดาวน์โหลดไฟล์
                </a>
              </div>
            )}
            <div className="card-footer">
              <small>ส่งเมื่อ: {new Date(item.createdAt).toLocaleDateString('th-TH')}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;