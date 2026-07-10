import { useState, useEffect } from 'react';
import axios from 'axios';
import liff from '@line/liff';

function App() {
  const [mediaFiles, setMediaFiles] = useState([]);
  const [profile, setProfile] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [selectedTag, setSelectedTag] = useState('All');
  const [aiConfig, setAiConfig] = useState({ aiEnabled: true, aiPrompt: '', aiModel: '' });
  
  const [selectedFile, setSelectedFile] = useState(null);
  
  // 🟢 1. เพิ่ม State สำหรับโหมดแก้ไขข้อมูล
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ tags: '', note: '' });

  useEffect(() => {
    const initLiff = async () => {
      try {
        await liff.init({ liffId: "2010664170-y9VzNahZ" }); // 👈 🔴 แก้ไขตรงนี้
        if (liff.isLoggedIn()) {
          const userProfile = await liff.getProfile();
          setProfile(userProfile);
          const res = await axios.post('https://line-file-manager.onrender.com/api/users', {
            lineId: userProfile.userId,
            displayName: userProfile.displayName,
            pictureUrl: userProfile.pictureUrl
          });
          setDbUser(res.data);
          fetchMedia(userProfile.userId);
          if (res.data.role === 'admin') fetchConfig();
        }
      } catch (err) { console.error("Error:", err); }
    };
    initLiff();
  }, []);

  const fetchMedia = async (userId) => {
    try {
      const response = await axios.get(`https://line-file-manager.onrender.com/api/media?userId=${userId}`);
      setMediaFiles(response.data);
    } catch (error) { console.error("ดึงข้อมูลไม่สำเร็จ:", error); }
  };

  const fetchConfig = async () => {
    try {
      const res = await axios.get('https://line-file-manager.onrender.com/api/admin/config');
      if (res.data) setAiConfig(res.data);
    } catch (err) { console.error(err); }
  };

  const saveConfig = async () => {
    try {
      await axios.post('https://line-file-manager.onrender.com/api/admin/config', {
        userId: dbUser.lineId, ...aiConfig
      });
      alert('✅ บันทึกการตั้งค่า AI เรียบร้อยแล้ว!');
    } catch (err) { alert('❌ เกิดข้อผิดพลาดในการบันทึก'); }
  };

  // 🟢 2. ฟังก์ชันสำหรับบันทึกการแก้ไขข้อมูลไฟล์
  const saveFileDetails = async () => {
    try {
      // จัดรูปแบบแท็กให้เรียบร้อย (เติม # ให้ถ้าลืมใส่)
      const tagArray = editForm.tags.split(',').map(t => t.trim()).filter(t => t);
      const formattedTags = tagArray.map(tag => tag.startsWith('#') ? tag : `#${tag}`);

      const res = await axios.put(`https://line-file-manager.onrender.com/api/media/${selectedFile._id}`, {
        tags: formattedTags,
        note: editForm.note
      });

      // อัปเดตข้อมูลบนหน้าจอโดยไม่ต้องรีเฟรชเว็บ
      setMediaFiles(mediaFiles.map(f => f._id === selectedFile._id ? res.data : f));
      setSelectedFile(res.data);
      setIsEditing(false);
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูลครับ');
      console.error(err);
    }
  };

  const allTags = [...new Set(mediaFiles.flatMap(file => file.tags || []))];
  const displayedFiles = selectedTag === 'All' ? mediaFiles : mediaFiles.filter(file => file.tags && file.tags.includes(selectedTag));

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      
      {/* หน้าต่าง Modal ดูรูปและแก้ไข */}
      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-80 transition-opacity backdrop-blur-sm">
          <div className="bg-white rounded-2xl overflow-hidden shadow-2xl w-full max-w-5xl flex flex-col md:flex-row max-h-[90vh]">
            
            <div className="flex-1 bg-gray-100 flex items-center justify-center relative min-h-[300px]">
              {selectedFile.fileType === 'image' ? (
                <img src={selectedFile.fileUrl} alt="full" className="max-w-full max-h-[50vh] md:max-h-[90vh] object-contain" />
              ) : (
                <div className="text-center p-8">
                  <span className="text-8xl mb-4 block">📄</span>
                  <a href={selectedFile.fileUrl} target="_blank" rel="noreferrer" className="inline-block bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-8 rounded-xl transition-colors shadow-sm">ดาวน์โหลดไฟล์นี้</a>
                </div>
              )}
              <button onClick={() => setSelectedFile(null)} className="absolute top-4 right-4 bg-white text-gray-800 rounded-full w-10 h-10 flex items-center justify-center shadow-md hover:bg-gray-200 transition-all font-bold">✕</button>
            </div>

            {/* 🟢 3. ส่วนแสดงรายละเอียดที่สามารถกด "แก้ไข" ได้ */}
            <div className="w-full md:w-96 p-6 flex flex-col bg-white overflow-y-auto border-l border-gray-100">
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-xl font-bold text-gray-800">รายละเอียดไฟล์</h3>
                
                {/* ปุ่มสลับโหมด แก้ไข/บันทึก */}
                {!isEditing ? (
                  <button onClick={() => setIsEditing(true)} className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg font-bold transition-colors shadow-sm">✏️ แก้ไข</button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => setIsEditing(false)} className="text-sm bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-bold transition-colors">ยกเลิก</button>
                    <button onClick={saveFileDetails} className="text-sm bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg font-bold transition-colors shadow-sm">💾 บันทึก</button>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 mb-6">📅 อัปโหลดเมื่อ: {new Date(selectedFile.createdAt).toLocaleString('th-TH')}</p>
              
              {/* ช่องแก้ไข Tags */}
              <div className="mb-6">
                <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">🏷️ หมวดหมู่ (Tags)</p>
                {isEditing ? (
                  <input 
                    type="text" 
                    className="w-full p-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none transition-all"
                    placeholder="คั่นด้วยลูกน้ำ เช่น #work, #doc"
                    value={editForm.tags}
                    onChange={(e) => setEditForm({...editForm, tags: e.target.value})}
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedFile.tags && selectedFile.tags.length > 0 ? selectedFile.tags.map((t, i) => (
                      <span key={i} className="bg-indigo-50 text-indigo-600 text-xs px-3 py-1.5 rounded-lg font-medium border border-indigo-100">{t}</span>
                    )) : <span className="text-sm text-gray-400 italic">ไม่ได้ระบุหมวดหมู่</span>}
                  </div>
                )}
              </div>

              {/* ช่องแก้ไข Note */}
              <div className="flex-1 flex flex-col">
                <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">📝 Note / ข้อความอธิบาย</p>
                {isEditing ? (
                  <textarea 
                    className="w-full flex-1 p-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none resize-none transition-all min-h-[150px]"
                    placeholder="พิมพ์ข้อความอธิบาย หรือวันที่กำหนดส่งงาน..."
                    value={editForm.note}
                    onChange={(e) => setEditForm({...editForm, note: e.target.value})}
                  ></textarea>
                ) : (
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-sm text-gray-700 min-h-[150px] whitespace-pre-wrap leading-relaxed overflow-y-auto">
                    {selectedFile.note || "ไม่มีข้อความโน้ต"}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* --- โครงสร้าง Sidebar และ Dashboard ปกติ --- */}
      <div className="w-64 bg-white border-r border-gray-200 shadow-sm flex flex-col hidden md:flex">
        <div className="p-6"><h2 className="text-2xl font-black text-green-600 tracking-tight">📁 File Manager</h2></div>
        <ul className="flex-1 px-4 space-y-2 overflow-y-auto">
          <li onClick={() => setSelectedTag('All')} className={`p-3 rounded-xl font-semibold cursor-pointer flex items-center gap-3 transition-colors ${selectedTag === 'All' ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-100'}`}>📥 ทั้งหมด (All)</li>
          {allTags.map((tag, index) => (
            <li key={index} onClick={() => setSelectedTag(tag)} className={`p-3 rounded-xl font-medium cursor-pointer flex items-center gap-3 transition-colors ${selectedTag === tag ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-100'}`}>🏷️ {tag}</li>
          ))}
          {dbUser?.role === 'admin' && (
            <>
              <div className="my-4 border-t border-gray-200"></div>
              <li onClick={() => setSelectedTag('Admin')} className={`p-3 rounded-xl font-bold cursor-pointer flex items-center gap-3 transition-colors ${selectedTag === 'Admin' ? 'bg-indigo-50 text-indigo-700' : 'text-indigo-500 hover:bg-indigo-50'}`}>⚙️ ตั้งค่าระบบ AI</li>
            </>
          )}
        </ul>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 p-4 flex justify-between items-center shadow-sm z-10">
          <h1 className="text-xl font-bold text-gray-800 ml-2 md:ml-0">{selectedTag === 'All' ? '📥 ไฟล์ทั้งหมด' : selectedTag === 'Admin' ? '⚙️ Admin Panel' : `📁 ${selectedTag}`}</h1>
          {profile && (
            <div className="flex items-center gap-3 bg-gray-50 px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-gray-200">
              <span className="text-sm font-semibold text-gray-700 hidden sm:block">{profile.displayName}</span>
              <img src={profile.pictureUrl} alt="profile" className="w-8 h-8 md:w-9 md:h-9 rounded-full border-2 border-green-500 shadow-sm" />
            </div>
          )}
        </header>

        {selectedTag !== 'Admin' && (
          <div className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex overflow-x-auto gap-2 shadow-sm z-0">
            <button onClick={() => setSelectedTag('All')} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${selectedTag === 'All' ? 'bg-green-500 text-white border-green-500' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>📥 ทั้งหมด</button>
            {allTags.map((tag, index) => (
              <button key={index} onClick={() => setSelectedTag(tag)} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${selectedTag === tag ? 'bg-green-500 text-white border-green-500' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>🏷️ {tag}</button>
            ))}
            {dbUser?.role === 'admin' && (
              <button onClick={() => setSelectedTag('Admin')} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-bold transition-colors border ${selectedTag === 'Admin' ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-indigo-50 text-indigo-600 border-indigo-200'}`}>⚙️ ตั้งค่า AI</button>
            )}
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
          {selectedTag === 'Admin' ? (
            <div className="max-w-2xl mx-auto bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">⚙️ ควบคุมระบบผู้ช่วย AI</h2>
              <div className="mb-6 flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div>
                  <h3 className="font-semibold text-gray-700">เปิดใช้งาน AI สรุปเอกสาร</h3>
                  <p className="text-sm text-gray-500">ให้ AI ช่วยสรุปข้อความอัตโนมัติเมื่อมีคนส่งไฟล์</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={aiConfig.aiEnabled} onChange={(e) => setAiConfig({...aiConfig, aiEnabled: e.target.checked})} />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                </label>
              </div>
              <div className="mb-6">
                <label className="block font-semibold text-gray-700 mb-2">คำสั่งระบบ (AI System Prompt)</label>
                <textarea rows="4" className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" value={aiConfig.aiPrompt} onChange={(e) => setAiConfig({...aiConfig, aiPrompt: e.target.value})} disabled={!aiConfig.aiEnabled}></textarea>
              </div>
              <div className="mb-6">
                <label className="block font-semibold text-gray-700 mb-2">เวอร์ชันโมเดล AI (AI Model Version)</label>
                <input type="text" className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono text-sm" value={aiConfig.aiModel || ''} onChange={(e) => setAiConfig({...aiConfig, aiModel: e.target.value})} disabled={!aiConfig.aiEnabled} placeholder="เช่น gemini-1.5-flash" />
              </div>
              <button onClick={saveConfig} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-sm">💾 บันทึกการตั้งค่า</button>
            </div>
          ) : (
            displayedFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 mt-10"><span className="text-6xl mb-4">📭</span><p>ไม่มีไฟล์ในหมวดหมู่นี้</p></div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {displayedFiles.map((item) => (
                  // 🟢 อัปเดตข้อมูลไฟล์และโหลดเข้าฟอร์มเตรียมแก้ไขตอนที่ถูกคลิก
                  <div key={item._id} onClick={() => { setSelectedFile(item); setEditForm({ tags: item.tags ? item.tags.join(', ') : '', note: item.note || '' }); setIsEditing(false); }} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-all transform hover:-translate-y-1 group cursor-pointer flex flex-col">
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
                          <span key={i} className="bg-gray-100 text-gray-500 text-[10px] px-2 py-1 rounded-md font-medium">{t}</span>
                        ))}
                      </div>
                      <small className="text-gray-400 text-[10px] md:text-xs font-medium">📅 {new Date(item.createdAt).toLocaleDateString('th-TH')}</small>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </main>
      </div>
    </div>
  );
}

export default App;