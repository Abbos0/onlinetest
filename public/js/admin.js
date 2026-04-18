if (!sessionStorage.getItem('adminLoggedIn')) {
    window.location.href = '/admin-login.html';
}

const socket = io();
let activeUsers = [];
let selectedUser = null;
let peerConnections = {};

console.log('Admin panel yuklandi');

socket.emit('admin-join');

socket.on('active-users', (users) => {
    console.log('Foydalanuvchilar keldi:', users);
    activeUsers = users;
    renderUsersList();
});

socket.on('user-joined', (user) => {
    console.log('Yangi foydalanuvchi:', user);
    activeUsers.push(user);
    renderUsersList();
});

socket.on('user-left', (user) => {
    console.log('Foydalanuvchi chiqdi:', user);
    activeUsers = activeUsers.filter(u => u.socketId !== user.socketId);
    if (selectedUser && selectedUser.socketId === user.socketId) {
        selectedUser = null;
        document.getElementById('remoteVideo').srcObject = null;
    }
    renderUsersList();
});

// Test natijalarini real-time qabul qilish
socket.on('user-test-completed', (data) => {
    console.log('Test natijasi keldi:', data);
    addTestResult(data);
});

socket.on('video-answer', async (data) => {
    console.log('Video answer keldi:', data);
    const pc = peerConnections[data.sender];
    if (pc) {
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            console.log('Remote description o\'rnatildi');
        } catch (err) {
            console.error('Answer qabul qilishda xatolik:', err);
        }
    }
});

socket.on('ice-candidate', async (data) => {
    console.log('ICE candidate keldi:', data);
    const pc = peerConnections[data.sender];
    if (pc) {
        try {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
            console.error('ICE candidate qo\'shishda xatolik:', err);
        }
    }
});

function createPeerConnection(socketId) {
    console.log('Admin: Peer connection yaratilmoqda...', socketId);
    
    if (peerConnections[socketId]) {
        peerConnections[socketId].close();
    }
    
    const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    
    pc.ontrack = (event) => {
        console.log('Admin: Track keldi!', event.streams);
        const video = document.getElementById('remoteVideo');
        if (video.srcObject !== event.streams[0]) {
            video.srcObject = event.streams[0];
            console.log('Admin: Video o\'rnatildi');
        }
    };
    
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            console.log('Admin: ICE candidate yuborilmoqda');
            socket.emit('ice-candidate', { target: socketId, candidate: event.candidate });
        }
    };
    
    pc.onconnectionstatechange = () => {
        console.log('Admin: Connection state:', pc.connectionState);
    };
    
    pc.oniceconnectionstatechange = () => {
        console.log('Admin: ICE connection state:', pc.iceConnectionState);
    };
    
    peerConnections[socketId] = pc;
    return pc;
}

async function connectToUser(socketId) {
    console.log('Foydalanuvchiga ulanish:', socketId);
    selectedUser = activeUsers.find(u => u.socketId === socketId);
    
    if (!selectedUser) {
        console.log('Foydalanuvchi topilmadi');
        return;
    }
    
    renderUsersList();
    
    let resultHtml = '';
    console.log('Foydalanuvchi ma\'lumotlari:', selectedUser);
    console.log('Foydalanuvchi ID:', selectedUser.id);
    
    try {
        const response = await fetch(`/api/results/${selectedUser.id}`);
        const result = await response.json();
        console.log('Test natijasi:', result);
        
        if (result && result.score !== undefined) {
            resultHtml = `
                <p><strong>Test natijasi:</strong> ${result.score} / ${result.total}</p>
                <p><strong>Test vaqti:</strong> ${new Date(result.completed_at).toLocaleString('uz-UZ')}</p>
            `;
        } else {
            resultHtml = `<p><strong>Test natijasi:</strong> Hali test topshirilmagan</p>`;
        }
    } catch (err) {
        console.error('Natijani yuklashda xatolik:', err);
        resultHtml = `<p><strong>Test natijasi:</strong> Ma'lumot olinmadi</p>`;
    }
    
    document.getElementById('selectedUserInfo').innerHTML = `
        <h4>Tanlangan foydalanuvchi:</h4>
        <p><strong>Ism:</strong> ${selectedUser.ism}</p>
        <p><strong>Familiya:</strong> ${selectedUser.familiya}</p>
        <p><strong>Telefon:</strong> ${selectedUser.telefon}</p>
        ${resultHtml}
        <button onclick="refreshResult('${selectedUser.id}')" class="btn-secondary" style="margin-top:10px;padding:8px 16px;font-size:14px;">Natijani yangilash</button>
    `;
    
    console.log('Admin: request-video yuborilmoqda');
    socket.emit('request-video', { target: socketId });
    
    console.log('Admin: 2 soniya kutish...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('Admin: Peer connection yaratish va offer yuborish');
    const pc = createPeerConnection(socketId);
    
    try {
        const offer = await pc.createOffer({ offerToReceiveVideo: true });
        await pc.setLocalDescription(offer);
        console.log('Admin: Offer yuborilmoqda:', offer);
        socket.emit('video-offer', { target: socketId, sdp: offer });
    } catch (err) {
        console.error('Admin: Offer yaratishda xatolik:', err);
    }
}

function renderUsersList() {
    const container = document.getElementById('usersList');
    
    if (activeUsers.length === 0) {
        container.innerHTML = '<p>Hozircha foydalanuvchilar yo\'q</p>';
        return;
    }
    
    container.innerHTML = activeUsers.map(user => `
        <div class="user-card ${selectedUser?.socketId === user.socketId ? 'active' : ''}" 
             onclick="connectToUser('${user.socketId}')">
            <h4>${user.ism} ${user.familiya}</h4>
            <p>${user.telefon}</p>
        </div>
    `).join('');
}

async function refreshResult(userId) {
    console.log('Natijani yangilash:', userId);
    try {
        const response = await fetch(`/api/results/${userId}`);
        const result = await response.json();
        console.log('Yangi natija:', result);
        
        const infoDiv = document.getElementById('selectedUserInfo');
        const currentHtml = infoDiv.innerHTML;
        
        let resultHtml = '';
        if (result && result.score !== undefined) {
            resultHtml = `
                <p><strong>Test natijasi:</strong> ${result.score} / ${result.total}</p>
                <p><strong>Test vaqti:</strong> ${new Date(result.completed_at).toLocaleString('uz-UZ')}</p>
            `;
        } else {
            resultHtml = `<p><strong>Test natijasi:</strong> Hali test topshirilmagan</p>`;
        }
        
        infoDiv.innerHTML = currentHtml.replace(
            /<p><strong>Test natijasi:<\/strong>.*<\/p>/,
            resultHtml
        );
    } catch (err) {
        console.error('Natijani yangilashda xatolik:', err);
    }
}

async function loadAllUsers() {
    try {
        const response = await fetch('/api/users');
        const users = await response.json();
        console.log('Barcha foydalanuvchilar:', users);
    } catch (error) {
        console.error('Foydalanuvchilarni yuklashda xatolik:', error);
    }
}

loadAllUsers();

// Tab funksiyalari
function showTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(tabName + '-tab').classList.add('active');
    
    if (tabName === 'questions') {
        loadQuestions();
    } else if (tabName === 'results') {
        renderTestResults();
    }
}

// Word fayl yuklash
document.getElementById('uploadForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const fileInput = document.getElementById('wordFile');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Fayl tanlang');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    const resultDiv = document.getElementById('uploadResult');
    resultDiv.innerHTML = '<p>Yuklanmoqda...</p>';
    
    try {
        const response = await fetch('/api/upload-questions', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            resultDiv.innerHTML = `<p style="color: green;">${data.added} ta savol qo'shildi!</p>`;
            fileInput.value = '';
            loadQuestions();
        } else {
            resultDiv.innerHTML = `<p style="color: red;">Xatolik: ${data.error}</p>`;
        }
    } catch (err) {
        resultDiv.innerHTML = `<p style="color: red;">Xatolik: ${err.message}</p>`;
    }
});

// Savollarni yuklash
async function loadQuestions() {
    try {
        const response = await fetch('/api/questions');
        const questions = await response.json();
        
        const container = document.getElementById('questionsList');
        
        if (questions.length === 0) {
            container.innerHTML = '<p>Savollar yo\'q</p>';
            return;
        }
        
        container.innerHTML = questions.map((q, i) => `
            <div class="question-card">
                <h4>${i + 1}. ${q.savol}</h4>
                <p>A) ${q.javob_a} ${q.togri_javob === 'A' ? '✅' : ''}</p>
                <p>B) ${q.javob_b} ${q.togri_javob === 'B' ? '✅' : ''}</p>
                <p>C) ${q.javob_c} ${q.togri_javob === 'C' ? '✅' : ''}</p>
                <p>D) ${q.javob_d} ${q.togri_javob === 'D' ? '✅' : ''}</p>
                <button onclick="deleteQuestion(${q.id})" class="btn-danger">O'chirish</button>
            </div>
        `).join('');
    } catch (err) {
        console.error('Savollarni yuklashda xatolik:', err);
    }
}

// Savolni o'chirish
async function deleteQuestion(id) {
    if (!confirm('Bu savolni o\'chirishni xohlaysizmi?')) return;
    
    try {
        const response = await fetch(`/api/questions/${id}`, { method: 'DELETE' });
        const data = await response.json();
        
        if (data.success) {
            loadQuestions();
        }
    } catch (err) {
        console.error('Savolni o\'chirishda xatolik:', err);
    }
}

// Test natijalarini saqlash
let testResults = [];

// Yangi test natijasini qo'shish
function addTestResult(data) {
    testResults.unshift(data); // Eng yangisini boshiga qo'shish
    renderTestResults();
    
    // Agar natijalar tabi ochiq bo'lmasa, tab tugmasini qizil qilish
    const resultsTabBtn = document.querySelector('button[onclick="showTab(\'results\')"]');
    if (resultsTabBtn && !resultsTabBtn.classList.contains('active')) {
        resultsTabBtn.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)';
        resultsTabBtn.style.color = 'white';
        
        // 3 soniyadan keyin asl rangga qaytish
        setTimeout(() => {
            resultsTabBtn.style.background = '';
            resultsTabBtn.style.color = '';
        }, 3000);
    }
}

// Natijalarni ko'rsatish
function renderTestResults() {
    const container = document.getElementById('resultsList');
    
    if (testResults.length === 0) {
        container.innerHTML = '<p class="no-results">Hali natijalar yo\'q...</p>';
        return;
    }
    
    container.innerHTML = testResults.map((result, index) => {
        const isNew = index === 0; // Eng yangi natija
        const time = new Date(result.completedAt).toLocaleString('uz-UZ', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        return `
            <div class="result-card ${isNew ? 'new' : ''}">
                <h4>${result.ism} ${result.familiya}</h4>
                <p>📱 ${result.telefon}</p>
                <div class="score">${result.score} / ${result.total}</div>
                <p class="time">🕐 ${time}</p>
            </div>
        `;
    }).join('');
}

// Test vaqtini saqlash
async function saveTestDuration() {
    const duration = parseInt(document.getElementById('testDuration').value);
    
    if (!duration || duration < 1) {
        document.getElementById('durationSaveResult').textContent = '❌ Kamida 1 daqiqa!';
        document.getElementById('durationSaveResult').style.color = 'red';
        return;
    }
    
    try {
        const response = await fetch('/api/test-duration', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ duration: duration })
        });
        
        if (response.ok) {
            document.getElementById('durationSaveResult').textContent = '✅ Saqlandi!';
            document.getElementById('durationSaveResult').style.color = 'green';
            setTimeout(() => {
                document.getElementById('durationSaveResult').textContent = '';
            }, 3000);
        } else {
            const error = await response.json();
            document.getElementById('durationSaveResult').textContent = '❌ ' + (error.error || 'Xatolik');
            document.getElementById('durationSaveResult').style.color = 'red';
        }
    } catch (error) {
        document.getElementById('durationSaveResult').textContent = '❌ Xatolik yuz berdi';
        document.getElementById('durationSaveResult').style.color = 'red';
    }
}

// Test vaqtini yuklash
async function loadTestDuration() {
    try {
        const response = await fetch('/api/test-duration');
        const data = await response.json();
        document.getElementById('testDuration').value = data.duration;
    } catch (error) {
        console.error('Vaqt yuklashda xatolik:', error);
    }
}

// Sahifa yuklanganda vaqtni yuklash
window.addEventListener('load', loadTestDuration);
