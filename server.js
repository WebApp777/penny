const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const USERS_FILE = path.join(__dirname, 'users.json');
const NAV_FILE = path.join(__dirname, 'navigation.json');
const RECORDS_FILE = path.join(__dirname, 'records.json');
const DEVICES_FILE = path.join(__dirname, 'devices.json');
const HISTORY_FILE = path.join(__dirname, 'history.json');

// Создаем папки
const SECTIONS_DIR = path.join(__dirname, 'sections');
if (!fs.existsSync(SECTIONS_DIR)) {
    fs.mkdirSync(SECTIONS_DIR);
}

const BACKUP_DIR = path.join(__dirname, 'backups');
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR);
}

// Создаем файлы если их нет
if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify({
        "admin": { "password": "admin123", "role": "admin", "createdAt": new Date().toISOString() },
        "user": { "password": "user123", "role": "user", "createdAt": new Date().toISOString() }
    }, null, 2));
}

if (!fs.existsSync(NAV_FILE)) {
    fs.writeFileSync(NAV_FILE, JSON.stringify([
        { "id": "home", "label": "Главная", "icon": "home", "isDefault": true, "createdBy": "system" },
        { "id": "all_devices", "label": "Вся техника", "icon": "settings", "isDefault": true, "adminOnly": true, "createdBy": "system" },
        { "id": "statistics", "label": "Статистика", "icon": "star", "isDefault": true, "createdBy": "system" }
    ], null, 2));
}

if (!fs.existsSync(RECORDS_FILE)) {
    fs.writeFileSync(RECORDS_FILE, JSON.stringify([], null, 2));
}

if (!fs.existsSync(DEVICES_FILE)) {
    fs.writeFileSync(DEVICES_FILE, JSON.stringify([], null, 2));
}

if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2));
}

// Функция записи в историю
function addHistoryEntry(entry) {
    try {
        const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
        entry.id = 'hist_' + Date.now();
        entry.timestamp = new Date().toISOString();
        history.push(entry);
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    } catch (e) { }
}

// Функция резервного копирования
function createBackup() {
    const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupFolder = path.join(BACKUP_DIR, date);

    // Создаём папку для этого бэкапа
    if (!fs.existsSync(backupFolder)) {
        fs.mkdirSync(backupFolder, { recursive: true });
    }

    // Копируем основные JSON-файлы
    const files = ['users.json', 'records.json', 'devices.json', 'navigation.json', 'history.json'];
    files.forEach(file => {
        const src = path.join(__dirname, file);
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, path.join(backupFolder, file));
        }
    });

    // Копируем пользовательские разделы
    if (fs.existsSync(SECTIONS_DIR)) {
        const backupSectionsDir = path.join(backupFolder, 'sections');
        if (!fs.existsSync(backupSectionsDir)) {
            fs.mkdirSync(backupSectionsDir);
        }
        fs.readdirSync(SECTIONS_DIR).forEach(file => {
            fs.copyFileSync(path.join(SECTIONS_DIR, file), path.join(backupSectionsDir, file));
        });
    }

    // Удаляем старые бэкапы (старше 30 дней)
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    if (fs.existsSync(BACKUP_DIR)) {
        fs.readdirSync(BACKUP_DIR).forEach(item => {
            const itemPath = path.join(BACKUP_DIR, item);
            try {
                const stats = fs.statSync(itemPath);
                if (stats.mtimeMs < thirtyDaysAgo) {
                    fs.rmSync(itemPath, { recursive: true, force: true });
                }
            } catch (e) { }
        });
    }
}

// Автобэкап раз в сутки
setInterval(createBackup, 24 * 60 * 60 * 1000);

const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8'
};

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // API для пользователей
    if (req.url === '/penny/users') {
        if (req.method === 'GET') {
            try {
                const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(users));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Ошибка' }));
            }
            return;
        }
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const d = JSON.parse(body);
                    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
                    if (!d.username || !d.password) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Логин и пароль обязательны' }));
                        return;
                    }
                    if (users[d.username]) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Пользователь существует' }));
                        return;
                    }
                    users[d.username] = { password: d.password, role: d.role || 'user', createdAt: new Date().toISOString() };
                    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Неверные данные' }));
                }
            });
            return;
        }
    }

    // API для навигации
    if (req.url === '/penny/navigation') {
        if (req.method === 'GET') {
            try {
                const nav = JSON.parse(fs.readFileSync(NAV_FILE, 'utf-8'));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(nav));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Ошибка' }));
            }
            return;
        }
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const nav = JSON.parse(body);
                    fs.writeFileSync(NAV_FILE, JSON.stringify(nav, null, 2));
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Неверные данные' }));
                }
            });
            return;
        }
    }

    // API для записей
    if (req.url === '/penny/records') {
        if (req.method === 'GET') {
            try {
                const records = JSON.parse(fs.readFileSync(RECORDS_FILE, 'utf-8'));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(records));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Ошибка' }));
            }
            return;
        }
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const records = JSON.parse(fs.readFileSync(RECORDS_FILE, 'utf-8'));
                    const d = JSON.parse(body);
                    d.id = 'rec_' + Date.now();
                    d.createdAt = new Date().toISOString();
                    records.push(d);
                    fs.writeFileSync(RECORDS_FILE, JSON.stringify(records, null, 2));
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, record: d }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Неверные данные' }));
                }
            });
            return;
        }
        if (req.method === 'PUT') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const records = JSON.parse(fs.readFileSync(RECORDS_FILE, 'utf-8'));
                    const d = JSON.parse(body);
                    const idx = records.findIndex(r => r.id === d.id);
                    if (idx >= 0) {
                        records[idx] = { ...records[idx], ...d };
                        fs.writeFileSync(RECORDS_FILE, JSON.stringify(records, null, 2));
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, record: records[idx] }));
                    } else {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Не найдено' }));
                    }
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Неверные данные' }));
                }
            });
            return;
        }
        if (req.method === 'DELETE') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { id } = JSON.parse(body);
                    let records = JSON.parse(fs.readFileSync(RECORDS_FILE, 'utf-8'));
                    records = records.filter(r => r.id !== id);
                    fs.writeFileSync(RECORDS_FILE, JSON.stringify(records, null, 2));
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Ошибка' }));
                }
            });
            return;
        }
    }

    // API для устройств
    if (req.url === '/penny/devices') {
        if (req.method === 'GET') {
            try {
                const devices = JSON.parse(fs.readFileSync(DEVICES_FILE, 'utf-8'));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(devices));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Ошибка' }));
            }
            return;
        }
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const devices = JSON.parse(fs.readFileSync(DEVICES_FILE, 'utf-8'));
                    const d = JSON.parse(body);
                    d.id = 'dev_' + Date.now();
                    d.createdAt = new Date().toISOString();
                    devices.push(d);
                    fs.writeFileSync(DEVICES_FILE, JSON.stringify(devices, null, 2));
                    addHistoryEntry({ action: 'create_device', serialNumber: d.serialNumber, product: d.product, device: d.device });
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, device: d }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Неверные данные' }));
                }
            });
            return;
        }
        if (req.method === 'PUT') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const devices = JSON.parse(fs.readFileSync(DEVICES_FILE, 'utf-8'));
                    const d = JSON.parse(body);
                    const idx = devices.findIndex(dev => dev.serialNumber === d.serialNumber);
                    if (idx >= 0) {
                        devices[idx] = { ...devices[idx], ...d };
                        fs.writeFileSync(DEVICES_FILE, JSON.stringify(devices, null, 2));
                        addHistoryEntry({ action: 'update_device', serialNumber: d.serialNumber, changes: d });
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, device: devices[idx] }));
                    } else {
                        d.id = 'dev_' + Date.now();
                        d.createdAt = new Date().toISOString();
                        devices.push(d);
                        fs.writeFileSync(DEVICES_FILE, JSON.stringify(devices, null, 2));
                        addHistoryEntry({ action: 'create_device', serialNumber: d.serialNumber, created: true });
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, device: d, created: true }));
                    }
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Неверные данные' }));
                }
            });
            return;
        }
        if (req.method === 'DELETE') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { id } = JSON.parse(body);
                    let devices = JSON.parse(fs.readFileSync(DEVICES_FILE, 'utf-8'));
                    const deleted = devices.find(d => d.id === id);
                    devices = devices.filter(d => d.id !== id);
                    fs.writeFileSync(DEVICES_FILE, JSON.stringify(devices, null, 2));
                    if (deleted) addHistoryEntry({ action: 'delete_device', serialNumber: deleted.serialNumber });
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Ошибка' }));
                }
            });
            return;
        }
    }

    // API для истории
    if (req.url === '/penny/history') {
        if (req.method === 'GET') {
            try {
                const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(history));
            } catch (e) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify([]));
            }
            return;
        }
    }

    // API для бэкапа
    if (req.url === '/penny/backup') {
        if (req.method === 'POST') {
            createBackup();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
            return;
        }
        if (req.method === 'GET') {
            try {
                const files = fs.readdirSync(BACKUP_DIR);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(files));
            } catch (e) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify([]));
            }
            return;
        }
    }

    // API для пользовательских разделов
    if (req.url.startsWith('/penny/sections/')) {
        const sectionId = req.url.split('/penny/sections/')[1].split('?')[0];
        const sectionFile = path.join(SECTIONS_DIR, sectionId + '.json');

        if (req.method === 'DELETE' && req.url.includes('?deleteFile=true')) {
            try { if (fs.existsSync(sectionFile)) fs.unlinkSync(sectionFile); } catch (e) { }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
            return;
        }
        if (req.method === 'GET') {
            try {
                if (!fs.existsSync(sectionFile)) fs.writeFileSync(sectionFile, JSON.stringify([], null, 2));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(fs.readFileSync(sectionFile, 'utf-8'));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Ошибка' }));
            }
            return;
        }
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    if (!fs.existsSync(sectionFile)) fs.writeFileSync(sectionFile, JSON.stringify([], null, 2));
                    const records = JSON.parse(fs.readFileSync(sectionFile, 'utf-8'));
                    const d = JSON.parse(body);
                    d.id = 'sec_rec_' + Date.now();
                    d.createdAt = new Date().toISOString();
                    records.push(d);
                    fs.writeFileSync(sectionFile, JSON.stringify(records, null, 2));
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, record: d }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Неверные данные' }));
                }
            });
            return;
        }
        if (req.method === 'DELETE') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { id } = JSON.parse(body);
                    if (fs.existsSync(sectionFile)) {
                        let records = JSON.parse(fs.readFileSync(sectionFile, 'utf-8'));
                        records = records.filter(r => r.id !== id);
                        fs.writeFileSync(sectionFile, JSON.stringify(records, null, 2));
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Ошибка' }));
                }
            });
            return;
        }
    }

    // Статические файлы
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);
    if (!filePath.startsWith(__dirname)) { res.writeHead(403); res.end(); return; }
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'text/plain';
    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not Found'); }
        else { res.writeHead(200, { 'Content-Type': contentType }); res.end(data); }
    });
});

server.listen(PORT, () => {
    console.log('🚀 Сервер Копейка запущен!');
    console.log(`📍 http://localhost:${PORT}`);
    console.log('👤 admin/admin123 | user/user123');
});

process.on('SIGINT', () => process.exit());