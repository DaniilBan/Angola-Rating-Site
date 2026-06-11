const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const multer = require('multer');
const fs = require('fs');

// Создаем папку для загрузки аватаров
const uploadDir = path.join(__dirname, 'public/uploads/avatars');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Настройка multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'avatar-' + req.params.id + '-' + uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
        cb(null, true);
    } else {
        cb(new Error('Только изображения!'));
    }
};

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: fileFilter
});

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 1000 * 60 * 60 * 24 // 24 часа
    }
}));

// Подключение к MySQL
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'angola_db'
});

db.connect((err) => {
    if (err) {
        console.error('❌ Ошибка подключения к MySQL:', err);
        return;
    }
    console.log('✅ Подключено к MySQL');
});

// Middleware для проверки авторизации
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Необходима авторизация' });
    }
    next();
};

// ==================== АВТОРИЗАЦИЯ ====================

// Регистрация с выбором роли
app.post('/api/register', async (req, res) => {
    const { username, email, password, role, adminCode } = req.body;
    
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Все поля обязательны' });
    }
    
    // Определяем реальную роль
    let userRole = 'user';
    
    if (role === 'admin') {
        if (adminCode !== '1488228') {
            return res.status(403).json({ error: 'Неверный код администратора!' });
        }
        userRole = 'admin';
    }
    
    try {
        const hash = await bcrypt.hash(password, 10);
        db.query('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
            [username, email, hash, userRole],
            (err, result) => {
                if (err) {
                    if (err.code === 'ER_DUP_ENTRY') {
                        return res.status(400).json({ error: 'Пользователь с таким именем или email уже существует' });
                    }
                    return res.status(500).json({ error: 'Ошибка сервера' });
                }
                res.json({ message: 'Регистрация успешна', userId: result.insertId, role: userRole });
            });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Вход с получением роли
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    db.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
        if (err || results.length === 0) {
            return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
        }
        
        const match = await bcrypt.compare(password, results[0].password_hash);
        if (match) {
            req.session.userId = results[0].id;
            req.session.username = results[0].username;
            req.session.role = results[0].role;
            res.json({ 
                message: 'Вход выполнен успешно', 
                user: { 
                    id: results[0].id, 
                    username: results[0].username,
                    email: results[0].email,
                    role: results[0].role
                } 
            });
        } else {
            res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
        }
    });
});

// Получение данных текущего пользователя (с ролью)
app.get('/api/me', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Не авторизован' });
    }
    
    db.query('SELECT id, username, email, role, created_at FROM users WHERE id = ?', 
        [req.session.userId], 
        (err, results) => {
            if (err || results.length === 0) {
                return res.status(401).json({ error: 'Пользователь не найден' });
            }
            res.json(results[0]);
        });
});

// Выход
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Ошибка при выходе' });
        }
        res.json({ message: 'Выход выполнен успешно' });
    });
});

// ==================== ДАННЫЕ О ПРОВИНЦИЯХ ====================

// Получение всех провинций
app.get('/api/provinces', (req, res) => {
    db.query('SELECT * FROM provinces ORDER BY name', (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// Получение провинции по ID
app.get('/api/provinces/:id', (req, res) => {
    db.query('SELECT * FROM provinces WHERE id = ?', [req.params.id], (err, results) => {
        if (err || results.length === 0) {
            return res.status(404).json({ error: 'Провинция не найдена' });
        }
        res.json(results[0]);
    });
});

// ==================== РЕЙТИНГ ПО ПРАВИЛУ КОУПЛЕНДА ====================

app.get('/api/rating/copeland', (req, res) => {
    db.query('SELECT * FROM provinces', (err, provinces) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        const n = provinces.length;
        const matrix = Array(n).fill().map(() => Array(n).fill(0));
        const copelandScores = Array(n).fill(0);
        
        // Критерии для сравнения
        const criteria = [
            { key: 'gdp_2022', type: 'max' },
            { key: 'investment_tax', type: 'min' },
            { key: 'infrastructure_score', type: 'max' },
            { key: 'education_score', type: 'max' },
            { key: 'health_score', type: 'max' },
            { key: 'population', type: 'max' }
        ];

        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                let scoreI = 0, scoreJ = 0;
                
                for (const criterion of criteria) {
                    const valI = provinces[i][criterion.key];
                    const valJ = provinces[j][criterion.key];
                    
                    if (criterion.type === 'max') {
                        if (valI > valJ) scoreI++;
                        else if (valI < valJ) scoreJ++;
                    } else if (criterion.type === 'min') {
                        if (valI < valJ) scoreI++;
                        else if (valI > valJ) scoreJ++;
                    }
                }
                
                if (scoreI > scoreJ) {
                    matrix[i][j] = 1;
                    matrix[j][i] = -1;
                    copelandScores[i]++;
                    copelandScores[j]--;
                } else if (scoreI < scoreJ) {
                    matrix[i][j] = -1;
                    matrix[j][i] = 1;
                    copelandScores[i]--;
                    copelandScores[j]++;
                }
            }
        }

        const rating = provinces.map((p, idx) => ({
            ...p,
            copeland_score: copelandScores[idx],
            rank: 0
        })).sort((a, b) => b.copeland_score - a.copeland_score);
        
        // Добавляем место в рейтинге
        rating.forEach((item, idx) => {
            item.rank = idx + 1;
        });

        res.json({ 
            rating, 
            matrix, 
            provinces: provinces.map(p => p.name),
            criteria: criteria.map(c => c.key)
        });
    });
});

// ==================== ЭКОНОМИЧЕСКАЯ СТАТИСТИКА ====================

app.get('/api/economy/gdp-trend', (req, res) => {
    db.query(`
        SELECT name, 
               gdp_2017, gdp_2018, gdp_2019, gdp_2020, gdp_2021, gdp_2022,
               ROUND(((gdp_2022 - gdp_2017) / gdp_2017 * 100), 2) as growth_percent
        FROM provinces 
        ORDER BY gdp_2022 DESC
    `, (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

app.get('/api/economy/tax-comparison', (req, res) => {
    db.query(`
        SELECT name, investment_tax, gdp_2022,
               ROUND(gdp_2022 / investment_tax, 2) as gdp_per_tax
        FROM provinces 
        ORDER BY investment_tax ASC
    `, (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// ==================== АДМИН API ДЛЯ РЕДАКТИРОВАНИЯ ====================

// Получить все провинции (уже есть, но добавим для админки)
app.get('/api/admin/provinces', (req, res) => {
    db.query('SELECT * FROM provinces ORDER BY id', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Добавить новую провинцию
app.post('/api/admin/provinces', (req, res) => {
    const { name, gdp_2022, investment_tax, infrastructure_score, education_score, health_score, population } = req.body;
    
    if (!name) {
        return res.status(400).json({ error: 'Название провинции обязательно' });
    }
    
    const currentYear = new Date().getFullYear();
    const defaultGdp = gdp_2022 || 0;
    
    db.query(
        `INSERT INTO provinces 
        (name, gdp_2017, gdp_2018, gdp_2019, gdp_2020, gdp_2021, gdp_2022, 
         investment_tax, infrastructure_score, education_score, health_score, population, area) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, defaultGdp, defaultGdp, defaultGdp, defaultGdp, defaultGdp, defaultGdp,
         investment_tax || 0, infrastructure_score || 0, education_score || 0, health_score || 0, population || 0, 0],
        (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Ошибка базы данных: ' + err.message });
            }
            res.json({ id: result.insertId, message: 'Провинция добавлена' });
        }
    );
});

// Обновить провинцию
app.put('/api/admin/provinces/:id', (req, res) => {
    const { name, gdp_2022, investment_tax, infrastructure_score, education_score, health_score, population } = req.body;
    const id = req.params.id;
    
    db.query(
        `UPDATE provinces SET 
         name = ?, 
         gdp_2022 = ?, 
         investment_tax = ?, 
         infrastructure_score = ?, 
         education_score = ?, 
         health_score = ?, 
         population = ? 
         WHERE id = ?`,
        [name, gdp_2022, investment_tax, infrastructure_score, education_score, health_score, population, id],
        (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Ошибка обновления: ' + err.message });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Провинция не найдена' });
            }
            res.json({ message: 'Провинция обновлена' });
        }
    );
});

// Удалить провинцию
app.delete('/api/admin/provinces/:id', (req, res) => {
    db.query('DELETE FROM provinces WHERE id = ?', [req.params.id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Провинция не найдена' });
        }
        res.json({ message: 'Провинция удалена' });
    });
});

// Очистить все провинции
app.delete('/api/admin/provinces', (req, res) => {
    db.query('TRUNCATE TABLE provinces', (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Все провинции удалены' });
    });
});

// ==================== УПРАВЛЕНИЕ ПРОФИЛЕМ ====================

// Получение полного профиля пользователя
app.get('/api/profile/:id', (req, res) => {
    const userId = req.params.id;
    
    // Проверка прав (можно смотреть только свой профиль или админу)
    if (req.session.userId != userId && req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Нет доступа к этому профилю' });
    }
    
    db.query(
        'SELECT id, username, email, full_name, avatar, phone, bio, role, created_at, updated_at, last_login FROM users WHERE id = ?',
        [userId],
        (err, results) => {
            if (err || results.length === 0) {
                return res.status(404).json({ error: 'Пользователь не найден' });
            }
            res.json(results[0]);
        }
    );
});

// Обновление профиля
// Обновление профиля
app.put('/api/profile/:id', async (req, res) => {
    const userId = req.params.id;
    const { full_name, email, phone, bio, current_password, new_password } = req.body;
    
    console.log('=== ОБНОВЛЕНИЕ ПРОФИЛЯ ===');
    console.log('UserId:', userId);
    console.log('Session userId:', req.session.userId);
    console.log('Данные:', { full_name, email, phone, bio });
    
    // Проверка прав
    if (req.session.userId != userId && req.session.role !== 'admin') {
        console.log('Ошибка доступа!');
        return res.status(403).json({ error: 'Нет доступа' });
    }
    
    // Простое обновление
    const query = 'UPDATE users SET full_name = ?, email = ?, phone = ?, bio = ? WHERE id = ?';
    const params = [full_name || null, email, phone || null, bio || null, userId];
    
    console.log('SQL:', query);
    console.log('Params:', params);
    
    db.query(query, params, (err, result) => {
        if (err) {
            console.error('Ошибка БД:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: 'Email уже используется' });
            }
            return res.status(500).json({ error: 'Ошибка обновления: ' + err.message });
        }
        
        console.log('Обновлено строк:', result.affectedRows);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        res.json({ message: 'Профиль обновлен успешно' });
    });
});

function updateProfile(userId, updates, res) {
    const { full_name, email, phone, bio, password_hash } = updates;
    
    let query = 'UPDATE users SET full_name = ?, email = ?, phone = ?, bio = ?';
    let params = [full_name || null, email, phone || null, bio || null];
    
    if (password_hash) {
        query += ', password_hash = ?';
        params.push(password_hash);
    }
    
    query += ' WHERE id = ?';
    params.push(userId);
    
    db.query(query, params, async (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: 'Email уже используется' });
            }
            return res.status(500).json({ error: 'Ошибка обновления' });
        }
        
        // Обновляем данные в сессии
        if (req && req.session && req.session.userId == userId) {
            // Получаем обновлённые данные пользователя
            db.query('SELECT id, username, email, full_name, phone, bio, role, avatar FROM users WHERE id = ?', [userId], (err, userData) => {
                if (!err && userData.length > 0) {
                    req.session.username = userData[0].username;
                    // Обновляем другие данные в сессии при необходимости
                }
            });
        }
        
        res.json({ message: 'Профиль обновлен успешно' });
    });
}

// Обновление аватара
app.post('/api/profile/:id/avatar', (req, res) => {
    const userId = req.params.id;
    const { avatar } = req.body;
    
    if (req.session.userId != userId && req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Нет доступа' });
    }
    
    db.query('UPDATE users SET avatar = ? WHERE id = ?', [avatar, userId], (err, result) => {
        if (err) return res.status(500).json({ error: 'Ошибка обновления' });
        res.json({ message: 'Аватар обновлен', avatar: avatar });
    });
});

// Обновление последнего входа
app.post('/api/profile/:id/last-login', (req, res) => {
    db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [req.params.id], (err) => {
        if (err) console.error(err);
    });
    res.json({ message: 'OK' });
});

// ==================== ЗАГРУЗКА АВАТАРА ====================

// Загрузка аватара
app.post('/api/profile/:id/upload-avatar', upload.single('avatar'), (req, res) => {
    const userId = req.params.id;
    
    // Проверка прав
    if (req.session.userId != userId && req.session.role !== 'admin') {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(403).json({ error: 'Нет доступа' });
    }
    
    if (!req.file) {
        return res.status(400).json({ error: 'Файл не загружен' });
    }
    
    const avatarPath = '/uploads/avatars/' + req.file.filename;
    
    // Удаляем старый аватар
    db.query('SELECT avatar FROM users WHERE id = ?', [userId], (err, results) => {
        if (!err && results[0] && results[0].avatar && results[0].avatar.includes('/uploads/')) {
            const oldPath = path.join(__dirname, 'public', results[0].avatar);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }
        
        // Обновляем в БД
        db.query('UPDATE users SET avatar = ? WHERE id = ?', [avatarPath, userId], (err) => {
            if (err) {
                return res.status(500).json({ error: 'Ошибка обновления' });
            }
            res.json({ 
                success: true,
                message: 'Аватар загружен', 
                avatar: avatarPath 
            });
        });
    });
});

// Удаление аватара (сброс на стандартный)
app.delete('/api/profile/:id/avatar', (req, res) => {
    const userId = req.params.id;
    
    if (req.session.userId != userId && req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Нет доступа' });
    }
    
    db.query('SELECT avatar FROM users WHERE id = ?', [userId], (err, results) => {
        if (!err && results[0] && results[0].avatar && results[0].avatar.includes('/uploads/')) {
            const oldPath = path.join(__dirname, 'public', results[0].avatar);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }
        
        db.query('UPDATE users SET avatar = ? WHERE id = ?', ['/images/default-avatar.png', userId], (err) => {
            if (err) {
                return res.status(500).json({ error: 'Ошибка' });
            }
            res.json({ message: 'Аватар удален', avatar: '/images/default-avatar.png' });
        });
    });
});

// ==================== ЗАМЕТКИ ====================

// Получить все заметки для провинции
app.get('/api/provinces/:id/notes', (req, res) => {
    const provinceId = req.params.id;
    const userId = req.session.userId;
    
    let query = `
        SELECT n.*, u.username, u.avatar,
               (SELECT COUNT(*) FROM note_likes WHERE note_id = n.id) as likes_count,
               (SELECT COUNT(*) FROM note_likes WHERE note_id = n.id AND user_id = ?) as user_liked
        FROM notes n
        JOIN users u ON n.user_id = u.id
        WHERE n.province_id = ? AND (n.is_public = 1 OR n.user_id = ?)
        ORDER BY n.priority ASC, n.created_at DESC
    `;
    
    db.query(query, [userId || 0, provinceId, userId || 0], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Создать заметку
app.post('/api/notes', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Необходима авторизация' });
    }
    
    const { province_id, title, content, priority, is_public } = req.body;
    
    if (!province_id || !title || !content) {
        return res.status(400).json({ error: 'Заполните все поля' });
    }
    
    db.query(
        'INSERT INTO notes (province_id, user_id, title, content, priority, is_public) VALUES (?, ?, ?, ?, ?, ?)',
        [province_id, req.session.userId, title, content, priority || 3, is_public !== undefined ? is_public : 1],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: result.insertId, message: 'Заметка создана' });
        }
    );
});

// Обновить заметку
app.put('/api/notes/:id', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
    
    const { title, content, priority, is_public } = req.body;
    
    db.query(
        'UPDATE notes SET title = ?, content = ?, priority = ?, is_public = ? WHERE id = ? AND user_id = ?',
        [title, content, priority, is_public, req.params.id, req.session.userId],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.affectedRows === 0) return res.status(404).json({ error: 'Заметка не найдена' });
            res.json({ message: 'Заметка обновлена' });
        }
    );
});

// Удалить заметку
app.delete('/api/notes/:id', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
    
    db.query('DELETE FROM notes WHERE id = ? AND user_id = ?', [req.params.id, req.session.userId], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Заметка удалена' });
    });
});

// Лайкнуть заметку
app.post('/api/notes/:id/like', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
    
    db.query('INSERT INTO note_likes (note_id, user_id) VALUES (?, ?)', [req.params.id, req.session.userId], (err) => {
        if (err && err.code === 'ER_DUP_ENTRY') {
            // Удаляем лайк если уже есть
            db.query('DELETE FROM note_likes WHERE note_id = ? AND user_id = ?', [req.params.id, req.session.userId], (err2) => {
                if (err2) return res.status(500).json({ error: err2.message });
                res.json({ message: 'Лайк убран', liked: false });
            });
        } else if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ message: 'Лайк добавлен', liked: true });
        }
    });
});

// Получить все провинции с возможностью сортировки
app.get('/api/provinces/sorted/:sort', (req, res) => {
    const sort = req.params.sort;
    let orderBy = '';
    
    switch(sort) {
        case 'name':
            orderBy = 'name ASC';
            break;
        case 'gdp':
            orderBy = 'gdp_2022 DESC';
            break;
        case 'tax':
            orderBy = 'investment_tax ASC';
            break;
        case 'infrastructure':
            orderBy = 'infrastructure_score DESC';
            break;
        case 'education':
            orderBy = 'education_score DESC';
            break;
        case 'health':
            orderBy = 'health_score DESC';
            break;
        case 'population':
            orderBy = 'population DESC';
            break;
        default:
            orderBy = 'name ASC';
    }
    
    console.log(`Сортировка: ${sort}, ORDER BY: ${orderBy}`); // Для отладки
    
    db.query(`SELECT * FROM provinces ORDER BY ${orderBy}`, (err, results) => {
        if (err) {
            console.error('Ошибка сортировки:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// Получить детальную информацию о провинции
app.get('/api/provinces/:id/detail', (req, res) => {
    db.query('SELECT * FROM provinces WHERE id = ?', [req.params.id], (err, results) => {
        if (err || results.length === 0) {
            return res.status(404).json({ error: 'Провинция не найдена' });
        }
        res.json(results[0]);
    });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`📊 Доступные страницы:`);
    console.log(`   - http://localhost:${PORT} - Главная`);
    console.log(`   - http://localhost:${PORT}/login.html - Вход`);
    console.log(`   - http://localhost:${PORT}/register.html - Регистрация`);
    console.log(`   - http://localhost:${PORT}/rating.html - Рейтинг`);
    console.log(`   - http://localhost:${PORT}/economy.html - Экономика`);
});