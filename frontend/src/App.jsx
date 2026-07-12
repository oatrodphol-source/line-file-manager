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
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ tags: '', note: '', folderId: null, fileName: '' });

  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null); 
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // 🟢 State ใหม่สำหรับ Phase 2-4 (ค้นหา และ ปฏิทิน)
  const [searchQuery, setSearchQuery] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [events, setEvents] = useState([]);
  const [newEvent, setNewEvent] = useState({ title: '', date: '', description: '' });

  useEffect(() => {
    const initLiff = async () => {
      try {
        await liff.init({ liffId: "2010664170-y9VzNahZ" }); // 👈 🔴 แก้ไข LIFF ID ตรงนี้
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
          fetchEvents(userProfile.userId); // ดึงข้อมูลปฏิทิน
          if (res.data.role === 'admin') fetchConfig();
        }
      } catch (err) { console.error("Error:", err); }
    };
    initLiff();
  }, []);

  useEffect(() => {
    if (dbUser) {
      const parentId = currentFolder ? currentFolder._id : 'null';
      fetchFolders(dbUser.lineId, parentId);
    }
  }, [currentFolder, dbUser]);

  const fetchMedia = async (userId) => {
    try {
      const response = await axios.get(`https://line-file-manager.onrender.com/api/media?userId=${userId}`);
      setMediaFiles(response.data);
    } catch (error) { console.error(error); }
  };

  const fetchFolders = async (userId, parentId) => {
    try {
      const response = await axios.get(`https://line-file-manager.onrender.com/api/folders?userId=${userId}&parentId=${parentId}`);
      setFolders(response.data);
    } catch (error) { console.error(error); }
  };

  const fetchEvents = async (userId) => {
    try {
      const response = await axios.get(`https://line-file-manager.onrender.com/api/events?userId=${userId}`);
      setEvents(response.data);
    } catch (error) { console.error(error); }
  };

  const fetchConfig = async () => {
    try {
      const res = await axios.get('https://line-file-manager.onrender.com/api/admin/config');
      if (res.data) setAiConfig(res.data);
    } catch (err) { console.error(err); }
  };

  // 🟢 ฟังก์ชันสร้างกิจกรรมในปฏิทิน
  const handleAddEvent = async () => {
    if (!newEvent.title || !newEvent.date) return alert("กรุณาใส่ชื่อและวันที่");
    try {
      const res = await axios.post('https://line-file-manager.onrender.com/api/events', { ...newEvent, ownerId: dbUser.lineId });
      setEvents([...events, res.data].sort((a, b) => new Date(a.date) - new Date(b.date)));
      setNewEvent({ title: '', date: '', description: '' });
    } catch (error) { alert("เกิดข้อผิดพลาด"); }
  };

  // 🟢 ฟังก์ชันลบกิจกรรม
  const handleDeleteEvent = async (id) => {
    if(window.confirm("ลบกิจกรรมนี้?")) {
      await axios.delete(`https://line-file-manager.onrender.com/api/events/${id}`);
      setEvents(events.filter(e => e._id !== id));
    }
  };

  // 🟢 ฟังก์ชันแชร์ไฟล์ (ก๊อปลิงก์ส่งให้เพื่อน)
  const handleShareFile = (fileUrl) => {
    navigator.clipboard.writeText(fileUrl);
    alert("📋 ก๊อปลิงก์สำเร็จ! นำไปส่งให้เพื่อนใน LINE เพื่อแชร์ไฟล์ได้เลยครับ");
  };

  const createNewFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const res = await axios.post('https://line-file-manager.onrender.com/api/folders', {
        name: newFolderName, ownerId: dbUser.lineId, parentId: currentFolder ? currentFolder._id : null
      });
      setFolders([res.data, ...folders]);
      setNewFolderName(''); setShowNewFolderInput(false);
    } catch (error) { alert('❌ สร้างโฟลเดอร์ไม่สำเร็จ'); }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('ownerId', dbUser.lineId);
    if (currentFolder) formData.append('folderId', currentFolder._id);
    try {
      const res = await axios.post('https://line-file-manager.onrender.com/api/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' }});
      setMediaFiles([res.data, ...mediaFiles]);
      alert('✅ อัปโหลดไฟล์สำเร็จ!');
    } catch (err) { alert('❌ ขัดข้อง'); } finally { setIsUploading(false); }
  };

  const saveFileDetails = async () => {
    try {
      const tagArray = editForm.tags.split(',').map(t => t.trim()).filter(t => t);
      const formattedTags = tagArray.map(tag => tag.startsWith('#') ? tag : `#${tag}`);
      const res = await axios.put(`https://line-file-manager.onrender.com/api/media/${selectedFile._id}`, { 
        tags: formattedTags, note: editForm.note, folderId: editForm.folderId, fileName: editForm.fileName 
      });
      setMediaFiles(mediaFiles.map(f => f._id === selectedFile._id ? res.data : f));
      setSelectedFile(res.data); setIsEditing(false);
    } catch (err) { alert('ขัดข้อง'); }
  };

  const deleteFile = async () => {
    if (window.confirm('⚠️ ลบไฟล์นี้ถาวร?')) {
      await axios.delete(`https://line-file-manager.onrender.com/api/media/${selectedFile._id}`);
      setMediaFiles(mediaFiles.filter(f => f._id !== selectedFile._id));
      setSelectedFile(null);
    }
  };

  const handleDownload = async (url, fileName) => {
    if (liff.isInClient()) { liff.openWindow({ url: url, external: true }); }
    else {
      try {
        const response = await fetch(url); const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a'); link.href = blobUrl; link.download = fileName || 'download';
        document.body.appendChild(link); link.click(); document.body.removeChild(link); window.URL.revokeObjectURL(blobUrl);
      } catch (err) { window.open(url, '_blank'); }
    }
  };

  const saveConfig = async () => {
    try {
      await axios.post('https://line-file-manager.onrender.com/api/admin/config', { userId: dbUser.lineId, ...aiConfig });
      alert('✅ บันทึกแล้ว!');
    } catch (err) { alert('ขัดข้อง'); }
  };

  // 🟢 ระบบกรองค้นหาอัจฉริยะ (Search Filter)
  const currentFolderFiles = mediaFiles.filter(file => {
    if (!currentFolder) return !file.folderId;
    return file.folderId === currentFolder._id;
  });
  const allTags = [...new Set(mediaFiles.flatMap(file => file.tags || []))];
  let displayedFiles = selectedTag === 'All' ? currentFolderFiles : currentFolderFiles.filter(file => file.tags?.includes(selectedTag));
  
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    displayedFiles = currentFolderFiles.filter(f => f.fileName?.toLowerCase().includes(q) || f.note?.toLowerCase().includes(q) || f.tags?.some(t => t.toLowerCase().includes(q)));
  }
  const displayedFolders = searchQuery ? folders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())) : folders;

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      
      {/* Modal ดูไฟล์และแก้ไข */}
      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-80 transition-opacity backdrop-blur-sm">
          <div className="bg-white rounded-2xl overflow-hidden shadow-2xl w-full max-w-5xl flex flex-col md:flex-row max-h-[90vh]">
            <div className="flex-1 bg-gray-100 flex items-center justify-center relative min-h-[300px] group">
              {selectedFile.fileType === 'image' ? (
                <>
                  <img src={selectedFile.fileUrl} alt="full" className="max-w-full max-h-[50vh] md:max-h-[90vh] object-contain" />
                  <button onClick={() => handleDownload(selectedFile.fileUrl, selectedFile.fileName || `image_${Date.now()}.jpg`)} className="absolute bottom-4 left-4 bg-gray-900 bg-opacity-70 hover:bg-opacity-100 text-white py-2 px-4 rounded-xl shadow-lg transition-all flex items-center gap-2">
                    ⬇️ บันทึกรูปภาพ
                  </button>
                </>
              ) : (
                <div className="text-center p-8">
                  <span className="text-8xl mb-4 block">📄</span>
                  <button onClick={() => handleDownload(selectedFile.fileUrl, selectedFile.fileName || `file_${Date.now()}.pdf`)} className="inline-block bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-8 rounded-xl transition-colors shadow-sm">
                    ⬇️ ดาวน์โหลดไฟล์นี้
                  </button>
                </div>
              )}
              <button onClick={() => { setSelectedFile(null); setIsEditing(false); }} className="absolute top-4 right-4 bg-white text-gray-800 rounded-full w-12 h-12 flex items-center justify-center shadow-lg hover:bg-gray-200 font-black text-xl border-2 border-gray-100">✕</button>
            </div>

            <div className="w-full md:w-96 p-6 flex flex-col bg-white overflow-y-auto border-l border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800">รายละเอียด</h3>
                {!isEditing ? (
                  <div className="flex gap-2">
                    {/* 🟢 เพิ่มปุ่มแชร์ไฟล์ */}
                    <button onClick={() => handleShareFile(selectedFile.fileUrl)} className="text-sm bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded-lg font-bold transition-colors">🔗 แชร์</button>
                    <button onClick={() => setIsEditing(true)} className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg font-bold transition-colors">✏️ แก้ไข</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => setIsEditing(false)} className="text-sm bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-bold transition-colors">ยกเลิก</button>
                    <button onClick={saveFileDetails} className="text-sm bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg font-bold transition-colors">💾 บันทึก</button>
                  </div>
                )}
              </div>

              <div className="mb-4">
                {isEditing ? <input type="text" className="w-full p-2 border border-gray-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-green-500 outline-none mb-1" value={editForm.fileName || ''} onChange={(e) => setEditForm({...editForm, fileName: e.target.value})} /> : <p className="text-sm font-bold text-gray-700 mb-1">{selectedFile.fileName || 'ไม่ได้ตั้งชื่อไฟล์'}</p>}
                <p className="text-xs text-gray-400">📅 {new Date(selectedFile.createdAt).toLocaleString('th-TH')}</p>
              </div>

              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">📁 ย้ายแฟ้ม</p>
                {isEditing ? (
                  <select className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-500 outline-none" value={editForm.folderId || 'null'} onChange={(e) => setEditForm({...editForm, folderId: e.target.value === 'null' ? null : e.target.value})}>
                    <option value="null">🏠 หน้าแรกสุด</option>
                    {folders.map(f => <option key={f._id} value={f._id}>📂 {f.name}</option>)}
                  </select>
                ) : (
                  <div className="bg-gray-50 text-gray-600 text-sm px-3 py-2 rounded-lg border border-gray-200">{folders.find(f => f._id === selectedFile.folderId)?.name ? `📂 ${folders.find(f => f._id === selectedFile.folderId).name}` : '🏠 อยู่ในหน้าแรกสุด'}</div>
                )}
              </div>
              
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">🏷️ แท็ก</p>
                {isEditing ? <input type="text" className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" value={editForm.tags} onChange={(e) => setEditForm({...editForm, tags: e.target.value})} /> : <div className="flex flex-wrap gap-2">{selectedFile.tags?.map((t, i) => <span key={i} className="bg-indigo-50 text-indigo-600 text-xs px-2 py-1 rounded-md font-medium border border-indigo-100">{t}</span>)}</div>}
              </div>

              <div className="flex-1 flex flex-col">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">📝 โน้ต</p>
                {isEditing ? <textarea className="w-full flex-1 p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none resize-none min-h-[100px]" value={editForm.note} onChange={(e) => setEditForm({...editForm, note: e.target.value})}></textarea> : <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-sm text-gray-700 min-h-[100px] whitespace-pre-wrap overflow-y-auto">{selectedFile.note || "-"}</div>}
              </div>

              {isEditing && (
                 <button onClick={deleteFile} className="mt-4 text-sm bg-red-100 hover:bg-red-200 text-red-700 py-2 rounded-lg font-bold transition-colors w-full border border-red-200">🗑️ ลบไฟล์นี้ถาวร</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sidebar เมนูหลัก */}
      <div className="w-64 bg-white border-r border-gray-200 shadow-sm flex flex-col hidden md:flex">
        <div className="p-6 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => { setShowCalendar(false); setSelectedTag('All'); setCurrentFolder(null); }}>
          <h2 className="text-2xl font-black text-green-600 tracking-tight">📁 Drive</h2>
        </div>
        <ul className="flex-1 px-4 space-y-2 overflow-y-auto">
          <li onClick={() => { setShowCalendar(false); setSelectedTag('All'); setCurrentFolder(null); }} className={`p-3 rounded-xl font-semibold cursor-pointer flex items-center gap-3 transition-colors ${!showCalendar && selectedTag === 'All' && !currentFolder ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-100'}`}>📥 หน้าแรก (Home)</li>
          
          {/* 🟢 เมนูปฏิทิน */}
          <li onClick={() => setShowCalendar(true)} className={`p-3 rounded-xl font-semibold cursor-pointer flex items-center gap-3 transition-colors ${showCalendar ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>📅 ปฏิทินทีม</li>

          <div className="my-4 border-t border-gray-200"></div>
          {allTags.map((tag, index) => (
            <li key={index} onClick={() => { setShowCalendar(false); setSelectedTag(tag); setCurrentFolder(null); }} className={`p-3 rounded-xl font-medium cursor-pointer flex items-center gap-3 transition-colors ${!showCalendar && selectedTag === tag ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-100'}`}>🏷️ {tag}</li>
          ))}
          {dbUser?.role === 'admin' && (
            <>
              <div className="my-4 border-t border-gray-200"></div>
              <li onClick={() => { setShowCalendar(false); setSelectedTag('Admin'); }} className={`p-3 rounded-xl font-bold cursor-pointer flex items-center gap-3 transition-colors ${selectedTag === 'Admin' ? 'bg-indigo-50 text-indigo-700' : 'text-indigo-500 hover:bg-indigo-50'}`}>⚙️ ตั้งค่าระบบ AI</li>
            </>
          )}
        </ul>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 p-4 flex justify-between items-center shadow-sm z-10 gap-4">
          <h1 className="text-lg md:text-xl font-bold text-gray-800 ml-2 md:ml-0 flex items-center gap-2 truncate">
            {showCalendar ? '📅 ปฏิทินและตารางงาน' : selectedTag === 'Admin' ? '⚙️ Admin Panel' : (
              <>
                {currentFolder && <><button onClick={() => setCurrentFolder(null)} className="text-gray-400 hover:text-green-600 transition-colors">🏠 หน้าแรก</button><span className="text-gray-300">/</span></>}
                <span className="text-green-700 truncate">{currentFolder ? `📁 ${currentFolder.name}` : (selectedTag === 'All' ? '📥 หน้าแรก' : `🏷️ ${selectedTag}`)}</span>
              </>
            )}
          </h1>
          
          {/* 🟢 แถบค้นหา */}
          {!showCalendar && selectedTag !== 'Admin' && (
            <div className="flex-1 max-w-md hidden md:block">
              <input type="search" placeholder="🔍 ค้นหาไฟล์, แฟ้ม, โน้ต หรือแท็ก..." className="w-full bg-gray-100 border-none rounded-full px-5 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
          )}

          {profile && (
            <div className="flex items-center gap-3 bg-gray-50 px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-gray-200 shrink-0">
              <span className="text-sm font-semibold text-gray-700 hidden sm:block">{profile.displayName}</span>
              <img src={profile.pictureUrl} alt="profile" className="w-8 h-8 rounded-full border-2 border-green-500 shadow-sm" />
            </div>
          )}
        </header>

        {/* เมนูมือถือ */}
        <div className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex flex-col gap-3 shadow-sm z-0">
           {!showCalendar && selectedTag !== 'Admin' && (
              <input type="search" placeholder="🔍 ค้นหา..." className="w-full bg-gray-100 rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
           )}
          <div className="flex overflow-x-auto gap-2 pb-1">
            <button onClick={() => { setShowCalendar(false); setSelectedTag('All'); setCurrentFolder(null); }} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium border ${!showCalendar && selectedTag === 'All' && !currentFolder ? 'bg-green-500 text-white' : 'bg-gray-50 text-gray-600'}`}>🏠 หน้าแรก</button>
            <button onClick={() => setShowCalendar(true)} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium border ${showCalendar ? 'bg-blue-500 text-white' : 'bg-gray-50 text-gray-600'}`}>📅 ปฏิทิน</button>
            {allTags.map((tag, i) => <button key={i} onClick={() => { setShowCalendar(false); setSelectedTag(tag); setCurrentFolder(null); }} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium border ${!showCalendar && selectedTag === tag ? 'bg-green-500 text-white' : 'bg-gray-50 text-gray-600'}`}>🏷️ {tag}</button>)}
          </div>
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
          
          {/* 🟢 หน้าจอระบบปฏิทิน (Phase 3) */}
          {showCalendar ? (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">➕ เพิ่มกำหนดการใหม่</h3>
                <div className="flex flex-col md:flex-row gap-4">
                  <input type="date" className="p-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
                  <input type="text" placeholder="ชื่องาน หรือ เดดไลน์..." className="flex-1 p-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
                  <button onClick={handleAddEvent} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl transition-colors">บันทึก</button>
                </div>
              </div>

              <h3 className="text-lg font-bold text-gray-800 mb-4">🗓️ ตารางงานที่จะถึง</h3>
              {events.length === 0 ? <p className="text-gray-400 text-center py-10">ยังไม่มีกำหนดการใดๆ</p> : (
                <div className="space-y-3">
                  {events.map(ev => (
                    <div key={ev._id} className="bg-white p-4 rounded-xl shadow-sm border border-l-4 border-l-blue-500 flex justify-between items-center hover:shadow-md transition-shadow">
                      <div>
                        <p className="text-xs font-bold text-blue-500 mb-1">{new Date(ev.date).toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        <h4 className="font-bold text-gray-800 text-lg">{ev.title}</h4>
                      </div>
                      <button onClick={() => handleDeleteEvent(ev._id)} className="text-gray-400 hover:text-red-500 p-2">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          ) : selectedTag === 'Admin' ? (
            // หน้า Admin (คงเดิม)
            <div className="max-w-2xl mx-auto bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">⚙️ ควบคุมระบบผู้ช่วย AI</h2>
              <div className="mb-6 flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div><h3 className="font-semibold text-gray-700">เปิดใช้งาน AI สรุปเอกสาร</h3></div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={aiConfig.aiEnabled} onChange={(e) => setAiConfig({...aiConfig, aiEnabled: e.target.checked})} />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-green-500"></div>
                </label>
              </div>
              <textarea rows="4" className="w-full p-4 border border-gray-300 rounded-xl mb-4" value={aiConfig.aiPrompt} onChange={e => setAiConfig({...aiConfig, aiPrompt: e.target.value})} disabled={!aiConfig.aiEnabled}></textarea>
              <input type="text" className="w-full p-4 border border-gray-300 rounded-xl mb-6 font-mono" value={aiConfig.aiModel || ''} onChange={e => setAiConfig({...aiConfig, aiModel: e.target.value})} disabled={!aiConfig.aiEnabled} />
              <button onClick={saveConfig} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl">💾 บันทึกการตั้งค่า</button>
            </div>
          ) : (
            <>
              {/* หน้าหลัก Drive */}
              <div className="mb-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                  <h3 className="text-sm font-bold text-gray-500">📁 โฟลเดอร์ ({displayedFolders.length})</h3>
                  {!searchQuery && (
                    <div className="flex gap-2">
                      <label className="text-xs bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg font-bold cursor-pointer">
                        {isUploading ? '⏳ กำลังอัปโหลด...' : '☁️ อัปโหลดไฟล์'}
                        <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                      </label>
                      <button onClick={() => setShowNewFolderInput(!showNewFolderInput)} className="text-xs bg-green-100 text-green-700 px-4 py-2 rounded-lg font-bold">+ สร้างแฟ้มใหม่</button>
                    </div>
                  )}
                </div>
                
                {showNewFolderInput && !searchQuery && (
                  <div className="flex gap-2 mb-4 bg-white p-3 rounded-xl border border-green-200 shadow-sm max-w-md">
                    <input type="text" autoFocus value={newFolderName} onChange={(e)=>setNewFolderName(e.target.value)} placeholder="พิมพ์ชื่อแฟ้มใหม่..." className="flex-1 outline-none text-sm bg-transparent" />
                    <button onClick={createNewFolder} className="bg-green-500 text-white px-4 py-1.5 rounded-lg text-sm font-bold">สร้าง</button>
                    <button onClick={() => setShowNewFolderInput(false)} className="bg-gray-100 text-gray-600 px-4 py-1.5 rounded-lg text-sm font-bold">ยกเลิก</button>
                  </div>
                )}

                {displayedFolders.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
                    {displayedFolders.map(folder => (
                      <div key={folder._id} onClick={() => setCurrentFolder(folder)} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:border-green-400 flex items-center gap-3">
                        <span className="text-2xl">📁</span><span className="font-bold text-gray-700 truncate text-sm">{folder.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <h3 className="text-sm font-bold text-gray-500 mb-4 border-t border-gray-200 pt-6">📄 ไฟล์เอกสารและรูปภาพ ({displayedFiles.length})</h3>
              {displayedFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400"><span className="text-6xl mb-4">📭</span><p>ไม่พบไฟล์</p></div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                  {displayedFiles.map((item) => (
                    <div key={item._id} onClick={() => { setSelectedFile(item); setEditForm({ tags: item.tags?.join(', ') || '', note: item.note || '', folderId: item.folderId || null, fileName: item.fileName || '' }); setIsEditing(false); }} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg cursor-pointer flex flex-col">
                      {item.fileType === 'image' ? (
                        <div className="h-32 md:h-40 bg-gray-100 relative"><img src={item.fileUrl} alt="upload" className="w-full h-full object-cover" /></div>
                      ) : (
                        <div className="h-32 md:h-40 bg-blue-50 flex flex-col items-center justify-center p-4"><span className="text-4xl mb-2">📄</span><p className="text-xs text-center font-medium text-gray-600 line-clamp-2">{item.fileName}</p></div>
                      )}
                      <div className="p-3 flex-1 flex flex-col justify-between border-t border-gray-50">
                        <div className="mb-2 flex flex-wrap gap-1">
                          {item.tags?.map((t, i) => <span key={i} className="bg-gray-100 text-gray-500 text-[10px] px-2 py-1 rounded-md">{t}</span>)}
                        </div>
                        <small className="text-gray-400 text-[10px] md:text-xs font-medium">📅 {new Date(item.createdAt).toLocaleDateString('th-TH')}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;