import { useState, useEffect } from 'react';
import axios from 'axios';
import liff from '@line/liff';
import './App.css';

function App() {
  const [mediaFiles, setMediaFiles] = useState([]);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const initLiff = async () => {
      try {
        await liff.init({
          liffId: "2010664170-y9VzNahZ" // 👈 🔴 เอา LIFF ID ของคุณมาใส่ตรงนี้
        });

        if (liff.isLoggedIn()) {
          const userProfile = await liff.getProfile();
          setProfile(userProfile);

          // 🟢 1. ส่งข้อมูลโปรไฟล์ไปบันทึกที่ฐานข้อมูล (ระบบจะรู้ว่าใครล็อกอิน)
          await axios.post('https://line-file-manager.onrender.com/api/users', {
            lineId: userProfile.userId,
            displayName: userProfile.displayName,
            pictureUrl: userProfile.pictureUrl
          });

          // 🟢 2. สั่งดึงรูปภาพ โดยส่ง LINE ID ไปเป็นตัวกรอง
          fetchMedia(userProfile.userId);
        }
      } catch (err) {
        console.error("เกิดข้อผิดพลาดในการโหลด LIFF:", err);
      }
    };

    initLiff();
  }, []);

  // 🟢 ฟังก์ชันดึงข้อมูลแบบระบุตัวตน (ส่ง userId ไปด้วย)
  const fetchMedia = async (userId) => {
    try {
      const response = await axios.get(`https://line-file-manager.onrender.com/api/media?userId=${userId}`);
      setMediaFiles(response.data);
    } catch (error) {
      console.error("ดึงข้อมูลไม่สำเร็จ:", error);
    }
  };

  return (
    <div className="container">
      {profile ? (
        <div className="profile-box">
          <img src={profile.pictureUrl} alt="profile" className="profile-img" />
          <h2>สวัสดีคุณ {profile.displayName} 👋</h2>
        </div>
      ) : (
        <h1>📁 My LINE File Manager</h1>
      )}

      <p>พื้นที่เก็บไฟล์ส่วนตัวของคุณ</p>

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