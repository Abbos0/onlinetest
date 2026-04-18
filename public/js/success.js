const result = JSON.parse(sessionStorage.getItem('testResult'));
const user = JSON.parse(sessionStorage.getItem('currentUser'));

// Socket.io orqali admin ga natijani jo'natish (foydalanuvchi ko'rmaydi)
const socket = io();
socket.on('connect', () => {
    console.log('Success sahifasi: Socket ulandi');
    
    if (result && user) {
        // Admin ga natijani jo'natish
        socket.emit('test-completed', {
            userId: user.id,
            ism: user.ism,
            familiya: user.familiya,
            telefon: user.telefon,
            score: result.score,
            total: result.total,
            completedAt: new Date().toISOString()
        });
        console.log('Admin ga natija jo\'natildi:', result);
    }
});

// Foydalanuvchiga natija ko'rsatilmaydi (faqat admin biladi)
// Ma'lumotlarni tozalash
sessionStorage.removeItem('testResult');
sessionStorage.removeItem('currentUser');
