// Telefon input formatlash
document.getElementById('telefon').addEventListener('input', function(e) {
    // Faqat raqamlarni qoldirish (bo'sh joylar va + - ni ham olib tashlash)
    let value = e.target.value.replace(/\D/g, '');
    
    // Agar foydalanuvchi 998 ni ham kiritgan bo'lsa (masalan +998), olib tashlash
    if (value.startsWith('998')) {
        value = value.substring(3);
    }
    
    // Maksimum 9 ta raqam
    value = value.substring(0, 9);
    
    // Format: XX XXX XX XX (bo'sh joylar bilan)
    let formatted = '';
    if (value.length >= 2) {
        formatted = value.substring(0, 2);
    } else {
        formatted = value;
    }
    
    if (value.length > 2) {
        formatted += ' ' + value.substring(2, 5);
    }
    if (value.length > 5) {
        formatted += ' ' + value.substring(5, 7);
    }
    if (value.length > 7) {
        formatted += ' ' + value.substring(7, 9);
    }
    
    e.target.value = formatted;
});

// Ism va Familiya faqat harflar
function onlyLetters(input) {
    input.addEventListener('input', function(e) {
        // Faqat harflar va bo'sh joy (lotin va kirill)
        let value = e.target.value.replace(/[^a-zA-Zа-яА-ЯёЁўЎқҚғҒҳҲъЪэЭюЮяЯиИёЁьЬ /\s]/g, '');
        e.target.value = value;
    });
}

onlyLetters(document.getElementById('ism'));
onlyLetters(document.getElementById('familiya'));

function showError(inputId, errorId, message) {
    document.getElementById(inputId).classList.add('error');
    document.getElementById(errorId).textContent = message;
}

function clearErrors() {
    document.querySelectorAll('.error-msg').forEach(el => el.textContent = '');
    document.querySelectorAll('input.error').forEach(el => el.classList.remove('error'));
}

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Xatoliklarni tozalash
    clearErrors();
    
    const ism = document.getElementById('ism').value.trim();
    const familiya = document.getElementById('familiya').value.trim();
    const telefonInput = document.getElementById('telefon').value;
    
    let hasError = false;
    
    // Validatsiya
    if (ism.length < 3) {
        showError('ism', 'ismError', 'Ism kamida  5 ta harfdan iborat bo\'lishi kerak!');
        hasError = true;
    }
    
    if (familiya.length < 5) {
        showError('familiya', 'familiyaError', 'Familiya kamida 8 ta harfdan iborat bo\'lishi kerak!');
        hasError = true;
    }
    
    const telefonRaqamlar = telefonInput.replace(/\s/g, '');
    if (telefonRaqamlar.length !== 9) {
        showError('telefon', 'telefonError', 'Telefon raqami to\'liq kiritilishi kerak (9 ta raqam)!');
        hasError = true;
    }
    
    if (hasError) return;
    
    // +998 qo'shish
    const telefon = '+998' + telefonRaqamlar;
    
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
