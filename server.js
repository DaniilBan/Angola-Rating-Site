const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();

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
        maxAge: 1000 * 60 * 60 * 24
    }
}));

// Создаем папку для загрузки аватаров
const uploadDir = path.join(__dirname, 'public/uploads/avatars');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Настройка multer для аватаров
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
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: fileFilter
});

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

// ==================== АВТОМАТИЧЕСКОЕ СОЗДАНИЕ ТАБЛИЦ ====================

function initDatabase() {
    console.log('🔧 Проверка и создание таблиц...');
    
    // Таблица users
    const createUsers = `
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role ENUM('user', 'admin') DEFAULT 'user',
            full_name VARCHAR(100) NULL,
            avatar VARCHAR(255) NULL DEFAULT '/images/default-avatar.png',
            phone VARCHAR(20) NULL,
            bio TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            last_login TIMESTAMP NULL
        )
    `;
    
    // Таблица provinces (теперь это дивизионы Бангладеш)
    const createProvinces = `
        CREATE TABLE IF NOT EXISTS provinces (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            capital VARCHAR(100),
            governor VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `;
    
    // Таблица notes
    const createNotes = `
        CREATE TABLE IF NOT EXISTS notes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            province_id INT NOT NULL,
            user_id INT NOT NULL,
            title VARCHAR(200) NOT NULL,
            content TEXT NOT NULL,
            priority INT DEFAULT 3,
            is_public BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (province_id) REFERENCES provinces(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `;
    
    // Таблица note_likes
    const createLikes = `
        CREATE TABLE IF NOT EXISTS note_likes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            note_id INT NOT NULL,
            user_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_like (note_id, user_id)
        )
    `;
    
    // Таблица attribute_definitions (характеристики Бангладеш)
    const createAttributes = `
        CREATE TABLE IF NOT EXISTS attribute_definitions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE,
            label VARCHAR(200) NOT NULL,
            type ENUM('number', 'text', 'boolean', 'date') DEFAULT 'text',
            unit VARCHAR(50) NULL,
            is_active BOOLEAN DEFAULT TRUE,
            display_order INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `;
    
    // Таблица attribute_values
    const createAttributeValues = `
        CREATE TABLE IF NOT EXISTS attribute_values (
            id INT AUTO_INCREMENT PRIMARY KEY,
            attribute_id INT NOT NULL,
            province_id INT NOT NULL,
            value_text TEXT NULL,
            value_number DECIMAL(15,2) NULL,
            value_boolean BOOLEAN NULL,
            value_date DATE NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (attribute_id) REFERENCES attribute_definitions(id) ON DELETE CASCADE,
            FOREIGN KEY (province_id) REFERENCES provinces(id) ON DELETE CASCADE,
            UNIQUE KEY unique_province_attribute (attribute_id, province_id)
        )
    `;
    
    db.query(createUsers, (err) => {
        if (err) console.error('❌ Ошибка users:', err);
        else console.log('✅ Таблица users готова');
    });
    
    db.query(createProvinces, (err) => {
        if (err) console.error('❌ Ошибка provinces:', err);
        else console.log('✅ Таблица provinces готова');
    });
    
    db.query(createNotes, (err) => {
        if (err) console.error('❌ Ошибка notes:', err);
        else console.log('✅ Таблица notes готова');
    });
    
    db.query(createLikes, (err) => {
        if (err) console.error('❌ Ошибка note_likes:', err);
        else console.log('✅ Таблица note_likes готова');
    });
    
    db.query(createAttributes, (err) => {
        if (err) console.error('❌ Ошибка attribute_definitions:', err);
        else console.log('✅ Таблица attribute_definitions готова');
    });
    
    db.query(createAttributeValues, (err) => {
        if (err) console.error('❌ Ошибка attribute_values:', err);
        else console.log('✅ Таблица attribute_values готова');
    });
    
    // Добавляем начальные данные для Бангладеш
    setTimeout(() => {
        db.query('SELECT COUNT(*) as count FROM provinces', (err, results) => {
            if (!err && results[0].count === 0) {
                console.log('📝 Добавление данных о дивизионах Бангладеш...');
                
                // Добавляем характеристики
                db.query(`
                    INSERT INTO attribute_definitions (name, label, type, display_order) VALUES
                    ('population', 'Население', 'text', 10),
                    ('private_investment', 'Частные инвестиции', 'text', 20),
                    ('minerals', 'Полезные ископаемые', 'text', 30),
                    ('tourism_potential', 'Туристический потенциал', 'text', 40)
                `, (err) => {
                    if (err) console.error('❌ Ошибка добавления характеристик:', err);
                    else console.log('✅ Характеристики добавлены');
                });
                
                // Добавляем дивизионы
                const insertProvinces = `
                    INSERT INTO provinces (name, description, capital, governor) VALUES
                    ('Дакка', 'Столичный дивизион Бангладеш, крупнейший экономический центр страны.', 'Дакка', 'Абдул Маннан'),
                    ('Читтагонг', 'Второй по величине дивизион, важный портовый регион.', 'Читтагонг', 'Мохаммад Абдул Маннан'),
                    ('Силхет', 'Северо-восточный регион, известный чайными плантациями.', 'Силхет', 'Джаханг Хоссейн'),
                    ('Кхулна', 'Юго-западный регион, где находится Сундарбан.', 'Кхулна', 'Мохаммад Абдул Азиз'),
                    ('Раджшахи', 'Северный регион, аграрный центр Бангладеш.', 'Раджшахи', 'Абдул Хамид'),
                    ('Рангпур', 'Северный регион, известный историческими дворцами.', 'Рангпур', 'Мохаммад Ильяс'),
                    ('Маймансингх', 'Центральный регион с развитым сельским туризмом.', 'Маймансингх', 'Мохаммад Шахидулла'),
                    ('Барисал', 'Южный регион с речными круизами и офшорным газом.', 'Барисал', 'Мохаммад Хан')
                `;
                
                db.query(insertProvinces, (err) => {
                    if (err) {
                        console.error('❌ Ошибка добавления дивизионов:', err);
                        return;
                    }
                    console.log('✅ Добавлены дивизионы Бангладеш');
                    
                    // Добавляем значения характеристик
                    const insertValues = `
                        INSERT INTO attribute_values (attribute_id, province_id, value_text) VALUES
                        ((SELECT id FROM attribute_definitions WHERE name = 'population'), (SELECT id FROM provinces WHERE name = 'Дакка'), 'более 20 млн'),
                        ((SELECT id FROM attribute_definitions WHERE name = 'private_investment'), (SELECT id FROM provinces WHERE name = 'Дакка'), 'Очень высокие'),
                        ((SELECT id FROM attribute_definitions WHERE name = 'minerals'), (SELECT id FROM provinces WHERE name = 'Дакка'), 'Природный газ (ограниченно)'),
                        ((SELECT id FROM attribute_definitions WHERE name = 'tourism_potential'), (SELECT id FROM provinces WHERE name = 'Дакка'), 'Исторические памятники'),
                        
                        ((SELECT id FROM attribute_definitions WHERE name = 'population'), (SELECT id FROM provinces WHERE name = 'Читтагонг'), 'более 9 млн'),
                        ((SELECT id FROM attribute_definitions WHERE name = 'private_investment'), (SELECT id FROM provinces WHERE name = 'Читтагонг'), 'Высокие'),
                        ((SELECT id FROM attribute_definitions WHERE name = 'minerals'), (SELECT id FROM provinces WHERE name = 'Читтагонг'), 'Природный газ, известняк'),
                        ((SELECT id FROM attribute_definitions WHERE name = 'tourism_potential'), (SELECT id FROM provinces WHERE name = 'Читтагонг'), 'Холмы, пляжи'),
                        
                        ((SELECT id FROM attribute_definitions WHERE name = 'population'), (SELECT id FROM provinces WHERE name = 'Силхет'), 'около 3,5 млн'),
                        ((SELECT id FROM attribute_definitions WHERE name = 'private_investment'), (SELECT id FROM provinces WHERE name = 'Силхет'), 'Средние'),
                        ((SELECT id FROM attribute_definitions WHERE name = 'minerals'), (SELECT id FROM provinces WHERE name = 'Силхет'), 'Природный газ (крупные)'),
                        ((SELECT id FROM attribute_definitions WHERE name = 'tourism_potential'), (SELECT id FROM provinces WHERE name = 'Силхет'), 'Чайные сады'),
                        
                        ((SELECT id FROM attribute_definitions WHERE name = 'population'), (SELECT id FROM provinces WHERE name = 'Кхулна'), 'около 5 млн'),
                        ((SELECT id FROM attribute_definitions WHERE name = 'private_investment'), (SELECT id FROM provinces WHERE name = 'Кхулна'), 'Средние'),
                        ((SELECT id FROM attribute_definitions WHERE name = 'minerals'), (SELECT id FROM provinces WHERE name = 'Кхулна'), 'Лесные ресурсы'),
                        ((SELECT id FROM attribute_definitions WHERE name = 'tourism_potential'), (SELECT id FROM provinces WHERE name = 'Кхулна'), 'Сундарбан (ЮНЕСКО)'),
                        
                        ((SELECT id FROM attribute_definitions WHERE name = 'population'), (SELECT id FROM provinces WHERE name = 'Раджшахи'), 'более 6 млн'),
                        ((SELECT id FROM attribute_definitions WHERE name = 'private_investment'), (SELECT id FROM provinces WHERE name = 'Раджшахи'), 'Низкие'),
                        ((SELECT id FROM attribute_definitions WHERE name = 'minerals'), (SELECT id FROM provinces WHERE name = 'Раджшахи'), 'Сельскохозяйственные земли'),
                        ((SELECT id FROM attribute_definitions WHERE name = 'tourism_potential'), (SELECT id FROM provinces WHERE name = 'Раджшахи'), 'Исторические памятники'),
                        
                        ((SELECT id FROM attribute_definitions WHERE name = 'population'), (SELECT id FROM provinces WHERE name = 'Рангпур'), 'около 3 млн'),
                        ((SELECT id FROM attribute_definitions WHERE name = 'private_investment'), (SELECT id FROM provinces WHERE name = 'Рангпур'), 'Низкие'),
                        ((SELECT id FROM attribute_definitions WHERE name = 'minerals'), (SELECT id FROM provinces WHERE name = 'Рангпур'), 'Уголь (ограниченно)'),
                        ((SELECT id FROM attribute_definitions WHERE name = 'tourism_potential'), (SELECT id FROM provinces WHERE name = 'Рангпур'), 'Дворцы, реки'),
                        
                        ((SELECT id FROM attribute_definitions WHERE name = 'population'), (SELECT id FROM provinces WHERE name = 'Маймансингх'), 'около 3 млн'),
                        ((SELECT id FROM attribute_definitions WHERE name = 'private_investment'), (SELECT id FROM provinces WHERE name = 'Маймансингх'), 'Низкие'),
                        ((SELECT id FROM attribute_definitions WHERE name = 'minerals'), (SELECT id FROM provinces WHERE name = 'Маймансингх'), 'Нет'),
                        ((SELECT id FROM attribute_definitions WHERE name = 'tourism_potential'), (SELECT id FROM provinces WHERE name = 'Маймансингх'), 'Сельский туризм'),
                        
                        ((SELECT id FROM attribute_definitions WHERE name = 'population'), (SELECT id FROM provinces WHERE name = 'Барисал'), 'около 4 млн'),
                        ((SELECT id FROM attribute_definitions WHERE name = 'private_investment'), (SELECT id FROM provinces WHERE name = 'Барисал'), 'Низкие'),
                        ((SELECT id FROM attribute_definitions WHERE name = 'minerals'), (SELECT id FROM provinces WHERE name = 'Барисал'), 'Природный газ (офшорные)'),
                        ((SELECT id FROM attribute_definitions WHERE name = 'tourism_potential'), (SELECT id FROM provinces WHERE name = 'Барисал'), 'Речные круизы')
                    `;
                    
                    db.query(insertValues, (err) => {
                        if (err) console.error('❌ Ошибка добавления значений:', err);
                        else console.log('✅ Добавлены значения характеристик');
                    });
                });
            }
        });
    }, 3000);
}

// Запускаем создание таблиц
initDatabase();

// ==================== АВТОРИЗАЦИЯ ====================

app.post('/api/register', async (req, res) => {
    const { username, email, password, role, adminCode } = req.body;
    
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Все поля обязательны' });
    }
    
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

app.get('/api/me', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Не авторизован' });
    }
    
    db.query('SELECT id, username, email, role, full_name, avatar, created_at FROM users WHERE id = ?', 
        [req.session.userId], 
        (err, results) => {
            if (err || results.length === 0) {
                return res.status(401).json({ error: 'Пользователь не найден' });
            }
            res.json(results[0]);
        });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Ошибка при выходе' });
        }
        res.json({ message: 'Выход выполнен успешно' });
    });
});

// ==================== ПРОФИЛЬ ====================

app.get('/api/profile/:id', (req, res) => {
    const userId = req.params.id;
    
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

app.put('/api/profile/:id', async (req, res) => {
    const userId = req.params.id;
    const { full_name, email, phone, bio, current_password, new_password } = req.body;
    
    if (req.session.userId != userId && req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Нет доступа' });
    }
    
    if (new_password) {
        db.query('SELECT password_hash FROM users WHERE id = ?', [userId], async (err, results) => {
            if (err || results.length === 0) {
                return res.status(404).json({ error: 'Пользователь не найден' });
            }
            
            const validPassword = await bcrypt.compare(current_password, results[0].password_hash);
            if (!validPassword) {
                return res.status(401).json({ error: 'Текущий пароль неверен' });
            }
            
            const newHash = await bcrypt.hash(new_password, 10);
            db.query(
                'UPDATE users SET full_name = ?, email = ?, phone = ?, bio = ?, password_hash = ? WHERE id = ?',
                [full_name || null, email, phone || null, bio || null, newHash, userId],
                (err, result) => {
                    if (err) {
                        if (err.code === 'ER_DUP_ENTRY') {
                            return res.status(400).json({ error: 'Email уже используется' });
                        }
                        return res.status(500).json({ error: 'Ошибка обновления' });
                    }
                    res.json({ message: 'Профиль обновлен успешно' });
                }
            );
        });
    } else {
        db.query(
            'UPDATE users SET full_name = ?, email = ?, phone = ?, bio = ? WHERE id = ?',
            [full_name || null, email, phone || null, bio || null, userId],
            (err, result) => {
                if (err) {
                    if (err.code === 'ER_DUP_ENTRY') {
                        return res.status(400).json({ error: 'Email уже используется' });
                    }
                    return res.status(500).json({ error: 'Ошибка обновления' });
                }
                res.json({ message: 'Профиль обновлен успешно' });
            }
        );
    }
});

// Загрузка аватара
app.post('/api/profile/:id/upload-avatar', upload.single('avatar'), (req, res) => {
    const userId = req.params.id;
    
    if (req.session.userId != userId && req.session.role !== 'admin') {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(403).json({ error: 'Нет доступа' });
    }
    
    if (!req.file) {
        return res.status(400).json({ error: 'Файл не загружен' });
    }
    
    const avatarPath = '/uploads/avatars/' + req.file.filename;
    
    db.query('SELECT avatar FROM users WHERE id = ?', [userId], (err, results) => {
        if (!err && results[0] && results[0].avatar && results[0].avatar.includes('/uploads/')) {
            const oldPath = path.join(__dirname, 'public', results[0].avatar);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }
        
        db.query('UPDATE users SET avatar = ? WHERE id = ?', [avatarPath, userId], (err) => {
            if (err) {
                return res.status(500).json({ error: 'Ошибка обновления' });
            }
            res.json({ success: true, message: 'Аватар загружен', avatar: avatarPath });
        });
    });
});

// Удаление аватара
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

// ==================== ПРОВИНЦИИ (ДИВИЗИОНЫ) ====================

app.get('/api/provinces', (req, res) => {
    db.query('SELECT * FROM provinces ORDER BY name', (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

app.get('/api/provinces/:id/detail', (req, res) => {
    db.query('SELECT * FROM provinces WHERE id = ?', [req.params.id], (err, results) => {
        if (err || results.length === 0) {
            return res.status(404).json({ error: 'Провинция не найдена' });
        }
        res.json(results[0]);
    });
});

// ==================== АДМИН ПРОВИНЦИЙ ====================

app.get('/api/admin/provinces', (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Доступ только для администратора' });
    }
    
    db.query('SELECT * FROM provinces ORDER BY id', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/admin/provinces', (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Доступ только для администратора' });
    }
    
    const { name, description, capital, governor } = req.body;
    
    if (!name) {
        return res.status(400).json({ error: 'Название дивизиона обязательно' });
    }
    
    db.query(
        'INSERT INTO provinces (name, description, capital, governor) VALUES (?, ?, ?, ?)',
        [name, description || null, capital || null, governor || null],
        (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Ошибка базы данных: ' + err.message });
            }
            res.json({ id: result.insertId, message: 'Дивизион добавлен' });
        }
    );
});

app.put('/api/admin/provinces/:id', (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Доступ только для администратора' });
    }
    
    const { name, description, capital, governor } = req.body;
    const id = req.params.id;
    
    db.query(
        'UPDATE provinces SET name = ?, description = ?, capital = ?, governor = ? WHERE id = ?',
        [name, description || null, capital || null, governor || null, id],
        (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Ошибка обновления: ' + err.message });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Дивизион не найден' });
            }
            res.json({ message: 'Дивизион обновлён' });
        }
    );
});

app.delete('/api/admin/provinces/:id', (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Доступ только для администратора' });
    }
    
    db.query('DELETE FROM provinces WHERE id = ?', [req.params.id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Дивизион не найден' });
        }
        res.json({ message: 'Дивизион удалён' });
    });
});

app.delete('/api/admin/provinces', (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Доступ только для администратора' });
    }
    
    db.query('TRUNCATE TABLE provinces', (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Все дивизионы удалены' });
    });
});

// ==================== РЕЙТИНГ ====================

app.get('/api/rating/copeland', (req, res) => {
    db.query('SELECT * FROM provinces', (err, provinces) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        const n = provinces.length;
        const matrix = Array(n).fill().map(() => Array(n).fill(0));
        const copelandScores = Array(n).fill(0);
        
        // Для Бангладеш используем другие критерии
        // Так как у нас текстовые данные, используем другие поля
        // В данном случае используем только ID для упрощения
        // В реальном проекте здесь можно использовать другие числовые показатели
        
        // Используем порядок добавления как критерий
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                // Сравниваем по населению (по порядку в таблице)
                let scoreI = 0, scoreJ = 0;
                
                // Используем порядок ID как критерий (чем меньше ID, тем выше рейтинг)
                if (provinces[i].id < provinces[j].id) scoreI++;
                else if (provinces[i].id > provinces[j].id) scoreJ++;
                
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
        
        rating.forEach((item, idx) => {
            item.rank = idx + 1;
        });

        res.json({ 
            rating, 
            matrix, 
            provinces: provinces.map(p => p.name)
        });
    });
});

// ==================== ЗАМЕТКИ ====================

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

app.delete('/api/notes/:id', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
    
    db.query('DELETE FROM notes WHERE id = ? AND user_id = ?', [req.params.id, req.session.userId], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Заметка удалена' });
    });
});

app.post('/api/notes/:id/like', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
    
    db.query('INSERT INTO note_likes (note_id, user_id) VALUES (?, ?)', [req.params.id, req.session.userId], (err) => {
        if (err && err.code === 'ER_DUP_ENTRY') {
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

// ==================== ДИНАМИЧЕСКИЕ ХАРАКТЕРИСТИКИ ====================

// 1. Получить все провинции с характеристиками (для главной)
app.get('/api/provinces/with-attributes', (req, res) => {
    db.query('SELECT * FROM provinces ORDER BY name', (err, provinces) => {
        if (err) {
            console.error('Ошибка получения провинций:', err);
            return res.status(500).json({ error: err.message });
        }
        
        db.query('SELECT * FROM attribute_definitions WHERE is_active = 1 ORDER BY display_order', (err, attributes) => {
            if (err) {
                console.error('Ошибка получения атрибутов:', err);
                return res.status(500).json({ error: err.message });
            }
            
            db.query('SELECT * FROM attribute_values', (err, values) => {
                if (err) {
                    console.error('Ошибка получения значений:', err);
                    return res.status(500).json({ error: err.message });
                }
                
                res.json({
                    provinces: provinces,
                    attributes: attributes,
                    values: values
                });
            });
        });
    });
});

// 2. Получить одну провинцию с характеристиками (для карточки)
app.get('/api/provinces/:id/with-attributes', (req, res) => {
    const provinceId = req.params.id;
    
    db.query('SELECT * FROM provinces WHERE id = ?', [provinceId], (err, province) => {
        if (err) {
            console.error('Ошибка получения провинции:', err);
            return res.status(500).json({ error: err.message });
        }
        if (province.length === 0) {
            return res.status(404).json({ error: 'Провинция не найдена' });
        }
        
        db.query('SELECT * FROM attribute_definitions WHERE is_active = 1 ORDER BY display_order', (err, attributes) => {
            if (err) {
                console.error('Ошибка получения атрибутов:', err);
                return res.status(500).json({ error: err.message });
            }
            
            db.query('SELECT * FROM attribute_values WHERE province_id = ?', [provinceId], (err, values) => {
                if (err) {
                    console.error('Ошибка получения значений:', err);
                    return res.status(500).json({ error: err.message });
                }
                
                res.json({
                    province: province[0],
                    attributes: attributes,
                    values: values
                });
            });
        });
    });
});

// 3. Получить все характеристики для рейтинга
app.get('/api/rating/with-attributes', (req, res) => {
    db.query('SELECT * FROM provinces', (err, provinces) => {
        if (err) {
            console.error('Ошибка получения провинций:', err);
            return res.status(500).json({ error: err.message });
        }

        const n = provinces.length;
        const matrix = Array(n).fill().map(() => Array(n).fill(0));
        const copelandScores = Array(n).fill(0);
        
        // Для Бангладеш используем порядок ID как критерий
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                let scoreI = 0, scoreJ = 0;
                
                if (provinces[i].id < provinces[j].id) scoreI++;
                else if (provinces[i].id > provinces[j].id) scoreJ++;
                
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
        
        rating.forEach((item, idx) => {
            item.rank = idx + 1;
        });

        db.query('SELECT * FROM attribute_definitions WHERE is_active = 1 ORDER BY display_order', (err, attributes) => {
            if (err) {
                console.error('Ошибка получения атрибутов:', err);
                return res.status(500).json({ error: err.message });
            }
            
            db.query('SELECT * FROM attribute_values', (err, values) => {
                if (err) {
                    console.error('Ошибка получения значений:', err);
                    return res.status(500).json({ error: err.message });
                }
                
                res.json({ 
                    rating, 
                    matrix, 
                    provinces: provinces.map(p => p.name),
                    attributes: attributes,
                    values: values
                });
            });
        });
    });
});

// 4. Получить все характеристики для экономики
app.get('/api/economy/with-attributes', (req, res) => {
    db.query('SELECT * FROM provinces ORDER BY name', (err, provinces) => {
        if (err) {
            console.error('Ошибка получения провинций:', err);
            return res.status(500).json({ error: err.message });
        }
        
        db.query('SELECT * FROM attribute_definitions WHERE is_active = 1 ORDER BY display_order', (err, attributes) => {
            if (err) {
                console.error('Ошибка получения атрибутов:', err);
                return res.status(500).json({ error: err.message });
            }
            
            db.query('SELECT * FROM attribute_values', (err, values) => {
                if (err) {
                    console.error('Ошибка получения значений:', err);
                    return res.status(500).json({ error: err.message });
                }
                
                res.json({ 
                    provinces: provinces,
                    attributes: attributes,
                    values: values
                });
            });
        });
    });
});

// 5. Получить все определения характеристик (для админки)
app.get('/api/admin/attributes', (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Доступ только для администратора' });
    }
    
    db.query('SELECT * FROM attribute_definitions ORDER BY display_order', (err, results) => {
        if (err) {
            console.error('Ошибка получения атрибутов:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// 6. Создать новую характеристику
app.post('/api/admin/attributes', (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Доступ только для администратора' });
    }
    
    const { name, label, type, unit } = req.body;
    
    if (!name || !label || !type) {
        return res.status(400).json({ error: 'Имя, название и тип обязательны' });
    }
    
    db.query('SELECT id FROM attribute_definitions WHERE name = ?', [name], (err, results) => {
        if (err) {
            console.error('Ошибка проверки:', err);
            return res.status(500).json({ error: err.message });
        }
        if (results.length > 0) {
            return res.status(400).json({ error: 'Характеристика с таким именем уже существует' });
        }
        
        db.query(
            'INSERT INTO attribute_definitions (name, label, type, unit, display_order) VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(display_order), 0) + 10 FROM attribute_definitions))',
            [name, label, type, unit || null],
            (err, result) => {
                if (err) {
                    console.error('Ошибка создания:', err);
                    return res.status(500).json({ error: err.message });
                }
                res.json({ id: result.insertId, message: 'Характеристика создана' });
            }
        );
    });
});

// 7. Обновить характеристику
app.put('/api/admin/attributes/:id', (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Доступ только для администратора' });
    }
    
    const { label, unit, is_active, display_order } = req.body;
    const id = req.params.id;
    
    db.query(
        'UPDATE attribute_definitions SET label = ?, unit = ?, is_active = ?, display_order = ? WHERE id = ?',
        [label || null, unit || null, is_active !== undefined ? is_active : 1, display_order || 0, id],
        (err, result) => {
            if (err) {
                console.error('Ошибка обновления:', err);
                return res.status(500).json({ error: err.message });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Характеристика не найдена' });
            }
            res.json({ message: 'Характеристика обновлена' });
        }
    );
});

// 8. Удалить характеристику
app.delete('/api/admin/attributes/:id', (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Доступ только для администратора' });
    }
    
    const id = req.params.id;
    
    db.query('DELETE FROM attribute_values WHERE attribute_id = ?', [id], (err) => {
        if (err) {
            console.error('Ошибка удаления значений:', err);
            return res.status(500).json({ error: err.message });
        }
        
        db.query('DELETE FROM attribute_definitions WHERE id = ?', [id], (err) => {
            if (err) {
                console.error('Ошибка удаления атрибута:', err);
                return res.status(500).json({ error: err.message });
            }
            res.json({ message: 'Характеристика удалена' });
        });
    });
});

// 9. Сохранить значения характеристик (только админ)
app.post('/api/admin/provinces/:id/attributes', (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Доступ только для администратора' });
    }
    
    const provinceId = req.params.id;
    const { attributes } = req.body;
    
    if (!attributes || typeof attributes !== 'object') {
        return res.status(400).json({ error: 'Некорректные данные' });
    }
    
    db.query('SELECT id, type FROM attribute_definitions', (err, attrDefs) => {
        if (err) {
            console.error('Ошибка получения типов:', err);
            return res.status(500).json({ error: err.message });
        }
        
        const attrMap = {};
        attrDefs.forEach(a => attrMap[a.id] = a.type);
        
        let completed = 0;
        const total = Object.keys(attributes).length;
        let hasError = false;
        
        if (total === 0) {
            return res.json({ message: 'Нет данных для сохранения' });
        }
        
        for (const [attributeId, value] of Object.entries(attributes)) {
            const type = attrMap[attributeId];
            if (!type) {
                completed++;
                continue;
            }
            
            let valueText = null, valueNumber = null, valueBoolean = null, valueDate = null;
            
            if (value === '' || value === null || value === undefined) {
                db.query('DELETE FROM attribute_values WHERE attribute_id = ? AND province_id = ?', 
                    [attributeId, provinceId], () => {});
                completed++;
                continue;
            }
            
            switch(type) {
                case 'number':
                    valueNumber = parseFloat(value);
                    if (isNaN(valueNumber)) valueNumber = null;
                    break;
                case 'boolean':
                    valueBoolean = value === true || value === 'true' || value === '1';
                    break;
                case 'date':
                    valueDate = value;
                    break;
                default:
                    valueText = String(value);
            }
            
            db.query(
                `INSERT INTO attribute_values (attribute_id, province_id, value_text, value_number, value_boolean, value_date)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                 value_text = VALUES(value_text),
                 value_number = VALUES(value_number),
                 value_boolean = VALUES(value_boolean),
                 value_date = VALUES(value_date)`,
                [attributeId, provinceId, valueText, valueNumber, valueBoolean, valueDate],
                (err) => {
                    if (err) { console.error(err); hasError = true; }
                    completed++;
                    if (completed === total) {
                        if (hasError) res.status(500).json({ error: 'Часть данных не сохранена' });
                        else res.json({ message: 'Данные сохранены' });
                    }
                }
            );
        }
    });
});

// 10. Получить значения характеристик для провинции
app.get('/api/provinces/:id/attributes', (req, res) => {
    const provinceId = req.params.id;
    
    db.query(`
        SELECT 
            ad.id as attribute_id,
            ad.name,
            ad.label,
            ad.type,
            ad.unit,
            av.id as value_id,
            av.value_text,
            av.value_number,
            av.value_boolean,
            av.value_date
        FROM attribute_definitions ad
        LEFT JOIN attribute_values av ON ad.id = av.attribute_id AND av.province_id = ?
        WHERE ad.is_active = 1
        ORDER BY ad.display_order
    `, [provinceId], (err, results) => {
        if (err) {
            console.error('Ошибка получения значений:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// ==================== ЗАПУСК СЕРВЕРА ====================

app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`📊 Доступные страницы:`);
    console.log(`   - http://localhost:${PORT} - Главная`);
    console.log(`   - http://localhost:${PORT}/login.html - Вход`);
    console.log(`   - http://localhost:${PORT}/register.html - Регистрация`);
    console.log(`   - http://localhost:${PORT}/rating.html - Рейтинг`);
    console.log(`   - http://localhost:${PORT}/economy.html - Экономика`);
    console.log(`   - http://localhost:${PORT}/admin.html - Админ-панель`);
});