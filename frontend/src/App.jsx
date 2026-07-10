import { useState, useEffect } from 'react';
import axios from 'axios';
import liff from '@line/liff';

function App() {
  const [mediaFiles, setMediaFiles] = useState([]);
  const [profile, setProfile] = useState(null);
  const [selectedTag, setSelectedTag] = useState('All');

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

  const allTags = [...new Set(mediaFiles.flatMap(file => file.tags || []))];

  const displayedFiles = selectedTag === 'All' 
    ? mediaFiles 
    : mediaFiles.filter(file => file.tags && file.tags.includes(selectedTag));

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* 🟢 ส่วนที่ 1: Sidebar (โชว์เฉพาะจอคอม/ไอแพด) */}
      <div className="w-64 bg-white border-r border-gray-200 shadow-sm flex flex-col hidden md:flex">
        <div className="p-6">
          <h2 className="text-2xl font-black text-green-600 tracking-tight">📁 File Manager</h2>
        </div>
        <ul className="flex-1 px-4 space-y-2 overflow-y-auto">
          <li 
            onClick={() => setSelectedTag('All')}
            className={`p-3 rounded-xl font-semibold cursor-pointer flex items-center gap-3 transition-colors ${selectedTag === 'All' ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            📥 ทั้งหมด (All)
          </li>
          
          {allTags.map((tag, index) => (
            <li 
              key={index}
              onClick={() => setSelectedTag(tag)}
              className={`p-3 rounded-xl font-medium cursor-pointer flex items-center gap-3 transition-colors ${selectedTag === tag ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              🏷️ {tag}
            </li>
          ))}
        </ul>
      </div>

      {/* ส่วนที่ 2: Main Dashboard */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        <header className="bg-white border-b border-gray-200 p-4 flex justify-between items-center shadow-sm z-10">
          <h1 className="text-xl font-bold text-gray-800 ml-2 md:ml-0">
            {selectedTag === 'All' ? '📥 ไฟล์ทั้งหมด' : `📁 ${selectedTag}`}
          </h1>
          
          {profile && (
            <div className="flex items-center gap-3 bg-gray-50 px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-gray-200">
              <span className="text-sm font-semibold text-gray-700 hidden sm:block">{profile.displayName}</span>
              <img src={profile.pictureUrl} alt="profile" className="w-8 h-8 md:w-9 md:h-9 rounded-full border-2 border-green-500 shadow-sm" />
            </div>
          )}
        </header>

        {/* 🟢 ส่วนที่เพิ่มใหม่: แถบเลือกแท็กสำหรับ "มือถือ" โดยเฉพาะ (เลื่อนซ้ายขวาได้) */}
        <div className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex overflow-x-auto gap-2 shadow-sm z-0">
          <button 
            onClick={() => setSelectedTag('All')}
            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${selectedTag === 'All' ? 'bg-green-500 text-white border-green-500' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
          >
            📥 ทั้งหมด
          </button>
          {allTags.map((tag, index) => (
            <button 
              key={index}
              onClick={() => setSelectedTag(tag)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${selectedTag === tag ? 'bg-green-500 text-white border-green-500' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
            >
              🏷️ {tag}
            </button>
          ))}
        </div>

        {/* ส่วนที่ 3: Gallery Grid */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
          {displayedFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 mt-10">
              <span className="text-6xl mb-4">📭</span>
              <p>ไม่มีไฟล์ในหมวดหมู่นี้</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {displayedFiles.map((item) => (
                <div key={item._id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group cursor-pointer flex flex-col">
                  
                  {item.fileType === 'image' ? (
                    <div className="h-32 md:h-40 bg-gray-100 relative overflow-hidden">
                      <img src={item.fileUrl} alt="upload" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                  ) : (
                    <div className="h-32 md:h-40 bg-blue-50 flex flex-col items-center justify-center p-4">
                      <span className="text-4xl mb-2">📄</span>
                      <p className="text-xs text-center font-medium text-gray-600 line-clamp-2">{item.fileName}</p>
                    </div>
                  )}
                  
                  <div className="p-3 md:p-4 flex-1 flex flex-col justify-between border-t border-gray-50">
                    <div className="mb-2 flex flex-wrap gap-1">
                      {item.tags && item.tags.map((t, i) => (
                        <span key={i} className="bg-gray-100 text-gray-500 text-[10px] px-2 py-1 rounded-md font-medium">
                          {t}
                        </span>
                      ))}
                    </div>
                    <small className="text-gray-400 text-[10px] md:text-xs font-medium">📅 {new Date(item.createdAt).toLocaleDateString('th-TH')}</small>
                    {item.fileType !== 'image' && (
                      <a href={item.fileUrl} target="_blank" rel="noreferrer" className="mt-2 block text-center bg-green-500 hover:bg-green-600 text-white text-[10px] md:text-xs font-bold py-1.5 md:py-2 rounded-lg transition-colors">
                        ดาวน์โหลด
                      </a>
                    )}
                  </div>
                  
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;