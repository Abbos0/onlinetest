document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const ism = document.getElementById('ism').value;
    const familiya = document.getElementById('familiya').value;
    const telefon = document.getElementById('telefon').value;
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ism, familiya, telefon })
        });
        
        if (response.ok) {
            const user = await response.json();
            sessionStorage.setItem('currentUser', JSON.stringify(user));
            window.location.href = '/test.html';
        } else {
            alert('Ro\'yxatdan o\'tishda xatolik yuz berdi');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Xatolik yuz berdi');
    }
});
