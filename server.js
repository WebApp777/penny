const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const USERS_FILE = path.join(__dirname, 'users.json');
const NAV_FILE = path.join(__dirname, 'navigation.json');
const RECORDS_FILE = path.join(__dirname, 'records.json');
const DEVICES_FILE = path.join(__dirname, 'devices.json');
const HISTORY_FILE = path.join(__dirname, 'history.json');

const SECTIONS_DIR = path.join(__dirname, 'sections');
if (!fs.existsSync(SECTIONS_DIR)) fs.mkdirSync(SECTIONS_DIR);

const BACKUP_DIR = path.join(__dirname, 'backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);

if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(
    USERS_FILE,
    JSON.stringify(
      {
        admin: {
          password: 'admin123',
          role: 'admin',
          createdAt: new Date().toISOString(),
        },
        user: {
          password: 'user123',
          role: 'user',
          createdAt: new Date().toISOString(),
        },
      },
      null,
      2
    )
  );
}

if (!fs.existsSync(NAV_FILE)) {
  fs.writeFileSync(
    NAV_FILE,
    JSON.stringify(
      [
        {
          id: 'home',
          label: 'Главная',
          icon: 'home',
          isDefault: true,
          createdBy: 'system',
        },
        {
          id: 'all_devices',
          label: 'Вся техника',
          icon: 'settings',
          isDefault: true,
          createdBy: 'system',
        },
        {
          id: 'statistics',
          label: 'Статистика',
          icon: 'star',
          isDefault: true,
          createdBy: 'system',
        },
      ],
      null,
      2
    )
  );
}

if (!fs.existsSync(RECORDS_FILE))
  fs.writeFileSync(RECORDS_FILE, JSON.stringify([], null, 2));
if (!fs.existsSync(DEVICES_FILE))
  fs.writeFileSync(DEVICES_FILE, JSON.stringify([], null, 2));
if (!fs.existsSync(HISTORY_FILE))
  fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2));

function addHistoryEntry(entry) {
  try {
    const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    entry.id = 'hist_' + Date.now();
    entry.timestamp = new Date().toISOString();
    history.push(entry);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (e) {}
}

function createBackup() {
  const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupFolder = path.join(BACKUP_DIR, date);
  if (!fs.existsSync(backupFolder))
    fs.mkdirSync(backupFolder, { recursive: true });
  const files = [
    'users.json',
    'records.json',
    'devices.json',
    'navigation.json',
    'history.json',
  ];
  files.forEach(file => {
    const src = path.join(__dirname, file);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(backupFolder, file));
  });
  if (fs.existsSync(SECTIONS_DIR)) {
    const backupSectionsDir = path.join(backupFolder, 'sections');
    if (!fs.existsSync(backupSectionsDir)) fs.mkdirSync(backupSectionsDir);
    fs.readdirSync(SECTIONS_DIR).forEach(file => {
      fs.copyFileSync(
        path.join(SECTIONS_DIR, file),
        path.join(backupSectionsDir, file)
      );
    });
  }
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  if (fs.existsSync(BACKUP_DIR)) {
    fs.readdirSync(BACKUP_DIR).forEach(item => {
      const itemPath = path.join(BACKUP_DIR, item);
      try {
        const stats = fs.statSync(itemPath);
        if (stats.mtimeMs < thirtyDaysAgo)
          fs.rmSync(itemPath, { recursive: true, force: true });
      } catch (e) {}
    });
  }
}

setInterval(createBackup, 24 * 60 * 60 * 1000);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// Вспомогательные функции для пагинации и фильтрации
function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    return [];
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function paginateAndFilter(data, query) {
  const page = parseInt(query.page) || 1;
  const limit = Math.min(parseInt(query.limit) || 50, 500);
  const sort = query.sort || 'createdAt';
  const order = query.order || 'desc';
  const search = query.search || '';

  let filtered = [...data];

  // Текстовый поиск по всем полям
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(item => {
      return Object.values(item).some(val =>
        String(val).toLowerCase().includes(q)
      );
    });
  }

  // Фильтрация по конкретным полям (для records)
  if (query.status) filtered = filtered.filter(r => r.status === query.status);
  if (query.importance)
    filtered = filtered.filter(r => r.importance === query.importance);
  if (query.product)
    filtered = filtered.filter(r => r.product === query.product);
  if (query.username)
    filtered = filtered.filter(r => r.username === query.username);
  if (query.serialNumber) {
    const sn = query.serialNumber.toLowerCase();
    filtered = filtered.filter(r => r.serialNumber?.toLowerCase().includes(sn));
  }

  // Сортировка
  filtered.sort((a, b) => {
    let valA = a[sort],
      valB = b[sort];
    if (sort === 'createdAt') {
      valA = new Date(valA);
      valB = new Date(valB);
    }
    if (valA < valB) return order === 'asc' ? -1 : 1;
    if (valA > valB) return order === 'asc' ? 1 : -1;
    return 0;
  });

  const total = filtered.length;
  const start = (page - 1) * limit;
  const paged = filtered.slice(start, start + limit);

  return {
    data: paged,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

function searchDevices(query) {
  const devices = readJSON(DEVICES_FILE);
  const q = (query || '').toLowerCase();
  if (!q) return devices.slice(0, 20);
  const results = [];
  for (const d of devices) {
    if (
      d.serialNumber?.toLowerCase().includes(q) ||
      d.device?.toLowerCase().includes(q) ||
      d.product?.toLowerCase().includes(q)
    ) {
      results.push(d);
      if (results.length >= 20) break;
    }
  }
  return results;
}

function computeStatistics() {
  const devices = readJSON(DEVICES_FILE);
  const records = readJSON(RECORDS_FILE);

  const stats = {
    totalDevices: devices.length,
    totalRecords: records.length,
    completed: records.filter(r => r.completed).length,
    inProgress: records.filter(r => !r.completed).length,
    malfunctions: records.filter(r => r.status === 'malfunction').length,
    moves: records.filter(r => r.status === 'move').length,
    infos: records.filter(r => r.status === 'info').length,

    byProduct: {},
    byStatus: {
      malfunction: { total: 0, completed: 0 },
      move: { total: 0, completed: 0 },
      info: { total: 0, completed: 0 },
      repair: { total: 0, completed: 0 },
      replace: { total: 0, completed: 0 },
      archive: { total: 0, completed: 0 },
    },
    byUser: {},
    warrantyAlerts: [],
  };

  // По изделиям
  devices.forEach(d => {
    if (!stats.byProduct[d.product]) {
      stats.byProduct[d.product] = {
        count: 0,
        records: 0,
        malfunctions: 0,
        moves: 0,
        infos: 0,
      };
    }
    stats.byProduct[d.product].count++;
  });
  records.forEach(r => {
    if (r.product && stats.byProduct[r.product]) {
      stats.byProduct[r.product].records++;
      if (r.status === 'malfunction') stats.byProduct[r.product].malfunctions++;
      if (r.status === 'move') stats.byProduct[r.product].moves++;
      if (r.status === 'info') stats.byProduct[r.product].infos++;
    }
    if (r.status && stats.byStatus[r.status]) {
      stats.byStatus[r.status].total++;
      if (r.completed) stats.byStatus[r.status].completed++;
    }
    if (r.username) {
      if (!stats.byUser[r.username]) {
        stats.byUser[r.username] = {
          total: 0,
          completed: 0,
          inProgress: 0,
          malfunctions: 0,
          moves: 0,
          infos: 0,
        };
      }
      stats.byUser[r.username].total++;
      if (r.completed) stats.byUser[r.username].completed++;
      else stats.byUser[r.username].inProgress++;
      if (r.status === 'malfunction') stats.byUser[r.username].malfunctions++;
      if (r.status === 'move') stats.byUser[r.username].moves++;
      if (r.status === 'info') stats.byUser[r.username].infos++;
    }
  });

  // Гарантии
  const now = new Date();
  const wd = new Date();
  wd.setDate(wd.getDate() + 30);
  devices
    .filter(d => d.warranty)
    .forEach(d => {
      const we = new Date(d.warranty);
      let status = 'active';
      if (we < now) status = 'expired';
      else if (we < wd) status = 'expiring';
      stats.warrantyAlerts.push({
        device: d.device,
        serialNumber: d.serialNumber,
        warranty: d.warranty,
        status,
      });
    });
  stats.warrantyAlerts.sort(
    (a, b) => new Date(a.warranty) - new Date(b.warranty)
  );

  return stats;
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS'
  );
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, 'http://localhost');
  const pathname = parsedUrl.pathname;
  const query = Object.fromEntries(parsedUrl.searchParams);

  // === USERS ===
  if (pathname === '/penny/users') {
    if (req.method === 'GET') {
      const users = readJSON(USERS_FILE);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(users));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', () => {
        try {
          const d = JSON.parse(body);
          const users = readJSON(USERS_FILE);
          if (!d.username || !d.password) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Логин и пароль обязательны' }));
            return;
          }
          if (users[d.username]) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Пользователь существует' }));
            return;
          }
          users[d.username] = {
            password: d.password,
            role: d.role || 'user',
            createdAt: new Date().toISOString(),
          };
          writeJSON(USERS_FILE, users);
          res.writeHead(200);
          res.end(JSON.stringify({ success: true }));
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Неверные данные' }));
        }
      });
      return;
    }
  }

  // === NAVIGATION ===
  if (pathname === '/penny/navigation') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(fs.readFileSync(NAV_FILE, 'utf-8'));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', () => {
        try {
          const nav = JSON.parse(body);
          writeJSON(NAV_FILE, nav);
          res.writeHead(200);
          res.end(JSON.stringify({ success: true }));
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Неверные данные' }));
        }
      });
      return;
    }
  }

  // === RECORDS (с пагинацией) ===
  if (pathname === '/penny/records') {
    if (req.method === 'GET') {
      const records = readJSON(RECORDS_FILE);
      const result = paginateAndFilter(records, query);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', () => {
        try {
          const records = readJSON(RECORDS_FILE);
          const d = JSON.parse(body);
          d.id = 'rec_' + Date.now();
          d.createdAt = new Date().toISOString();
          records.push(d);
          writeJSON(RECORDS_FILE, records);
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, record: d }));
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Неверные данные' }));
        }
      });
      return;
    }
    if (req.method === 'PUT') {
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', () => {
        try {
          const records = readJSON(RECORDS_FILE);
          const d = JSON.parse(body);
          const idx = records.findIndex(r => r.id === d.id);
          if (idx >= 0) {
            records[idx] = { ...records[idx], ...d };
            writeJSON(RECORDS_FILE, records);
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, record: records[idx] }));
          } else {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Не найдено' }));
          }
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Неверные данные' }));
        }
      });
      return;
    }
    if (req.method === 'DELETE') {
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', () => {
        try {
          const { id } = JSON.parse(body);
          let records = readJSON(RECORDS_FILE);
          records = records.filter(r => r.id !== id);
          writeJSON(RECORDS_FILE, records);
          res.writeHead(200);
          res.end(JSON.stringify({ success: true }));
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Ошибка' }));
        }
      });
      return;
    }
  }

  // === DEVICES (с пагинацией) ===
  if (pathname === '/penny/devices') {
    if (req.method === 'GET') {
      const devices = readJSON(DEVICES_FILE);
      const result = paginateAndFilter(devices, query);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', () => {
        try {
          const devices = readJSON(DEVICES_FILE);
          const d = JSON.parse(body);
          d.id = 'dev_' + Date.now();
          d.createdAt = new Date().toISOString();
          devices.push(d);
          writeJSON(DEVICES_FILE, devices);
          addHistoryEntry({
            action: 'create_device',
            serialNumber: d.serialNumber,
            product: d.product,
            device: d.device,
          });
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, device: d }));
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Неверные данные' }));
        }
      });
      return;
    }
    if (req.method === 'PUT') {
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', () => {
        try {
          const devices = readJSON(DEVICES_FILE);
          const d = JSON.parse(body);
          const idx = devices.findIndex(
            dev => dev.serialNumber === d.serialNumber
          );
          if (idx >= 0) {
            devices[idx] = { ...devices[idx], ...d };
            writeJSON(DEVICES_FILE, devices);
            addHistoryEntry({
              action: 'update_device',
              serialNumber: d.serialNumber,
              changes: d,
            });
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, device: devices[idx] }));
          } else {
            d.id = 'dev_' + Date.now();
            d.createdAt = new Date().toISOString();
            devices.push(d);
            writeJSON(DEVICES_FILE, devices);
            addHistoryEntry({
              action: 'create_device',
              serialNumber: d.serialNumber,
              created: true,
            });
            res.writeHead(200);
            res.end(
              JSON.stringify({ success: true, device: d, created: true })
            );
          }
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Неверные данные' }));
        }
      });
      return;
    }
    if (req.method === 'DELETE') {
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', () => {
        try {
          const { id } = JSON.parse(body);
          let devices = readJSON(DEVICES_FILE);
          const deleted = devices.find(d => d.id === id);
          devices = devices.filter(d => d.id !== id);
          writeJSON(DEVICES_FILE, devices);
          if (deleted)
            addHistoryEntry({
              action: 'delete_device',
              serialNumber: deleted.serialNumber,
            });
          res.writeHead(200);
          res.end(JSON.stringify({ success: true }));
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Ошибка' }));
        }
      });
      return;
    }
  }

  // === DEVICE SEARCH (для подсказок) ===
  if (pathname === '/penny/devices/search') {
    if (req.method === 'GET') {
      const results = searchDevices(query.q);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(results));
      return;
    }
  }

  // === STATISTICS ===
  if (pathname === '/penny/statistics') {
    if (req.method === 'GET') {
      const stats = computeStatistics();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(stats));
      return;
    }
  }

  // === HISTORY ===
  if (pathname === '/penny/history') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(fs.readFileSync(HISTORY_FILE, 'utf-8'));
      return;
    }
  }

  // === BACKUP ===
  if (pathname === '/penny/backup') {
    if (req.method === 'POST') {
      createBackup();
      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
      return;
    }
    if (req.method === 'GET') {
      try {
        const files = fs.readdirSync(BACKUP_DIR);
        res.writeHead(200);
        res.end(JSON.stringify(files));
      } catch (e) {
        res.writeHead(200);
        res.end(JSON.stringify([]));
      }
      return;
    }
  }

  // === SECTIONS ===
  if (pathname.startsWith('/penny/sections/')) {
    const sectionId = pathname.split('/penny/sections/')[1].split('?')[0];
    const sectionFile = path.join(SECTIONS_DIR, sectionId + '.json');

    if (req.method === 'DELETE' && query.deleteFile === 'true') {
      try {
        if (fs.existsSync(sectionFile)) fs.unlinkSync(sectionFile);
      } catch (e) {}
      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
      return;
    }
    if (req.method === 'GET') {
      try {
        if (!fs.existsSync(sectionFile)) writeJSON(sectionFile, []);
        res.writeHead(200);
        res.end(fs.readFileSync(sectionFile, 'utf-8'));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Ошибка' }));
      }
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', () => {
        try {
          if (!fs.existsSync(sectionFile)) writeJSON(sectionFile, []);
          const records = readJSON(sectionFile);
          const d = JSON.parse(body);
          d.id = 'sec_rec_' + Date.now();
          d.createdAt = new Date().toISOString();
          records.push(d);
          writeJSON(sectionFile, records);
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, record: d }));
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Неверные данные' }));
        }
      });
      return;
    }
    if (req.method === 'DELETE') {
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', () => {
        try {
          const { id } = JSON.parse(body);
          if (fs.existsSync(sectionFile)) {
            let records = readJSON(sectionFile);
            records = records.filter(r => r.id !== id);
            writeJSON(sectionFile, records);
          }
          res.writeHead(200);
          res.end(JSON.stringify({ success: true }));
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Ошибка' }));
        }
      });
      return;
    }
  }

  // Статические файлы
  let filePath = req.url === '/' ? '/index.html' : pathname;
  filePath = path.join(__dirname, filePath);
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end();
    return;
  }
  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'text/plain';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Сервер Копейка запущен!`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log('👤 admin/admin123 | user/user123');
});

process.on('SIGINT', () => process.exit());
