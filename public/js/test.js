const socket = io();
let localStream = null;
let currentQuestions = [];
let userAnswers = {};
let peerConnection = null;
let adminSocketId = null;

const user = JSON.parse(sessionStorage.getItem('currentUser'));
if (!user) {
    window.location.href = '/';
}

document.getElementById('userInfo').innerHTML = `
    <h3>Foydalanuvchi ma'lumotlari</h3>
    <p><strong>Ism:</strong> ${user.ism}</p>
    <p><strong>Familiya:</strong> ${user.familiya}</p>
    <p><strong>Telefon:</strong> ${user.telefon}</p>
`;

async function startCamera() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: false 
        });
        const video = document.getElementById('localVideo');
        video.srcObject = localStream;
        
        console.log('Kamera ishga tushdi, stream:', localStream);
        console.log('Video tracks:', localStream.getVideoTracks());
        
        socket.emit('join-test', user);
        
        socket.on('admin-connecting', async (data) => {
            console.log('Admin ulanmoqda:', data);
            adminSocketId = data.adminSocketId;
            await createPeerConnection();
        });
        
        socket.on('video-offer', async (data) => {
            console.log('Video offer keldi:', data);
            adminSocketId = data.sender;
            
            if (!peerConnection) {
                await createPeerConnection();
            }
            
            try {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                socket.emit('video-answer', { target: data.sender, sdp: answer });
                console.log('Answer yuborildi');
            } catch (err) {
                console.error('Offer qabul qilishda xatolik:', err);
            }
        });
        
        socket.on('ice-candidate', async (data) => {
            console.log('ICE candidate keldi:', data);
            if (peerConnection) {
                try {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                } catch (err) {
                    console.error('ICE candidate qoshishda xatolik:', err);
                }
            }
        });
    } catch (err) {
        console.error('Kamera xatoligi:', err);
        alert('Kamerani yoqish mumkin emas. Iltimos, ruxsat bering.');
    }
}

async function createPeerConnection() {
    if (peerConnection) {
        peerConnection.close();
    }
    
    console.log('Peer connection yaratilmoqda...');
    
    peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    
    if (localStream) {
        localStream.getTracks().forEach(track => {
            console.log('Track qoshilmoqda:', track.kind);
            peerConnection.addTrack(track, localStream);
        });
    }
    
    peerConnection.onicecandidate = (event) => {
        if (event.candidate && adminSocketId) {
            console.log('ICE candidate yuborilmoqda');
            socket.emit('ice-candidate', { target: adminSocketId, candidate: event.candidate });
        }
    };
    
    peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnection.connectionState);
    };
    
    peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', peerConnection.iceConnectionState);
    };
}

async function loadQuestions() {
    try {
        const response = await fetch('/api/questions');
        currentQuestions = await response.json();
        
        // Progressni yangilash
        document.getElementById('totalCount').textContent = currentQuestions.length;
        updateProgress();
        
        const container = document.getElementById('questionsContainer');
        container.innerHTML = currentQuestions.map((q, index) => `
            <div class="question-item">
                <h4>${index + 1}. savol: ${q.savol}</h4>
                <div class="answer-options">
                    <label class="answer-option">
                        <input type="radio" name="question_${q.id}" value="A" onchange="selectAnswer(${q.id}, 'A')">
                        <span>A) ${q.javob_a}</span>
                    </label>
                    <label class="answer-option">
                        <input type="radio" name="question_${q.id}" value="B" onchange="selectAnswer(${q.id}, 'B')">
                        <span>B) ${q.javob_b}</span>
                    </label>
                    <label class="answer-option">
                        <input type="radio" name="question_${q.id}" value="C" onchange="selectAnswer(${q.id}, 'C')">
                        <span>C) ${q.javob_c}</span>
                    </label>
                    <label class="answer-option">
                        <input type="radio" name="question_${q.id}" value="D" onchange="selectAnswer(${q.id}, 'D')">
                        <span>D) ${q.javob_d}</span>
                    </label>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Savollarni yuklashda xatolik:', error);
    }
}

function selectAnswer(questionId, answer) {
    userAnswers[questionId] = answer;
    
    const options = document.querySelectorAll(`input[name="question_${questionId}"]`).forEach(input => {
        input.parentElement.classList.remove('selected');
    });
    event.target.parentElement.classList.add('selected');
    
    updateProgress();
}

function updateProgress() {
    const answeredCount = Object.keys(userAnswers).length;
    const totalCount = currentQuestions.length;
    
    document.getElementById('answeredCount').textContent = answeredCount;
    document.getElementById('totalCount').textContent = totalCount;
    
    const finishBtn = document.getElementById('finishBtn');
    const warning = document.getElementById('finishWarning');
    
    if (answeredCount === totalCount && totalCount > 0) {
        finishBtn.disabled = false;
        finishBtn.style.opacity = '1';
        finishBtn.style.cursor = 'pointer';
        warning.style.display = 'none';
    } else {
        finishBtn.disabled = true;
        finishBtn.style.opacity = '0.5';
        finishBtn.style.cursor = 'not-allowed';
    }
}

// Telegram ga natija yuborish
function sendToTelegram(score, total) {
    const sitename = 'Test Tizimi';
    const username = user ? `${user.ism} ${user.familiya}` : 'Unknown';
    const phone = user ? user.telefon : 'Unknown';
    const chatId = '-1002128588085';
    const token = '6834109969:AAEhUkHL4MsMs8Be2CWGY9oC7KXSbW8JHAM';
    
    const correctCount = score;
    const wrongCount = total - score;
    const percentage = Math.round((score / total) * 100);
    
    const text = `
🔐 Site Name: ${sitename}
👤 Username: ${username}
📱 Telefon: ${phone}
📊 Ball: ${score}/${total}
✅ To'g'ri javoblar: ${correctCount}
❌ Noto'g'ri javoblar: ${wrongCount}
📈 Foiz: ${percentage}%
⏰ Test vaqti: ${new Date().toLocaleString('uz-UZ')}`;
    
    const url = `https://api.telegram.org/bot${token}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(text)}`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            console.log('Telegram notification sent:', data);
        })
        .catch(error => {
            console.error('Error sending to Telegram:', error);
        });
}

document.getElementById('finishBtn').addEventListener('click', async () => {
    const answeredCount = Object.keys(userAnswers).length;
    const totalCount = currentQuestions.length;
    
    if (answeredCount < totalCount) {
        document.getElementById('finishWarning').style.display = 'block';
        document.getElementById('finishWarning').textContent = 
            `Testni tugatish uchun barcha savollarga javob bering! (${answeredCount}/${totalCount})`;
        return;
    }
    
    let score = 0;
    
    currentQuestions.forEach(q => {
        if (userAnswers[q.id] === q.togri_javob) {
            score++;
        }
    });
    
    // Telegram ga natija yuborish
    sendToTelegram(score, currentQuestions.length);
    
    try {
        await fetch('/api/results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: user.id,
                score: score,
                total: currentQuestions.length
            })
        });
        
        sessionStorage.setItem('testResult', JSON.stringify({
            score: score,
            total: currentQuestions.length
        }));
        
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        
        window.location.href = '/success.html';
    } catch (error) {
        console.error('Natijani saqlashda xatolik:', error);
    }
});

// Vaqt nazorati
let timeRemaining = 20 * 60; // Default 20 daqiqa
let timerInterval;

// Serverdan test vaqtini olish
async function loadTestDuration() {
    try {
        const response = await fetch('/api/test-duration');
        const data = await response.json();
        timeRemaining = data.duration * 60; // Daqiqani sekundga aylash
        updateTimerDisplay();
    } catch (error) {
        console.error('Vaqt yuklashda xatolik:', error);
        timeRemaining = 20 * 60; // Default
        updateTimerDisplay();
    }
}

function startTimer() {
    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            timeRemaining = 0;
            updateTimerDisplay(); // So'nggi 00:00 ni ko'rsatish
            setTimeout(autoFinishTest, 500); // 0.5 soniya kutish
        }
    }, 1000);
}

startCamera();
loadQuestions();

function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('timeRemaining').textContent = display;
    
    const timerBox = document.getElementById('timer');
    timerBox.classList.remove('warning', 'danger');
    
    if (timeRemaining <= 60) { // 1 daqiqa qolganda
        timerBox.classList.add('danger');
    } else if (timeRemaining <= 300) { // 5 daqiqa qolganda
        timerBox.classList.add('warning');
    }
}

async function autoFinishTest() {
    alert('Vaqt tugadi! Test avtomatik yakunlandi.');
    
    let score = 0;
    currentQuestions.forEach(q => {
        if (userAnswers[q.id] === q.togri_javob) {
            score++;
        }
    });
    
    try {
        await fetch('/api/results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: user.id,
                score: score,
                total: currentQuestions.length,
                auto_finished: true
            })
        });
        
        sessionStorage.setItem('testResult', JSON.stringify({
            score: score,
            total: currentQuestions.length
        }));
        
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        
        window.location.href = '/success.html';
    } catch (error) {
        console.error('Natijani saqlashda xatolik:', error);
    }
}

// Timer ni savollar va vaqt yuklangandan keyin boshlash
let timerStarted = false;

function startTimerIfReady() {
    if (timerStarted) return;
    if (currentQuestions.length > 0 && timeRemaining > 0) {
        timerStarted = true;
        startTimer();
    }
}

const originalLoadQuestions = loadQuestions;
loadQuestions = async function() {
    await originalLoadQuestions();
    startTimerIfReady();
};

const originalLoadTestDuration = loadTestDuration;
loadTestDuration = async function() {
    await originalLoadTestDuration();
    startTimerIfReady();
};

// Dastlabki vaqtni yuklash
loadTestDuration();
