import { useState, useEffect } from 'react';
import axios from 'axios';
import liff from '@line/liff';

function App() {
  const [mediaFiles, setMediaFiles] = useState([]);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const initLiff = async () => {
      try {
        await liff.init({
          liffId: "2010664170-y9VzNahZ" // 👈 🔴 แก้ไขตรงนี้
        });

        if (liff.isLoggedIn()) {
          const userProfile = await liff.getProfile();
          setProfile(userProfile);

          await axios.post('https://line-file-manager.onrender.com/api/users', {
            lineId: userProfile.userId,
            displayName: userProfile.displayName,
            pictureUrl: userProfile.pictureUrl
          });

          fetchMedia(userProfile.userId);
        }
      } catch (err) {
        console.error("เกิดข้อผิดพลาดในการโหลด LIFF:", err);
      }
    };

    initLiff();
  }, []);

  const fetchMedia = async (userId) => {
    try {
      const response = await axios.get(`https://line-file-manager.onrender.com/api/media?userId=${userId}`);
      setMediaFiles(response.data);
    } catch (error) {
      console.error("ดึงข้อมูลไม่สำเร็จ:", error);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* 🟢 ส่วนที่ 1: Sidebar (เมนูด้านข้าง) */}
      <div className="w-64 bg-white border-r border-gray-200 shadow-sm flex flex-col hidden md:flex">
        <div className="p-6">
          <h2 className="text-2xl font-black text-green-600 tracking-tight">📁 File Manager</h2>
        </div>
        <ul className="flex-1 px-4 space-y-2 overflow-y-auto">
          <li className="p-3 bg-green-50 text-green-700 rounded-xl font-semibold cursor-pointer flex items-center gap-3 transition-colors">
            📥 Inbox (ยังไม่จัดหมวด)
          </li>
          <li className="p-3 text-gray-600 hover:bg-gray-100 rounded-xl font-medium cursor-pointer flex items-center gap-3 transition-colors">
            💼 สหกิจศึกษา
          </li>
          <li className="p-3 text-gray-600 hover:bg-gray-100 rounded-xl font-medium cursor-pointer flex items-center gap-3 transition-colors">
            🚀 โปรเจกต์พัฒนาระบบ
          </li>
        </ul>
      </div>

      {/* 🟢 ส่วนที่ 2: Main Dashboard (พื้นที่แสดงเนื้อหาหลัก) */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Header ด้านบน */}
        <header className="bg-white border-b border-gray-200 p-4 flex justify-between items-center shadow-sm z-10">
          <h1 className="text-xl font-bold text-gray-800 ml-4 md:ml-0">📥 Inbox</h1>
          
          {/* แสดงรูปโปรไฟล์มุมขวาบน */}
          {profile && (
            <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-full border border-gray-200">
              <span className="text-sm font-semibold text-gray-700 hidden sm:block">{profile.displayName}</span>
              <img src={profile.pictureUrl} alt="profile" className="w-9 h-9 rounded-full border-2 border-green-500 shadow-sm" />
            </div>
          )}
        </header>

        {/* 🟢 ส่วนที่ 3: Gallery Grid (พื้นที่โชว์ไฟล์) */}
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {mediaFiles.map((item) => (
              <div key={item._id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group cursor-pointer flex flex-col">
                
                {item.fileType === 'image' ? (
                  <div className="h-40 bg-gray-100 relative overflow-hidden">
                    <img src={item.fileUrl} alt="upload" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                ) : (
                  <div className="h-40 bg-blue-50 flex flex-col items-center justify-center p-4">
                    <span className="text-4xl mb-2">📄</span>
                    <p className="text-xs text-center font-medium text-gray-600 line-clamp-2">{item.fileName}</p>
                  </div>
                )}
                
                <div className="p-4 flex-1 flex flex-col justify-between border-t border-gray-50">
                  <small className="text-gray-400 text-xs font-medium">📅 {new Date(item.createdAt).toLocaleDateString('th-TH')}</small>
                  {item.fileType !== 'image' && (
                    <a href={item.fileUrl} target="_blank" rel="noreferrer" className="mt-3 block text-center bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-2 rounded-lg transition-colors">
                      ดาวน์โหลด
                    </a>
                  )}
                </div>
                
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;