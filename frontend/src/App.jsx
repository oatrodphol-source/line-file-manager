import { useState, useEffect } from 'react';
import axios from 'axios';
import liff from '@line/liff';

const isImageFile = (file) => {
  if (!file) return false;
  const name = (file.fileName || '').toLowerCase();
  const url = (file.fileUrl || '').toLowerCase();
  if (name.endsWith('.pdf') || url.endsWith('.pdf')) return false;
  return file.fileType === 'image';
};

function App() {
  // 🟢 State ใหม่สำหรับเช็คสถานะการโหลดระบบ
  const [isReady, setIsReady] = useState(false);

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
  const [isEditingFolder, setIsEditingFolder] = useState(false);
  const [editFolderName, setEditFolderName] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [events, setEvents] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showEventModal, setShowEventModal] = useState(false);
  const [newEvent, setNewEvent] = useState({ _id: null, title: '', date: new Date().toLocaleDateString('en-CA'), isAllDay: true, startTime: '09:00', endTime: '10:00', url: '', description: '' });

  const [auditLogs, setAuditLogs] = useState([]);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  useEffect(() => {
    const initLiff = async () => {
      try {
        await liff.init({ liffId: "2010664170-y9VzNahZ" }); // 👈 🔴 แก้ไข LIFF ID ตรงนี้
        if (liff.isLoggedIn()) {
          const userProfile = await liff.getProfile();
          setProfile(userProfile);
          const res = await axios.post('https://line-file-manager.onrender.com/api/users', { lineId: userProfile.userId, displayName: userProfile.displayName, pictureUrl: userProfile.pictureUrl });
          setDbUser(res.data); fetchMedia(userProfile.userId); fetchEvents(userProfile.userId); fetchAuditLogs(userProfile.userId);
          if (res.data.role === 'admin') fetchConfig();
        }
        setIsReady(true); // 🟢 ให้ระบบรู้ว่าตรวจสอบ LIFF เสร็จแล้ว
      } catch (err) { 
        console.error("Error:", err); 
        setIsReady(true);
      }
    };
    initLiff();
  }, []);

  useEffect(() => { if (dbUser) fetchFolders(dbUser.lineId, currentFolder ? currentFolder._id : 'null'); }, [currentFolder, dbUser]);

  const fetchMedia = async (userId) => { try { const res = await axios.get(`https://line-file-manager.onrender.com/api/media?userId=${userId}`); setMediaFiles(res.data); } catch (e) {} };
  const fetchFolders = async (userId, parentId) => { try { const res = await axios.get(`https://line-file-manager.onrender.com/api/folders?userId=${userId}&parentId=${parentId}`); setFolders(res.data); } catch (e) {} };
  const fetchEvents = async (userId) => { try { const res = await axios.get(`https://line-file-manager.onrender.com/api/events?userId=${userId}`); setEvents(res.data); } catch (e) {} };
  const fetchConfig = async () => { try { const res = await axios.get('https://line-file-manager.onrender.com/api/admin/config'); if (res.data && Object.keys(res.data).length > 0) setAiConfig(res.data); } catch (e) {} };
  const fetchAuditLogs = async (userId) => { try { const res = await axios.get(`https://line-file-manager.onrender.com/api/audit-logs?userId=${userId}`); setAuditLogs(res.data); } catch (e) {} };

  const createNewFolder = async () => { if (!newFolderName.trim()) return; try { const res = await axios.post('https://line-file-manager.onrender.com/api/folders', { name: newFolderName, ownerId: dbUser.lineId, parentId: currentFolder ? currentFolder._id : null }); setFolders([res.data, ...folders]); setNewFolderName(''); setShowNewFolderInput(false); fetchAuditLogs(dbUser.lineId); } catch (error) {} };
  const handleRenameFolder = async () => { if (!editFolderName.trim()) return; try { const res = await axios.put(`https://line-file-manager.onrender.com/api/folders/${currentFolder._id}`, { name: editFolderName }); setCurrentFolder(res.data); setIsEditingFolder(false); fetchAuditLogs(dbUser.lineId); } catch (e) {} };
  const handleDeleteFolder = async () => { if (window.confirm('⚠️ ลบโฟลเดอร์นี้?\n(ไฟล์ข้างในจะไม่หาย แต่จะถูกย้ายไปหน้าแรก)')) { try { await axios.delete(`https://line-file-manager.onrender.com/api/folders/${currentFolder._id}`); setCurrentFolder(null); setIsEditingFolder(false); fetchMedia(dbUser.lineId); fetchAuditLogs(dbUser.lineId); } catch (e) {} } };

  const handleSaveEvent = async () => {
    if (!newEvent.title) return alert("กรุณาใส่ชื่อกิจกรรม");
    try {
      if (newEvent._id) { const res = await axios.put(`https://line-file-manager.onrender.com/api/events/${newEvent._id}`, newEvent); setEvents(events.map(ev => ev._id === res.data._id ? res.data : ev)); } 
      else { const res = await axios.post('https://line-file-manager.onrender.com/api/events', { ...newEvent, ownerId: dbUser.lineId }); setEvents([...events, res.data]); }
      setShowEventModal(false); setNewEvent({ _id: null, title: '', date: selectedDate.toLocaleDateString('en-CA'), isAllDay: true, startTime: '09:00', endTime: '10:00', url: '', description: '' }); fetchAuditLogs(dbUser.lineId);
    } catch (error) { alert("เกิดข้อผิดพลาด"); }
  };
  const handleDeleteEvent = async (id) => { if(window.confirm("ลบกิจกรรมนี้?")) { await axios.delete(`https://line-file-manager.onrender.com/api/events/${id}`); setEvents(events.filter(e => e._id !== id)); setShowEventModal(false); fetchAuditLogs(dbUser.lineId); } };
  const openEditEventModal = (ev) => { setNewEvent(ev); setShowEventModal(true); };

  const handleNotifyEventLINE = async () => { if (!newEvent._id) return; try { await axios.post('https://line-file-manager.onrender.com/api/notify/event', { eventTitle: newEvent.title, eventDate: newEvent.date, userId: dbUser.lineId }); alert("🔔 ส่งการแจ้งเตือนลง LINE ของคุณเรียบร้อยแล้ว!"); fetchAuditLogs(dbUser.lineId); } catch (e) { alert("❌ ส่งแจ้งเตือนไม่สำเร็จ"); } };
  const handleBroadcast = async () => { if (!broadcastMsg.trim()) return alert("กรุณาพิมพ์ข้อความ"); if (!window.confirm("📢 ยืนยันการส่งประกาศหาทุกคนในระบบ?")) return; setIsBroadcasting(true); try { await axios.post('https://line-file-manager.onrender.com/api/admin/broadcast', { message: broadcastMsg, adminId: dbUser.lineId }); alert("✅ ส่งประกาศสำเร็จ!"); setBroadcastMsg(''); fetchAuditLogs(dbUser.lineId); } catch (e) { alert("❌ บรอดแคสต์ล้มเหลว"); } finally { setIsBroadcasting(false); } };

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
  const handlePrevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  const selectedDateString = selectedDate.toLocaleDateString('en-CA');
  const eventsOnSelectedDate = events.filter(ev => ev.date === selectedDateString);

  const handleShareFile = (fileUrl) => { navigator.clipboard.writeText(fileUrl); alert("📋 ก๊อปลิงก์สำเร็จ!"); };
  
  const handleFileUpload = async (event) => {
    const file = event.target.files[0]; if (!file) return; setIsUploading(true);
    const formData = new FormData(); formData.append('file', file); formData.append('ownerId', dbUser.lineId); formData.append('userName', profile.displayName);
    if (currentFolder) formData.append('folderId', currentFolder._id);
    try { await axios.post('https://line-file-manager.onrender.com/api/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' }}); fetchMedia(dbUser.lineId); alert('✅ จัดการอัปโหลดไฟล์สำเร็จ!'); fetchAuditLogs(dbUser.lineId); } catch (err) {} finally { setIsUploading(false); }
  };
  
  const saveFileDetails = async () => {
    try {
      const tagArray = editForm.tags.split(',').map(t => t.trim()).filter(t => t); const formattedTags = tagArray.map(tag => tag.startsWith('#') ? tag : `#${tag}`);
      await axios.put(`https://line-file-manager.onrender.com/api/media/${selectedFile._id}`, { tags: formattedTags, note: editForm.note, folderId: editForm.folderId, fileName: editForm.fileName });
      fetchMedia(dbUser.lineId); setIsEditing(false); fetchAuditLogs(dbUser.lineId); setSelectedFile(null);
    } catch (err) {}
  };
  const deleteFile = async () => { if (window.confirm('⚠️ ลบไฟล์นี้ถาวร?')) { await axios.delete(`https://line-file-manager.onrender.com/api/media/${selectedFile._id}`); setMediaFiles(mediaFiles.filter(f => f._id !== selectedFile._id)); setSelectedFile(null); fetchAuditLogs(dbUser.lineId); } };
  
  const handleDownload = async (url, fileName) => {
    if (liff.isInClient()) { liff.openWindow({ url: url, external: true }); } 
    else { 
      try { 
        let downloadUrl = url;
        if (downloadUrl.includes('cloudinary.com') && !downloadUrl.includes('fl_attachment')) downloadUrl = downloadUrl.replace('/upload/', '/upload/fl_attachment/');
        const response = await fetch(downloadUrl); const blob = await response.blob(); const blobUrl = window.URL.createObjectURL(blob); 
        const link = document.createElement('a'); link.href = blobUrl; link.download = fileName || 'download'; 
        document.body.appendChild(link); link.click(); document.body.removeChild(link); window.URL.revokeObjectURL(blobUrl); 
      } catch (err) { window.open(url, '_blank'); } 
    }
  };
  const saveConfig = async () => { try { await axios.post('https://line-file-manager.onrender.com/api/admin/config', { userId: dbUser.lineId, ...aiConfig }); alert('✅ บันทึกแล้ว!'); } catch (err) {} };

  const currentFolderFiles = mediaFiles.filter(file => !currentFolder ? !file.folderId : file.folderId === currentFolder._id);
  const allTags = [...new Set(mediaFiles.flatMap(file => file.tags || []))];
  let displayedFiles = selectedTag === 'All' ? currentFolderFiles : currentFolderFiles.filter(file => file.tags?.includes(selectedTag));
  
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    displayedFiles = currentFolderFiles.filter(f => f.fileName?.toLowerCase().includes(q) || f.note?.toLowerCase().includes(q) || f.tags?.some(t => t.toLowerCase().includes(q)));
  }
  const displayedFolders = searchQuery ? folders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())) : folders;

  const renderCalendarDays = () => {
    const year = currentMonth.getFullYear(); const month = currentMonth.getMonth(); const daysInMonth = getDaysInMonth(year, month); const firstDay = getFirstDayOfMonth(year, month); const days = [];
    for (let i = 0; i < firstDay; i++) { days.push(<div key={`empty-${i}`} className="h-10 md:h-14"></div>); }
    for (let i = 1; i <= daysInMonth; i++) {
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const isSelected = selectedDateString === dateString; const isToday = new Date().toLocaleDateString('en-CA') === dateString; const hasEvents = events.some(ev => ev.date === dateString);
      days.push(<div key={i} onClick={() => { setSelectedDate(new Date(year, month, i)); setNewEvent({ _id: null, date: dateString, title: '', url: '', description: '', isAllDay: true, startTime: '09:00', endTime: '10:00' }); }} className={`h-12 md:h-16 flex flex-col items-center justify-center cursor-pointer rounded-full md:rounded-xl transition-all ${isSelected ? 'bg-red-500 text-white font-bold shadow-md' : isToday ? 'text-red-500 font-bold' : 'hover:bg-gray-100 text-gray-800'}`}><span className="text-sm md:text-lg">{i}</span>{hasEvents && <div className={`w-1.5 h-1.5 rounded-full mt-1 ${isSelected ? 'bg-white' : 'bg-gray-400'}`}></div>}</div>);
    }
    return days;
  };

  // 🟢 หน้าจอโหลดระบบ (กันจอขาว)
  if (!isReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 flex-col">
        <div className="w-12 h-12 border-4 border-green-200 border-t-green-500 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 font-medium">กำลังเชื่อมต่อระบบ...</p>
      </div>
    );
  }

  // 🟢 หน้าจอล็อกอิน สำหรับคนที่เปิดเว็บผ่านลิงก์ Vercel ตรงๆ (ไม่ได้เปิดใน LINE)
  if (!profile) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 flex-col p-4 font-sans">
        <div className="bg-white p-8 md:p-10 rounded-3xl shadow-xl text-center max-w-md w-full border border-gray-100">
          <span className="text-6xl mb-6 block">📁</span>
          <h1 className="text-2xl font-black text-gray-800 mb-2">Drive File Manager</h1>
          <p className="text-gray-500 mb-8 text-sm leading-relaxed">
            ระบบความปลอดภัยสำหรับองค์กร<br/>
            กรุณาล็อกอินผ่านบัญชี LINE ของคุณเพื่อเข้าสู่ระบบ
          </p>
          <button onClick={() => liff.login()} className="w-full bg-[#06C755] hover:bg-[#05b34c] text-white font-bold py-3.5 px-8 rounded-xl transition-all shadow-md flex items-center justify-center gap-2">
            <span className="text-xl text-white">💬</span> ล็อกอินด้วย LINE
          </button>
        </div>
      </div>
    );
  }

  // 👇 UI หลักของแอปเมื่อล็อกอินแล้ว (คงเดิมทุกประการ ปลอดภัย 100%)
  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      
      {showEventModal && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black bg-opacity-60 transition-opacity backdrop-blur-sm">
          <div className="bg-[#1c1c1e] md:bg-white md:text-black text-white w-full md:max-w-md rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden animate-slide-up">
            <div className="flex justify-between items-center p-4 border-b border-gray-700 md:border-gray-200"><button onClick={() => setShowEventModal(false)} className="text-gray-400 hover:text-white md:hover:text-black font-bold px-2 text-lg">✕</button><span className="font-bold text-lg">{newEvent._id ? 'แก้ไขกิจกรรม' : 'กิจกรรมใหม่'}</span><button onClick={handleSaveEvent} className="text-white bg-red-500 px-4 py-1.5 rounded-full font-bold hover:bg-red-600 transition-colors">บันทึก</button></div>
            <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="bg-[#2c2c2e] md:bg-gray-50 rounded-xl overflow-hidden"><input type="text" placeholder="ชื่อกิจกรรม" className="w-full bg-transparent p-4 outline-none text-white md:text-black font-semibold border-b border-gray-700 md:border-gray-200" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} /><input type="text" placeholder="แนบลิงก์ (URL)" className="w-full bg-transparent p-4 outline-none text-white md:text-black text-sm" value={newEvent.url} onChange={e => setNewEvent({...newEvent, url: e.target.value})} /></div>
              <div className="bg-[#2c2c2e] md:bg-gray-50 rounded-xl p-4 space-y-4">
                <div className="flex justify-between items-center"><span className="font-medium">ทั้งวัน</span><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={newEvent.isAllDay} onChange={(e) => setNewEvent({...newEvent, isAllDay: e.target.checked})} /><div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:bg-green-500"></div></label></div>
                <div className="border-t border-gray-700 md:border-gray-200 pt-4 flex justify-between items-center"><span className="font-medium">วันที่</span><input type="date" className="bg-transparent text-gray-300 md:text-gray-700 outline-none" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} /></div>
                {!newEvent.isAllDay && (<div className="border-t border-gray-700 md:border-gray-200 pt-4 flex justify-between items-center gap-4"><div className="flex flex-col w-1/2"><span className="text-xs text-gray-400">เริ่ม</span><input type="time" className="bg-transparent text-white md:text-black outline-none" value={newEvent.startTime} onChange={e => setNewEvent({...newEvent, startTime: e.target.value})} /></div><div className="flex flex-col w-1/2"><span className="text-xs text-gray-400">สิ้นสุด</span><input type="time" className="bg-transparent text-white md:text-black outline-none" value={newEvent.endTime} onChange={e => setNewEvent({...newEvent, endTime: e.target.value})} /></div></div>)}
              </div>
              <div className="bg-[#2c2c2e] md:bg-gray-50 rounded-xl overflow-hidden"><textarea placeholder="เพิ่มโน้ต..." className="w-full bg-transparent p-4 outline-none text-white md:text-black text-sm resize-none min-h-[100px]" value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})}></textarea></div>
              {newEvent._id && (<div className="flex gap-2 mt-4"><button onClick={handleNotifyEventLINE} className="flex-1 bg-green-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">🔔 แจ้งเตือนลง LINE</button><button onClick={() => handleDeleteEvent(newEvent._id)} className="w-16 bg-red-900 bg-opacity-30 md:bg-red-50 text-red-500 rounded-xl flex items-center justify-center text-xl">🗑️</button></div>)}
            </div>
          </div>
        </div>
      )}

      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-80 transition-opacity backdrop-blur-sm">
          <div className="bg-white rounded-2xl overflow-hidden shadow-2xl w-full max-w-5xl flex flex-col md:flex-row max-h-[90vh]">
            <div className="flex-1 bg-gray-100 flex items-center justify-center relative min-h-[300px] group">
              {isImageFile(selectedFile) ? (
                <><img src={selectedFile.fileUrl} alt="full" className="max-w-full max-h-[50vh] md:max-h-[90vh] object-contain" /><button onClick={() => handleDownload(selectedFile.fileUrl, selectedFile.fileName || `image_${Date.now()}.jpg`)} className="absolute bottom-4 left-4 bg-gray-900 bg-opacity-70 hover:bg-opacity-100 text-white py-2 px-4 rounded-xl shadow-lg transition-all flex items-center gap-2">⬇️ บันทึกรูปภาพ</button></>
              ) : (
                <div className="text-center p-8"><span className="text-8xl mb-4 block">📄</span><button onClick={() => handleDownload(selectedFile.fileUrl, selectedFile.fileName || `file_${Date.now()}.pdf`)} className="inline-block bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-8 rounded-xl transition-colors shadow-sm">⬇️ ดาวน์โหลดไฟล์นี้</button></div>
              )}
              <button onClick={() => { setSelectedFile(null); setIsEditing(false); }} className="absolute top-4 right-4 bg-white text-gray-800 rounded-full w-12 h-12 flex items-center justify-center shadow-lg hover:bg-gray-200 font-black text-xl border-2 border-gray-100">✕</button>
            </div>
            <div className="w-full md:w-96 p-6 flex flex-col bg-white overflow-y-auto border-l border-gray-100">
              <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-gray-800">รายละเอียด <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">v{selectedFile.version}</span></h3>{!isEditing ? (<div className="flex gap-2"><button onClick={() => handleShareFile(selectedFile.fileUrl)} className="text-sm bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded-lg font-bold">🔗 แชร์</button><button onClick={() => setIsEditing(true)} className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg font-bold">✏️ แก้ไข</button></div>) : (<div className="flex gap-2"><button onClick={() => setIsEditing(false)} className="text-sm bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-bold">ยกเลิก</button><button onClick={saveFileDetails} className="text-sm bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg font-bold">💾 บันทึก</button></div>)}</div>
              <div className="mb-4">{isEditing ? <input type="text" className="w-full p-2 border border-gray-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-green-500 outline-none mb-1" value={editForm.fileName || ''} onChange={(e) => setEditForm({...editForm, fileName: e.target.value})} /> : <p className="text-sm font-bold text-gray-700 mb-1">{selectedFile.fileName || 'ไม่ได้ตั้งชื่อไฟล์'}</p>}<p className="text-xs text-gray-400">📅 {new Date(selectedFile.createdAt).toLocaleString('th-TH')}</p></div>
              <div className="mb-4"><p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">📁 ย้ายแฟ้ม</p>{isEditing ? (<select className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-500 outline-none" value={editForm.folderId || 'null'} onChange={(e) => setEditForm({...editForm, folderId: e.target.value === 'null' ? null : e.target.value})}><option value="null">🏠 หน้าแรกสุด</option>{folders.map(f => <option key={f._id} value={f._id}>📂 {f.name}</option>)}</select>) : (<div className="bg-gray-50 text-gray-600 text-sm px-3 py-2 rounded-lg border border-gray-200">{folders.find(f => f._id === selectedFile.folderId)?.name ? `📂 ${folders.find(f => f._id === selectedFile.folderId).name}` : '🏠 อยู่ในหน้าแรกสุด'}</div>)}</div>
              <div className="mb-4"><p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">🏷️ แท็ก</p>{isEditing ? <input type="text" className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" value={editForm.tags} onChange={(e) => setEditForm({...editForm, tags: e.target.value})} /> : <div className="flex flex-wrap gap-2">{selectedFile.tags?.map((t, i) => <span key={i} className="bg-indigo-50 text-indigo-600 text-xs px-2 py-1 rounded-md font-medium border border-indigo-100">{t}</span>)}</div>}</div>
              <div className="flex-1 flex flex-col"><p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">📝 โน้ต</p>{isEditing ? <textarea className="w-full flex-1 p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none resize-none min-h-[80px]" value={editForm.note} onChange={(e) => setEditForm({...editForm, note: e.target.value})}></textarea> : <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-sm text-gray-700 min-h-[80px] whitespace-pre-wrap overflow-y-auto">{selectedFile.note || "-"}</div>}</div>
              {!isEditing && selectedFile.versions && selectedFile.versions.length > 0 && (<div className="mb-4 border-t border-gray-200 pt-4"><p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">⏳ เวอร์ชันย้อนหลัง ({selectedFile.versions.length})</p><div className="space-y-2 max-h-[120px] overflow-y-auto">{selectedFile.versions.map((v, idx) => (<div key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg text-xs border border-gray-100"><span className="text-gray-600 font-medium">เวอร์ชัน v{v.versionNumber}</span><button onClick={() => handleDownload(v.fileUrl, `v${v.versionNumber}_${selectedFile.fileName}`)} className="text-indigo-600 font-bold hover:underline">⬇️ ดาวน์โหลด</button></div>))}</div></div>)}
              {isEditing && <button onClick={deleteFile} className="mt-4 text-sm bg-red-100 hover:bg-red-200 text-red-700 py-2 rounded-lg font-bold w-full border border-red-200">🗑️ ลบไฟล์นี้ถาวร</button>}
            </div>
          </div>
        </div>
      )}

      {/* Sidebar คอม */}
      <div className="w-64 bg-white border-r border-gray-200 shadow-sm flex flex-col hidden md:flex">
        <div className="p-6 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => { setShowCalendar(false); setSelectedTag('All'); setCurrentFolder(null); }}>
          <h2 className="text-2xl font-black text-green-600 tracking-tight">📁 Drive</h2>
        </div>
        <ul className="flex-1 px-4 space-y-2 overflow-y-auto">
          <li onClick={() => { setShowCalendar(false); setSelectedTag('All'); setCurrentFolder(null); }} className={`p-3 rounded-xl font-semibold cursor-pointer flex items-center gap-3 transition-colors ${!showCalendar && selectedTag === 'All' && !currentFolder ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-100'}`}>📥 หน้าแรก (Home)</li>
          <li onClick={() => setShowCalendar(true)} className={`p-3 rounded-xl font-semibold cursor-pointer flex items-center gap-3 transition-colors ${showCalendar ? 'bg-red-50 text-red-600' : 'text-gray-600 hover:bg-gray-100'}`}>📅 ปฏิทินทีม</li>
          <li onClick={() => { setShowCalendar(false); setSelectedTag('Logs'); setCurrentFolder(null); }} className={`p-3 rounded-xl font-semibold cursor-pointer flex items-center gap-3 transition-colors ${selectedTag === 'Logs' ? 'bg-amber-50 text-amber-700' : 'text-gray-600 hover:bg-gray-100'}`}>📜 บันทึกประวัติระบบ</li>
          <div className="my-4 border-t border-gray-200"></div>
          {allTags.map((tag, index) => <li key={index} onClick={() => { setShowCalendar(false); setSelectedTag(tag); setCurrentFolder(null); }} className={`p-3 rounded-xl font-medium cursor-pointer flex items-center gap-3 transition-colors ${!showCalendar && selectedTag === tag ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-100'}`}>🏷️ {tag}</li>)}
          {dbUser?.role === 'admin' && <><div className="my-4 border-t border-gray-200"></div><li onClick={() => { setShowCalendar(false); setSelectedTag('Admin'); setCurrentFolder(null); }} className={`p-3 rounded-xl font-bold cursor-pointer flex items-center gap-3 transition-colors ${selectedTag === 'Admin' ? 'bg-indigo-50 text-indigo-700' : 'text-indigo-500 hover:bg-indigo-50'}`}>⚙️ ศูนย์ควบคุม (Admin)</li></>}
        </ul>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 p-4 flex justify-between items-center shadow-sm z-10 gap-4">
          <h1 className="text-lg md:text-xl font-bold text-gray-800 ml-2 md:ml-0 flex items-center gap-2 truncate">
            {showCalendar ? '📅 ปฏิทินและตารางงาน' : selectedTag === 'Admin' ? '⚙️ ศูนย์ควบคุมระบบ (Admin Center)' : selectedTag === 'Logs' ? '📜 บันทึกประวัติการใช้งานระบบ (Audit Log)' : (
              <>{currentFolder && <><button onClick={() => setCurrentFolder(null)} className="text-gray-400 hover:text-green-600 transition-colors">🏠 หน้าแรก</button><span className="text-gray-300">/</span></>}<span className="text-green-700 truncate flex items-center gap-2">{currentFolder ? `📁 ${currentFolder.name}` : (selectedTag === 'All' ? '📥 หน้าแรก' : `🏷️ ${selectedTag}`)}{currentFolder && (<button onClick={() => {setIsEditingFolder(true); setEditFolderName(currentFolder.name);}} className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded-md ml-2 transition-colors">⚙️ จัดการ</button>)}</span></>
            )}
          </h1>
          {!showCalendar && selectedTag !== 'Admin' && selectedTag !== 'Logs' && <div className="flex-1 max-w-md hidden md:block"><input type="search" placeholder="🔍 ค้นหาไฟล์, แฟ้ม, โน้ต หรือแท็ก..." className="w-full bg-gray-100 border-none rounded-full px-5 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>}
          {profile && <div className="flex items-center gap-3 bg-gray-50 px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-gray-200 shrink-0"><span className="text-sm font-semibold text-gray-700 hidden sm:block">{profile.displayName}</span><img src={profile.pictureUrl} alt="profile" className="w-8 h-8 rounded-full border-2 border-green-500 shadow-sm" /></div>}
        </header>

        {/* เมนูมือถือ */}
        <div className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex flex-col gap-3 shadow-sm z-0">
           {!showCalendar && selectedTag !== 'Admin' && selectedTag !== 'Logs' && <input type="search" placeholder="🔍 ค้นหา..." className="w-full bg-gray-100 rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />}
          <div className="flex overflow-x-auto gap-2 pb-1">
            <button onClick={() => { setShowCalendar(false); setSelectedTag('All'); setCurrentFolder(null); }} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium border ${!showCalendar && selectedTag === 'All' && !currentFolder ? 'bg-green-500 text-white' : 'bg-gray-50 text-gray-600'}`}>🏠 หน้าแรก</button>
            <button onClick={() => setShowCalendar(true)} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium border ${showCalendar ? 'bg-red-500 text-white' : 'bg-gray-50 text-gray-600'}`}>📅 ปฏิทิน</button>
            <button onClick={() => { setShowCalendar(false); setSelectedTag('Logs'); setCurrentFolder(null); }} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium border ${selectedTag === 'Logs' ? 'bg-amber-500 text-white' : 'bg-gray-50 text-gray-600'}`}>📜 ประวัติ</button>
            {allTags.map((tag, i) => <button key={i} onClick={() => { setShowCalendar(false); setSelectedTag(tag); setCurrentFolder(null); }} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium border ${!showCalendar && selectedTag === tag ? 'bg-green-500 text-white' : 'bg-gray-50 text-gray-600'}`}>🏷️ {tag}</button>)}
            {dbUser?.role === 'admin' && <button onClick={() => { setShowCalendar(false); setSelectedTag('Admin'); setCurrentFolder(null); }} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-bold border ${selectedTag === 'Admin' ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>⚙️ แอดมิน</button>}
          </div>
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
          {selectedTag === 'Logs' ? (
            <div className="max-w-4xl mx-auto bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
              <div className="flex justify-between items-center mb-6"><h3 className="text-lg font-bold text-gray-800">📋 กิจกรรมล่าสุดในระบบ (สูงสุด 50 รายการ)</h3><button onClick={() => fetchAuditLogs(dbUser.lineId)} className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg font-bold">🔄 รีเฟรช</button></div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead><tr className="border-b border-gray-200 text-gray-400 font-medium bg-gray-50"><th className="p-3">⏰ เวลา</th><th className="p-3">👤 ผู้ทำรายการ</th><th className="p-3">🛠️ การกระทำ</th><th className="p-3">📝 รายละเอียด</th></tr></thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {auditLogs.map(log => (<tr key={log._id} className="hover:bg-gray-50 transition-colors"><td className="p-3 text-xs text-gray-400 whitespace-nowrap">{new Date(log.createdAt).toLocaleString('th-TH')}</td><td className="p-3 font-semibold text-gray-800">{log.performedBy}</td><td className="p-3"><span className={`px-2 py-0.5 rounded-md text-xs font-bold ${log.action.includes('VERSION') ? 'bg-purple-100 text-purple-700' : log.action.includes('DELETE') ? 'bg-red-100 text-red-700' : log.action.includes('BROADCAST') ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{log.action}</span></td><td className="p-3 font-medium">{log.details}</td></tr>))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : showCalendar ? (
            <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-6">
              <div className="flex-1 bg-white p-4 md:p-6 rounded-3xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-6 px-2"><h2 className="text-2xl font-bold text-gray-800">{currentMonth.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}</h2><div className="flex gap-4"><button onClick={handlePrevMonth} className="text-gray-400 hover:text-red-500 font-bold text-xl px-2">{"<"}</button><button onClick={handleNextMonth} className="text-gray-400 hover:text-red-500 font-bold text-xl px-2">{">"}</button></div></div>
                <div className="grid grid-cols-7 gap-1 text-center mb-2">{['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(day => <div key={day} className="text-xs font-bold text-gray-400">{day}</div>)}</div>
                <div className="grid grid-cols-7 gap-1">{renderCalendarDays()}</div>
              </div>
              <div className="w-full md:w-80 flex flex-col gap-4">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200 flex-1">
                  <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-gray-800">{selectedDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'long' })}</h3><button onClick={() => { setNewEvent({ _id: null, title: '', date: selectedDate.toLocaleDateString('en-CA'), isAllDay: true, startTime: '09:00', endTime: '10:00', url: '', description: '' }); setShowEventModal(true); }} className="w-8 h-8 rounded-full bg-red-100 text-red-500 flex items-center justify-center font-bold text-xl pb-1">+</button></div>
                  {eventsOnSelectedDate.length === 0 ? (<div className="text-center text-gray-400 py-10 flex flex-col items-center"><span className="text-4xl mb-2">🎈</span><p className="text-sm">ไม่มีกิจกรรม</p></div>) : (
                    <div className="space-y-3">{eventsOnSelectedDate.map(ev => (<div key={ev._id} onClick={() => openEditEventModal(ev)} className="p-3 rounded-xl border border-gray-100 bg-gray-50 flex items-start gap-3 group relative cursor-pointer hover:border-red-300 transition-colors"><div className={`w-1.5 h-10 rounded-full shrink-0 ${ev.isAllDay ? 'bg-purple-500' : 'bg-blue-500'}`}></div><div className="flex-1 min-w-0"><h4 className="font-bold text-gray-800 text-sm truncate">{ev.title}</h4><p className="text-xs text-gray-500 mt-1">{ev.isAllDay ? 'ทั้งวัน' : `${ev.startTime} - ${ev.endTime}`}{ev.url && <a href={ev.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="block text-blue-500 truncate mt-1 hover:underline">🔗 ลิงก์แนบ</a>}</p></div></div>))}</div>
                  )}
                </div>
              </div>
            </div>
          ) : selectedTag === 'Admin' ? (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">📢 กระจายข่าวสาร (Broadcast)</h2>
                <textarea rows="3" placeholder="พิมพ์ข้อความประกาศที่นี่..." className="w-full p-4 border border-gray-300 rounded-xl mb-4" value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)}></textarea>
                <button onClick={handleBroadcast} disabled={isBroadcasting} className={`w-full font-bold py-3 rounded-xl text-white ${isBroadcasting ? 'bg-gray-300' : 'bg-blue-600'}`}>{isBroadcasting ? '⏳ กำลังส่ง...' : '🚀 ส่งประกาศ Broadcast'}</button>
              </div>
              <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">⚙️ ตั้งค่าระบบผู้ช่วย AI</h2>
                <div className="mb-6 flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div><h3 className="font-semibold text-gray-700">เปิดใช้งาน AI สรุปเอกสาร</h3></div>
                  <label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={aiConfig?.aiEnabled || false} onChange={(e) => setAiConfig({...aiConfig, aiEnabled: e.target.checked})} /><div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-green-500"></div></label>
                </div>
                <textarea rows="4" className="w-full p-4 border border-gray-300 rounded-xl mb-4" value={aiConfig?.aiPrompt || ''} onChange={e => setAiConfig({...aiConfig, aiPrompt: e.target.value})} disabled={!aiConfig?.aiEnabled}></textarea>
                <input type="text" className="w-full p-4 border border-gray-300 rounded-xl mb-6 font-mono" value={aiConfig?.aiModel || ''} onChange={e => setAiConfig({...aiConfig, aiModel: e.target.value})} disabled={!aiConfig?.aiEnabled} />
                <button onClick={saveConfig} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl">💾 บันทึกการตั้งค่า AI</button>
              </div>
            </div>
          ) : (
            <>
              {/* หน้าหลัก Drive */}
              <div className="mb-8">
                {isEditingFolder && currentFolder && (
                   <div className="mb-6 p-4 bg-gray-100 rounded-xl border border-gray-200 max-w-lg">
                      <h4 className="font-bold mb-3 text-sm text-gray-700">⚙️ จัดการโฟลเดอร์ปัจจุบัน</h4>
                      <div className="flex gap-2 mb-3"><input type="text" value={editFolderName} onChange={e => setEditFolderName(e.target.value)} className="flex-1 p-2 rounded-lg border border-gray-300 text-sm outline-none" /><button onClick={handleRenameFolder} className="bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-sm">เปลี่ยนชื่อ</button><button onClick={() => setIsEditingFolder(false)} className="bg-white text-gray-600 border border-gray-300 px-4 py-2 rounded-lg font-bold text-sm">ยกเลิก</button></div>
                      <button onClick={handleDeleteFolder} className="text-red-500 text-sm font-bold hover:underline">🗑️ ลบโฟลเดอร์นี้</button>
                   </div>
                )}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                  <h3 className="text-sm font-bold text-gray-500">📁 โฟลเดอร์ ({displayedFolders.length})</h3>
                  {!searchQuery && (
                    <div className="flex gap-2">
                      <label className="text-xs bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg font-bold cursor-pointer">{isUploading ? '⏳ กำลังอัปโหลด...' : '☁️ อัปโหลดไฟล์'}<input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} /></label>
                      <button onClick={() => setShowNewFolderInput(!showNewFolderInput)} className="text-xs bg-green-100 text-green-700 px-4 py-2 rounded-lg font-bold">+ สร้างแฟ้มใหม่</button>
                    </div>
                  )}
                </div>
                {showNewFolderInput && !searchQuery && (
                  <div className="flex gap-2 mb-4 bg-white p-3 rounded-xl border border-green-200 shadow-sm max-w-md">
                    <input type="text" autoFocus value={newFolderName} onChange={(e)=>setNewFolderName(e.target.value)} placeholder="พิมพ์ชื่อแฟ้มใหม่..." className="flex-1 outline-none text-sm bg-transparent" /><button onClick={createNewFolder} className="bg-green-500 text-white px-4 py-1.5 rounded-lg text-sm font-bold">สร้าง</button><button onClick={() => setShowNewFolderInput(false)} className="bg-gray-100 text-gray-600 px-4 py-1.5 rounded-lg text-sm font-bold">ยกเลิก</button>
                  </div>
                )}
                {displayedFolders.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
                    {displayedFolders.map(folder => (<div key={folder._id} onClick={() => setCurrentFolder(folder)} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:border-green-400 flex items-center gap-3"><span className="text-2xl">📁</span><span className="font-bold text-gray-700 truncate text-sm">{folder.name}</span></div>))}
                  </div>
                )}
              </div>

              {/* หน้าไฟล์ */}
              <h3 className="text-sm font-bold text-gray-500 mb-4 border-t border-gray-200 pt-6">📄 ไฟล์เอกสารและรูปภาพ ({displayedFiles.length})</h3>
              {displayedFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400"><span className="text-6xl mb-4">📭</span><p>ไม่พบไฟล์</p></div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                  {displayedFiles.map((item) => (
                    <div key={item._id} onClick={() => { setSelectedFile(item); setEditForm({ tags: item.tags?.join(', ') || '', note: item.note || '', folderId: item.folderId || null, fileName: item.fileName || '' }); setIsEditing(false); }} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg cursor-pointer flex flex-col">
                      {isImageFile(item) ? (
                        <div className="h-32 md:h-40 bg-gray-100 relative"><img src={item.fileUrl} alt="upload" className="w-full h-full object-cover" /></div>
                      ) : (
                        <div className="h-32 md:h-40 bg-blue-50 flex flex-col items-center justify-center p-4"><span className="text-4xl mb-2">📄</span><p className="text-xs text-center font-medium text-gray-600 line-clamp-2">{item.fileName}</p></div>
                      )}
                      <div className="p-3 flex-1 flex flex-col justify-between border-t border-gray-50">
                        <div className="mb-2 flex flex-wrap gap-1">{item.tags?.map((t, i) => <span key={i} className="bg-gray-100 text-gray-500 text-[10px] px-2 py-1 rounded-md">{t}</span>)}</div>
                        <div className="flex justify-between items-center mt-1"><small className="text-gray-400 text-[10px]">📅 {new Date(item.createdAt).toLocaleDateString('th-TH')}</small>{item.version > 1 && <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-bold">v{item.version}</span>}</div>
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