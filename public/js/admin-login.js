document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const login = document.getElementById('login').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, password })
        });
        
        if (response.ok) {
            const data = await response.json();
            sessionStorage.setItem('adminLoggedIn', 'true');
            window.location.href = '/admin.html';
        } else {
            const error = await response.json();
            alert(error.error || 'Login yoki parol xato');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Xatolik yuz berdi');
    }
});
