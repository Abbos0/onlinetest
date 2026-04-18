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

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const ism = document.getElementById('ism').value;
    const familiya = document.getElementById('familiya').value;
    const telefonInput = document.getElementById('telefon').value;
    
    // +998 qo'shish va bo'sh joylarni olib tashlash
    const telefon = '+998' + telefonInput.replace(/\s/g, '');
    
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
