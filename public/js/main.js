// Проверка статуса авторизации
async function checkAuth() {
    try {
        const response = await fetch('/api/me');
        if (response.ok) {
            const user = await response.json();
            sessionStorage.setItem('userRole', user.role);
            sessionStorage.setItem('username', user.username);
            updateUIBasedOnAuth(user);
            return user;
        } else {
            sessionStorage.removeItem('userRole');
            sessionStorage.removeItem('username');
            updateUIBasedOnAuth(null);
            return null;
        }
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
        updateUIBasedOnAuth(null);
        return null;
    }
}

// Обновление UI в зависимости от статуса авторизации
function updateUIBasedOnAuth(user) {
    const authButtons = document.querySelector('.auth-buttons');
    if (!authButtons) return;
    
    if (user) {
        let adminLink = '';
        if (user.role === 'admin') {
            adminLink = `<a href="/admin.html" style="background:#e74c3c;">👑 Админ-панель</a>`;
        }
        
        const displayName = user.full_name || user.username;
        
        authButtons.innerHTML = `
            <span>👤 ${displayName} ${user.role === 'admin' ? '(Admin)' : ''}</span>
            ${adminLink}
            <a href="/profile.html">Профиль</a>
            <button onclick="logout()" class="btn-logout">Выйти</button>
        `;
    } else {
        authButtons.innerHTML = `
            <a href="/login.html">Вход</a>
            <a href="/register.html">Регистрация</a>
        `;
    }
}

// Выход из аккаунта
async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        sessionStorage.removeItem('userRole');
        sessionStorage.removeItem('username');
        window.location.href = '/';
    } catch (error) {
        console.error('Ошибка выхода:', error);
    }
}

// Форматирование чисел
function formatNumber(num) {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + ' млн';
    if (num >= 1000) return (num / 1000).toFixed(1) + ' тыс';
    return num.toString();
}

// Проверка прав администратора
function isAdmin() {
    return sessionStorage.getItem('userRole') === 'admin';
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});