(function () {
  'use strict';

  const API = {
    users: '/penny/users',
    navigation: '/penny/navigation',
    records: '/penny/records',
    devices: '/penny/devices',
    history: '/penny/history',
    backup: '/penny/backup',
  };

  const STATUS_LABELS = {
    malfunction: 'Неисправность',
    info: 'Информация',
    move: 'Перемещение',
    repair: 'Ремонт',
    replace: 'Замена',
    archive: 'Архив',
  };
  // Встроенные SVG-иконки (спрайт лежит в index.html)
  const ICON = name =>
    `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;

  const IMPORTANCE_LABELS = {
    1: '1 - Низкая',
    2: '2 - Средняя',
    3: '3 - Высокая',
  };

  const icons = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
    settings:
      '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>',
    bookmark:
      '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>',
  };

  let navItems = [],
    records = [],
    devices = [],
    currentUser = null,
    currentUserRole = null,
    users = {};
  let editingDeviceId = null;
  let currentTheme = 'dark',
    activeNavId = 'home',
    isPanelExpanded = false,
    editingRecordId = null,
    dateTimeInterval = null;
  let recordsTotal = 0,
    devicesTotal = 0;
  let recordsPage = 1,
    devicesPage = 1;
  let recordsLoading = false,
    devicesLoading = false;
  let recordsAllLoaded = false,
    devicesAllLoaded = false;
  const PAGE_SIZE = 100;
  let deviceSearchCache = {};
  let deviceSearchTimeout = null;

  async function apiGet(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('Ошибка');
    return await r.json();
  }
  async function apiPost(url, data) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await r.json();
    if (!r.ok) throw new Error(result.error || 'Ошибка');
    return result;
  }
  async function apiPut(url, data) {
    const r = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await r.json();
    if (!r.ok) throw new Error(result.error || 'Ошибка');
    return result;
  }
  async function apiDelete(url, data) {
    await fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }

  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML =
      type === 'success' ? ICON('check-circle') + ' ' + message : message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  async function loadData() {
    try {
      users = await apiGet(API.users);
    } catch (e) {
      users = {};
    }
    try {
      navItems = await apiGet(API.navigation);
    } catch (e) {
      navItems = [];
    }
    await loadRecordsPage(1, true);
    await loadDevicesPage(1, true);
  }

  async function loadRecordsPage(page, reset = false) {
    if (recordsLoading) return;
    if (!reset && recordsAllLoaded) return;
    recordsLoading = true;
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', PAGE_SIZE);
      params.set('sort', 'createdAt');
      params.set('order', 'desc');
      const fs = document.getElementById('filterStatus')?.value;
      const fi = document.getElementById('filterImportance')?.value;
      const fp = document.getElementById('filterProduct')?.value;
      const fu = document.getElementById('filterUser')?.value;
      const fsn = document.getElementById('filterSerial')?.value?.trim();
      const ftt = document.getElementById('filterTechType')?.value?.trim();
      const fl = document.getElementById('filterLocation')?.value?.trim();

      // Виртуальные статусы: repair_done → repair + completed,
      // replace_done → replace + completed
      const isVirtualDone = fs === 'repair_done' || fs === 'replace_done';
      const serverStatus =
        fs === 'repair_done'
          ? 'repair'
          : fs === 'replace_done'
            ? 'replace'
            : fs;

      if (serverStatus) params.set('status', serverStatus);
      if (fi) params.set('importance', fi);
      if (fp) params.set('product', fp);
      if (fu) params.set('username', fu);
      if (fsn) params.set('serialNumber', fsn);
      if (ftt) params.set('search', ftt);
      if (fl) {
        const s = params.get('search') || '';
        params.set('search', s + ' ' + fl);
      }
      const result = await apiGet(API.records + '?' + params.toString());

      // Клиентский фильтр для виртуальных статусов
      let data = result.data;
      if (isVirtualDone) {
        data = data.filter(r => r.completed === true);
      }

      if (reset) {
        records = data;
        recordsPage = 1;
      } else {
        records = [...records, ...data];
        recordsPage = page;
      }
      recordsTotal = isVirtualDone ? data.length : result.total;
      recordsAllLoaded = records.length >= recordsTotal;
      recordsLoading = false;
      updateFilterSummary('records');
      if (reset) {
        renderRecordsTable();
        updateUserFilter();
      } else appendRecordsTable(data);
    } catch (e) {
      recordsLoading = false;
    }
  }

  async function loadDevicesPage(page, reset = false) {
    if (devicesLoading) return;
    if (!reset && devicesAllLoaded) return;
    devicesLoading = true;
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', PAGE_SIZE);
      params.set('sort', 'createdAt');
      params.set('order', 'desc');
      const fp = document.getElementById('filterDevProduct')?.value;
      const fd = document.getElementById('filterDevDevice')?.value?.trim();
      const fs = document.getElementById('filterDevSerial')?.value?.trim();
      const fl = document.getElementById('filterDevLocation')?.value?.trim();
      if (fp) params.set('product', fp);
      if (fd) params.set('search', fd);
      if (fs) params.set('search', fs);
      if (fl) params.set('search', fl);
      const result = await apiGet(API.devices + '?' + params.toString());
      if (reset) {
        devices = result.data;
        devicesPage = 1;
      } else {
        devices = [...devices, ...result.data];
        devicesPage = page;
      }
      devicesTotal = result.total;
      devicesAllLoaded = devices.length >= devicesTotal;
      devicesLoading = false;
      updateFilterSummary('devices');
      if (reset) {
        renderDevicesTable();
        updateProductSelect();
        updateDeviceFilterSelects();
      } else appendDevicesTable(result.data);
    } catch (e) {
      devicesLoading = false;
    }
  }

  async function searchDevices(query) {
    if (deviceSearchCache[query]) return deviceSearchCache[query];
    try {
      const result = await apiGet(
        API.devices + '/search?q=' + encodeURIComponent(query)
      );
      deviceSearchCache[query] = result;
      setTimeout(() => {
        delete deviceSearchCache[query];
      }, 30000);
      return result;
    } catch (e) {
      return [];
    }
  }

  async function findDeviceBySerial(serialNumber) {
    if (!serialNumber) return null;
    // Из нескольких устройств с одним серийником берём то, у которого есть изделие
    const pickBest = list => list.find(d => d.product) || list[0] || null;
    // Сначала ищем в уже загруженных
    let dev = pickBest(devices.filter(d => d.serialNumber === serialNumber));
    if (dev && dev.product) return dev;
    // Если нет (или в загруженных нет изделия) — идём на сервер
    try {
      const r = await fetch(
        API.devices + '/search?q=' + encodeURIComponent(serialNumber)
      );
      if (r.ok) {
        const results = await r.json();
        const found = pickBest(
          results.filter(d => d.serialNumber === serialNumber)
        );
        if (found) {
          if (!devices.find(d => d.serialNumber === serialNumber)) {
            devices.push(found);
          }
          return found;
        }
      }
    } catch (e) {}
    return dev;
  }

  function setupSuggestions(inpId, sugId, cb) {
    const inp = document.getElementById(inpId),
      sug = document.getElementById(sugId);
    if (!inp || !sug) return;
    inp.addEventListener('input', function () {
      const v = this.value.trim();
      sug.innerHTML = '';
      if (!v) {
        sug.classList.remove('visible');
        return;
      }
      clearTimeout(deviceSearchTimeout);
      deviceSearchTimeout = setTimeout(async () => {
        const results = await searchDevices(v);
        if (!results.length) {
          sug.classList.remove('visible');
          return;
        }
        sug.innerHTML = '';
        results.forEach(d => {
          const div = document.createElement('div');
          div.className = 'suggestion-item';
          div.innerHTML = `<strong>${escapeHtml(d.serialNumber)}</strong> — ${escapeHtml(d.product)} / ${escapeHtml(d.device)}`;
          div.addEventListener('mousedown', function (e) {
            e.preventDefault();
            cb(d);
            sug.classList.remove('visible');
          });
          sug.appendChild(div);
        });
        sug.classList.add('visible');
      }, 300);
    });
    inp.addEventListener('blur', () =>
      setTimeout(() => sug.classList.remove('visible'), 200)
    );
    inp.addEventListener('focus', function () {
      if (this.value.trim()) this.dispatchEvent(new Event('input'));
    });
  }

  function setupAllSuggestions() {
    setupSuggestions('recordSerial', 'serialSuggestions', d => {
      document.getElementById('recordSerial').value = d.serialNumber;
      document.getElementById('recordType').value = d.device;
      document.getElementById('recordLocation').value = d.location || '';
      const productSelect = document.getElementById('recordProduct');
      if (
        d.product &&
        ![...productSelect.options].some(o => o.value === d.product)
      ) {
        const o = document.createElement('option');
        o.value = d.product;
        o.textContent = d.product;
        productSelect.appendChild(o);
      }
      productSelect.value = d.product;
    });
    setupSuggestions('recordReplaceSerial', 'replaceSerialSuggestions', d => {
      document.getElementById('recordReplaceSerial').value = d.serialNumber;
      document.getElementById('recordReplaceType').value = d.device;
      const replaceProductSelect = document.getElementById(
        'recordReplaceProduct'
      );
      if (
        d.product &&
        ![...replaceProductSelect.options].some(o => o.value === d.product)
      ) {
        const o = document.createElement('option');
        o.value = d.product;
        o.textContent = d.product;
        replaceProductSelect.appendChild(o);
      }
      replaceProductSelect.value = d.product;
    });
    setupSuggestions(
      'editNewDeviceSerial',
      'editNewDeviceSerialSuggestions',
      d => {
        document.getElementById('editNewDeviceSerial').value = d.serialNumber;
        document.getElementById('editNewDeviceType').value = d.device || '';
        document.getElementById('editNewDeviceSP').value = d.spRequisites || '';
        document.getElementById('editNewDeviceLSI').value =
          d.lsiRequisites || '';
      }
    );
  }

  async function saveNavigation() {
    try {
      await apiPost(API.navigation, navItems);
    } catch (e) {
      alert('Ошибка сохранения навигации');
    }
  }

  const loadingScreen = document.getElementById('loadingScreen');
  const authContainer = document.getElementById('authContainer');
  const mainInterface = document.getElementById('mainInterface');
  const sidePanel = document.getElementById('sidePanel');
  const togglePanelBtn = document.getElementById('togglePanelBtn');
  const togglePanelIcon = document.getElementById('togglePanelIcon');
  const navMenu = document.getElementById('navMenu');
  const addNavSection = document.getElementById('addNavSection');
  const userAvatar = document.getElementById('userAvatar');
  const userNameDisplay = document.getElementById('userNameDisplay');
  const userRoleDisplay = document.getElementById('userRoleDisplay');
  const logoutBtn = document.getElementById('logoutBtn');
  const themeToggle = document.getElementById('themeToggle');

  function updateToggleButton() {
    if (isPanelExpanded)
      togglePanelIcon.innerHTML =
        '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>';
    else
      togglePanelIcon.innerHTML =
        '<polyline points="9 18 15 12 9 6"></polyline>';
  }
  function togglePanel() {
    isPanelExpanded = !isPanelExpanded;
    sidePanel.classList.toggle('expanded', isPanelExpanded);
    document.body.classList.toggle('panel-expanded', isPanelExpanded);
    updateToggleButton();
    addNavSection.style.display = isPanelExpanded ? 'block' : 'none';
  }
  togglePanelBtn.addEventListener('click', togglePanel);

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    currentTheme = theme;
    localStorage.setItem('navipro_theme', theme);
    const icon = themeToggle.querySelector('svg');
    if (theme === 'dark')
      icon.innerHTML =
        '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
    else
      icon.innerHTML =
        '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
  }

  function updateUserUI() {
    if (currentUser) {
      userAvatar.textContent = currentUser.charAt(0).toUpperCase();
      userNameDisplay.textContent = currentUser;
      logoutBtn.classList.add('visible');
      userRoleDisplay.textContent =
        currentUserRole === 'admin' ? 'Админ' : 'Пользователь';
      userRoleDisplay.className =
        'user-role' + (currentUserRole === 'admin' ? ' admin' : '');
      document.getElementById('recordUser').value = currentUser;
      document.getElementById('recordRequest').value = getNextRequestNumber();
      updateDateTime();
    } else {
      userAvatar.textContent = 'G';
      userNameDisplay.textContent = 'Гость';
      logoutBtn.classList.remove('visible');
      userRoleDisplay.textContent = '';
      userRoleDisplay.className = 'user-role';
    }
  }

  function updateDateTime() {
    const now = new Date();
    const el = document.getElementById('recordDateTime');
    if (el)
      el.value = now.toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
  }

  function updateProductSelect() {
    const select = document.getElementById('recordProduct');
    if (select) {
      const cv = select.value;
      select.innerHTML = '<option value="">Выберите изделие...</option>';
      [...new Set(devices.map(d => d.product))].sort().forEach(p => {
        const o = document.createElement('option');
        o.value = p;
        o.textContent = p;
        select.appendChild(o);
      });
      select.value = cv;
    }
    const rp = document.getElementById('recordReplaceProduct');
    if (rp) {
      const cv = rp.value;
      rp.innerHTML = '<option value="">Выберите изделие...</option>';
      [...new Set(devices.map(d => d.product))].sort().forEach(p => {
        const o = document.createElement('option');
        o.value = p;
        o.textContent = p;
        rp.appendChild(o);
      });
      rp.value = cv;
    }
    const fp = document.getElementById('filterProduct');
    if (fp) {
      const cv = fp.value;
      fp.innerHTML = '<option value="">Все изделия</option>';
      [...new Set(devices.map(d => d.product))].sort().forEach(p => {
        const o = document.createElement('option');
        o.value = p;
        o.textContent = p;
        fp.appendChild(o);
      });
      fp.value = cv;
    }
  }

  function updateUserFilter() {
    const fu = document.getElementById('filterUser');
    if (!fu) return;
    const cv = fu.value;
    fu.innerHTML = '<option value="">Все пользователи</option>';
    [...new Set(records.map(r => r.username).filter(Boolean))]
      .sort()
      .forEach(u => {
        const o = document.createElement('option');
        o.value = u;
        o.textContent = u;
        fu.appendChild(o);
      });
    fu.value = cv;
  }

  // Сессия: после входа обновление страницы не выкидывает из аккаунта
  // в течение 30 минут (отсчёт от момента входа; вкладка закрыта — сессия сброшена)
  const SESSION_KEY = 'penny_session';
  const SESSION_TTL_MS = 30 * 60 * 1000;
  function saveSession(username) {
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ user: username, loginAt: Date.now() })
      );
    } catch (e) {}
  }
  function clearSession() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }
  function restoreSession() {
    try {
      const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (!s || !s.user || !s.loginAt) return false;
      if (Date.now() - s.loginAt > SESSION_TTL_MS || !users[s.user]) {
        clearSession();
        return false;
      }
      login(s.user);
      return true;
    } catch (e) {
      return false;
    }
  }

  function login(username) {
    const user = users[username];
    currentUser = username;
    currentUserRole = user ? user.role : 'user';
    updateUserUI();
    authContainer.classList.add('hidden');
    mainInterface.classList.add('visible');
    sidePanel.classList.add('expanded');
    document.body.classList.add('panel-expanded');
    isPanelExpanded = true;
    updateToggleButton();
    addNavSection.style.display = 'block';
    document
      .querySelectorAll('.admin-only-btn')
      .forEach(btn =>
        btn.classList.toggle('hidden', currentUserRole !== 'admin')
      );
    updateInstructionsTabs();
    renderNavMenu();
    updateProductSelect();
    initFilters();
    initEditModal();
    initInstructionTabs();
    initDevicesFilters();
    initCreateSectionModal();
    initExportButtons();
    initImportButtons();
    initAddRecordModal();
    initAddDeviceModal();
    initDeviceInfoModal();
    initFilterSummary();
    document.getElementById('recordRequest').value = getNextRequestNumber();
    document.getElementById('homePage').classList.add('active');
    if (dateTimeInterval) clearInterval(dateTimeInterval);
    dateTimeInterval = setInterval(updateDateTime, 1000);
  }

  function logout() {
    clearSession();
    filtersRestored = { records: false, devices: false };
    currentUser = null;
    currentUserRole = null;
    updateUserUI();
    sidePanel.classList.remove('expanded');
    document.body.classList.remove('panel-expanded');
    isPanelExpanded = false;
    updateToggleButton();
    mainInterface.classList.remove('visible');
    authContainer.classList.remove('hidden');
    document
      .querySelectorAll('.admin-only-btn')
      .forEach(btn => btn.classList.add('hidden'));
    if (dateTimeInterval) {
      clearInterval(dateTimeInterval);
      dateTimeInterval = null;
    }
  }

  document.getElementById('loginForm').addEventListener('submit', e => {
    e.preventDefault();
    const u = document.getElementById('loginUser').value.trim();
    const p = document.getElementById('loginPass').value;
    const el = document.getElementById('loginError');
    el.classList.remove('visible');
    if (!u || !p) {
      el.textContent = 'Заполните все поля';
      el.classList.add('visible');
      return;
    }
    const user = users[u];
    if (!user) {
      el.textContent = 'Пользователь не найден';
      el.classList.add('visible');
      return;
    }
    if (user.password !== p) {
      el.textContent = 'Неверный пароль';
      el.classList.add('visible');
      return;
    }
    saveSession(u);
    login(u);
  });

  document
    .getElementById('registerForm')
    .addEventListener('submit', async e => {
      e.preventDefault();
      const u = document.getElementById('regUser').value.trim();
      const p = document.getElementById('regPass').value;
      const pc = document.getElementById('regPassConfirm').value;
      const el = document.getElementById('registerError');
      const sl = document.getElementById('registerSuccess');
      el.classList.remove('visible');
      sl.classList.remove('visible');
      if (!u || !p || !pc) {
        el.textContent = 'Заполните все поля';
        el.classList.add('visible');
        return;
      }
      if (u.length < 3) {
        el.textContent = 'Логин не менее 3 символов';
        el.classList.add('visible');
        return;
      }
      if (p.length < 4) {
        el.textContent = 'Пароль не менее 4 символов';
        el.classList.add('visible');
        return;
      }
      if (p !== pc) {
        el.textContent = 'Пароли не совпадают';
        el.classList.add('visible');
        return;
      }
      try {
        await apiPost(API.users, {
          username: u,
          password: p,
          role: 'user',
        });
        users[u] = {
          password: p,
          role: 'user',
          createdAt: new Date().toISOString(),
        };
        sl.textContent = 'Регистрация успешна!';
        sl.classList.add('visible');
        document.getElementById('regUser').value = '';
        document.getElementById('regPass').value = '';
        document.getElementById('regPassConfirm').value = '';
        setTimeout(() => {
          document
            .querySelectorAll('.auth-tab')
            .forEach(t => t.classList.remove('active'));
          document
            .querySelector('.auth-tab[data-tab="login"]')
            .classList.add('active');
          document.getElementById('loginForm').style.display = 'flex';
          document.getElementById('registerForm').style.display = 'none';
          document.getElementById('loginUser').value = u;
        }, 1500);
      } catch (err) {
        el.textContent = err.message;
        el.classList.add('visible');
      }
    });

  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document
        .querySelectorAll('.auth-tab')
        .forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('loginForm').style.display =
        tab.dataset.tab === 'login' ? 'flex' : 'none';
      document.getElementById('registerForm').style.display =
        tab.dataset.tab === 'register' ? 'flex' : 'none';
    });
  });

  themeToggle.addEventListener('click', () =>
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark')
  );
  logoutBtn.addEventListener('click', e => {
    e.stopPropagation();
    logout();
  });

  function generateId() {
    return 'nav_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }

  function renderNavMenu() {
    navMenu.innerHTML = '';
    const visibleItems = navItems.filter(item => {
      if (item.id === 'instructions' || item.id === 'all_devices') return true;
      if (item.adminOnly && currentUserRole !== 'admin') return false;
      if (item.isDefault) return true;
      if (
        item.isCustom &&
        item.createdBy !== currentUser &&
        currentUserRole !== 'admin'
      )
        return false;
      return true;
    });
    const instructionsItem = {
      id: 'instructions',
      label: 'Инструкции',
      icon: 'bookmark',
      isDefault: true,
    };
    const allItems = [...visibleItems, instructionsItem];
    allItems.forEach(item => {
      const li = document.createElement('li');
      li.className = 'nav-item';
      if (!item.isDefault) li.classList.add('user-added');
      const button = document.createElement('button');
      button.className =
        'nav-link' + (item.id === activeNavId ? ' active' : '');
      button.innerHTML =
        (icons[item.icon] || icons.star) +
        `<span>${escapeHtml(item.label)}</span>`;
      if (!isPanelExpanded) button.title = item.label;
      button.addEventListener('click', () => {
        activeNavId = item.id;
        renderNavMenu();
        document
          .querySelectorAll('.page-content')
          .forEach(p => p.classList.remove('active'));
        if (item.id === 'home')
          document.getElementById('homePage').classList.add('active');
        else if (item.id === 'all_devices') {
          document.getElementById('allDevicesPage').classList.add('active');
          renderDevicesTable();
        } else if (item.id === 'statistics') {
          document.getElementById('statisticsPage').classList.add('active');
          loadStatistics();
        } else if (item.id === 'instructions') {
          document.getElementById('instructionsPage').classList.add('active');
          switchInstructionTab(
            currentUserRole === 'admin' ? 'admin_guide' : 'user_guide'
          );
        } else if (item.isCustom) renderCustomSection(item);
      });
      if (
        !item.isDefault &&
        item.id !== 'instructions' &&
        currentUserRole === 'admin'
      ) {
        const delBtn = document.createElement('button');
        delBtn.className = 'delete-nav-btn';
        delBtn.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        delBtn.addEventListener('click', e => {
          e.stopPropagation();
          deleteNavItem(item.id);
        });
        li.appendChild(delBtn);
      }
      li.appendChild(button);
      navMenu.appendChild(li);
    });
  }

  async function deleteNavItem(navId) {
    const item = navItems.find(i => i.id === navId);
    if (!item || item.isDefault) return;
    if (currentUserRole !== 'admin' && item.createdBy !== currentUser) {
      alert('Вы можете удалять только свои таблицы');
      return;
    }
    if (confirm(`Удалить "${item.label}"?`)) {
      navItems = navItems.filter(i => i.id !== navId);
      await saveNavigation();
      if (item.isCustom) {
        try {
          await fetch('/penny/sections/' + item.id + '?deleteFile=true', {
            method: 'DELETE',
          });
        } catch (e) {}
      }
      const pageEl = document.getElementById('page_' + navId);
      if (pageEl) pageEl.remove();
      if (activeNavId === navId) activeNavId = 'home';
      renderNavMenu();
      document
        .querySelectorAll('.page-content')
        .forEach(p => p.classList.remove('active'));
      document.getElementById('homePage').classList.add('active');
    }
  }

  let tempSectionConfig = { tableColumns: [], fields: [], filters: [] };
  function openCreateSectionModal() {
    document.getElementById('createSectionModal').classList.add('active');
    document.getElementById('sectionName').value = '';
    tempSectionConfig = {
      tableColumns: [
        { id: 'col_1', label: 'Дата', inForm: false, inFilter: false },
        { id: 'col_2', label: 'Статус', inForm: true, inFilter: true },
        {
          id: 'col_3',
          label: 'Серийный номер',
          inForm: true,
          inFilter: true,
        },
      ],
      fields: [],
      filters: [],
    };
    syncFieldsFromColumns();
    syncFiltersFromColumns();
    renderTableColumnsList();
    renderFieldsList();
    renderFiltersList();
    switchConstructorTab('tab-general');
  }
  function closeCreateSectionModal() {
    document.getElementById('createSectionModal').classList.remove('active');
  }
  function switchConstructorTab(tabId) {
    document
      .querySelectorAll('.constructor-tab')
      .forEach(t => t.classList.remove('active'));
    const tab = document.querySelector(`.constructor-tab[data-tab="${tabId}"]`);
    if (tab) tab.classList.add('active');
    document.querySelectorAll('.constructor-content').forEach(c => {
      c.classList.remove('active');
      c.style.display = 'none';
    });
    const content = document.getElementById(tabId);
    if (content) {
      content.classList.add('active');
      content.style.display = 'block';
    }
    if (tabId === 'tab-fields') {
      syncFieldsFromColumns();
      renderFieldsList();
    }
    if (tabId === 'tab-filters') {
      syncFiltersFromColumns();
      renderFiltersList();
    }
    if (tabId === 'tab-table') renderTableColumnsList();
  }
  function syncFieldsFromColumns() {
    const cif = tempSectionConfig.tableColumns.filter(c => c.inForm);
    tempSectionConfig.fields = tempSectionConfig.fields.filter(f =>
      cif.some(c => c.id === f.columnId)
    );
    cif.forEach(c => {
      if (!tempSectionConfig.fields.find(f => f.columnId === c.id))
        tempSectionConfig.fields.push({
          columnId: c.id,
          label: c.label,
          type: 'text',
          required: false,
          hasHint: false,
          options: [],
        });
      else {
        const f = tempSectionConfig.fields.find(f => f.columnId === c.id);
        if (f) f.label = c.label;
      }
    });
  }
  function syncFiltersFromColumns() {
    const cif = tempSectionConfig.tableColumns.filter(c => c.inFilter);
    tempSectionConfig.filters = tempSectionConfig.filters.filter(f =>
      cif.some(c => c.id === f.columnId)
    );
    cif.forEach(c => {
      if (!tempSectionConfig.filters.find(f => f.columnId === c.id))
        tempSectionConfig.filters.push({
          columnId: c.id,
          label: c.label,
          type: 'text',
        });
      else {
        const f = tempSectionConfig.filters.find(f => f.columnId === c.id);
        if (f) f.label = c.label;
      }
    });
  }
  function renderTableColumnsList() {
    const container = document.getElementById('tableColumnsList');
    if (!container) return;
    container.innerHTML = '';
    tempSectionConfig.tableColumns.forEach((c, i) => {
      const card = document.createElement('div');
      card.className = 'field-config-card';
      card.innerHTML = `<div class="field-header"><input type="text" class="field-name-input" value="${c.label}" data-index="${i}"><button type="button" class="remove-field-btn" data-index="${i}">Удалить</button></div><div class="field-options"><label><input type="checkbox" class="column-in-form" data-index="${i}" ${c.inForm ? 'checked' : ''}> В форме</label><label><input type="checkbox" class="column-in-filter" data-index="${i}" ${c.inFilter ? 'checked' : ''}> В фильтре</label></div>`;
      container.appendChild(card);
    });
    container.querySelectorAll('.field-name-input').forEach(inp =>
      inp.addEventListener('input', function () {
        tempSectionConfig.tableColumns[parseInt(this.dataset.index)].label =
          this.value;
      })
    );
    container.querySelectorAll('.remove-field-btn').forEach(btn =>
      btn.addEventListener('click', function () {
        tempSectionConfig.tableColumns.splice(parseInt(this.dataset.index), 1);
        renderTableColumnsList();
      })
    );
    container.querySelectorAll('.column-in-form').forEach(cb =>
      cb.addEventListener('change', function () {
        tempSectionConfig.tableColumns[parseInt(this.dataset.index)].inForm =
          this.checked;
      })
    );
    container.querySelectorAll('.column-in-filter').forEach(cb =>
      cb.addEventListener('change', function () {
        tempSectionConfig.tableColumns[parseInt(this.dataset.index)].inFilter =
          this.checked;
      })
    );
  }
  function renderFieldsList() {
    const container = document.getElementById('fieldsList');
    if (!container) return;
    container.innerHTML = '';
    if (!tempSectionConfig.fields.length) {
      container.innerHTML =
        '<p style="color:var(--text-secondary);text-align:center;padding:1rem;">Нет полей.</p>';
      return;
    }
    tempSectionConfig.fields.forEach((f, i) => {
      const card = document.createElement('div');
      card.className = 'field-config-card';
      card.innerHTML = `<div class="field-header"><span style="font-weight:600;color:var(--text-primary);">${f.label}</span><select class="field-type-select" data-index="${i}"><option value="text" ${f.type === 'text' ? 'selected' : ''}>Текст</option><option value="select" ${f.type === 'select' ? 'selected' : ''}>Список</option><option value="textarea" ${f.type === 'textarea' ? 'selected' : ''}>Много текста</option></select></div><div class="field-options"><label><input type="checkbox" class="field-required" data-index="${i}" ${f.required ? 'checked' : ''}> Обязательное</label><label><input type="checkbox" class="field-hint" data-index="${i}" ${f.hasHint ? 'checked' : ''}> Подсказки</label>${f.type === 'select' ? `<input type="text" class="field-options-input" data-index="${i}" placeholder="Опции через запятую" value="${(f.options || []).join(',')}" style="flex:1;min-width:150px;">` : ''}</div>`;
      container.appendChild(card);
    });
    container.querySelectorAll('.field-type-select').forEach(s =>
      s.addEventListener('change', function () {
        tempSectionConfig.fields[parseInt(this.dataset.index)].type =
          this.value;
        renderFieldsList();
      })
    );
    container.querySelectorAll('.field-required').forEach(cb =>
      cb.addEventListener('change', function () {
        tempSectionConfig.fields[parseInt(this.dataset.index)].required =
          this.checked;
      })
    );
    container.querySelectorAll('.field-hint').forEach(cb =>
      cb.addEventListener('change', function () {
        tempSectionConfig.fields[parseInt(this.dataset.index)].hasHint =
          this.checked;
      })
    );
    container.querySelectorAll('.field-options-input').forEach(inp =>
      inp.addEventListener('input', function () {
        tempSectionConfig.fields[parseInt(this.dataset.index)].options =
          this.value
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
      })
    );
  }
  function renderFiltersList() {
    const container = document.getElementById('filtersList');
    if (!container) return;
    container.innerHTML = '';
    if (!tempSectionConfig.filters.length) {
      container.innerHTML =
        '<p style="color:var(--text-secondary);text-align:center;padding:1rem;">Нет фильтров.</p>';
      return;
    }
    tempSectionConfig.filters.forEach((f, i) => {
      const card = document.createElement('div');
      card.className = 'field-config-card';
      card.innerHTML = `<div class="field-header"><span style="font-weight:600;color:var(--text-primary);">${f.label}</span><select class="filter-type-select" data-index="${i}"><option value="text" ${f.type === 'text' ? 'selected' : ''}>Поиск</option><option value="select" ${f.type === 'select' ? 'selected' : ''}>Список</option></select></div>`;
      container.appendChild(card);
    });
    container.querySelectorAll('.filter-type-select').forEach(s =>
      s.addEventListener('change', function () {
        tempSectionConfig.filters[parseInt(this.dataset.index)].type =
          this.value;
      })
    );
  }
  async function createCustomSection(e) {
    e.preventDefault();
    const name = document.getElementById('sectionName').value.trim();
    if (!name) {
      alert('Введите название');
      return;
    }
    if (!tempSectionConfig.tableColumns.length) {
      alert('Добавьте колонки');
      return;
    }
    const section = {
      id: generateId(),
      label: name,
      icon: document.getElementById('sectionIcon')?.value || 'star',
      isDefault: false,
      createdBy: currentUser,
      isCustom: true,
      config: {
        tableColumns: tempSectionConfig.tableColumns,
        fields: tempSectionConfig.fields,
        filters: tempSectionConfig.filters,
      },
    };
    navItems.push(section);
    await saveNavigation();
    closeCreateSectionModal();
    activeNavId = section.id;
    renderNavMenu();
    renderCustomSection(section);
  }
  function initCreateSectionModal() {
    document
      .getElementById('closeCreateSectionModal')
      ?.addEventListener('click', closeCreateSectionModal);
    document
      .getElementById('cancelCreateSectionBtn')
      ?.addEventListener('click', closeCreateSectionModal);
    document
      .getElementById('createSectionModal')
      ?.addEventListener('click', function (e) {
        if (e.target === this) closeCreateSectionModal();
      });
    document
      .getElementById('createSectionForm')
      ?.addEventListener('submit', createCustomSection);
    document.querySelectorAll('.constructor-tab').forEach(t =>
      t.addEventListener('click', function () {
        switchConstructorTab(this.dataset.tab);
      })
    );
    const addColumnBtn = document.getElementById('addColumnBtn');
    if (addColumnBtn) {
      const newBtn = addColumnBtn.cloneNode(true);
      addColumnBtn.parentNode.replaceChild(newBtn, addColumnBtn);
      newBtn.addEventListener('click', () => {
        tempSectionConfig.tableColumns.push({
          id: 'col_' + Date.now(),
          label: 'Новая колонка',
          inForm: true,
          inFilter: false,
        });
        renderTableColumnsList();
      });
    }
  }

  function renderCustomSection(section) {
    const existing = document.getElementById('page_' + section.id);
    if (existing) {
      document
        .querySelectorAll('.page-content')
        .forEach(p => p.classList.remove('active'));
      existing.classList.add('active');
      return;
    }
    const config = section.config || {},
      tc = config.tableColumns || [],
      flds = config.fields || [],
      flts = config.filters || [];
    const div = document.createElement('div');
    div.className = 'page-content active' + (tc.length ? ' fill-page' : '');
    div.id = 'page_' + section.id;
    let fh = '';
    flds.forEach(f => {
      const req = f.required ? ' *' : '',
        ra = f.required ? 'required' : '';
      if (f.type === 'select')
        fh += `<div class="form-group"><label>${f.label}${req}</label><select class="custom-field" data-field="${f.columnId}" ${ra}><option value="">Выберите...</option>${(f.options || []).map(o => `<option value="${o}">${o}</option>`).join('')}</select></div>`;
      else if (f.type === 'textarea')
        fh += `<div class="form-group" style="grid-column:1/-1;"><label>${f.label}${req}</label><textarea class="custom-field" data-field="${f.columnId}" rows="2" ${ra}></textarea></div>`;
      else
        fh += `<div class="form-group"><label>${f.label}${req}</label><input type="text" class="custom-field" data-field="${f.columnId}" ${ra}></div>`;
    });
    let flh = '';
    flts.forEach(f => {
      if (f.type === 'select')
        flh += `<select class="custom-filter" data-field="${f.columnId}"><option value="">${f.label}</option></select>`;
      else
        flh += `<input type="text" class="custom-filter" data-field="${f.columnId}" placeholder="${f.label}...">`;
    });
    if (flts.length)
      flh +=
        '<button class="reset-filters-btn custom-reset-filters">' +
        ICON('refresh') +
        ' Сбросить</button>';
    flh +=
      '<button class="export-btn custom-export-btn">' +
      ICON('download') +
      ' Экспорт CSV</button>';
    let th = '';
    tc.forEach(c => (th += `<th>${c.label}</th>`));
    th += '<th>Действ.</th>';
    div.innerHTML = `<div class="content-card"><span class="badge">${ICON('clipboard')} ${escapeHtml(section.createdBy)}</span><h1>${escapeHtml(section.label)}</h1>${flds.length ? `<form class="record-form custom-record-form">${fh}<button type="submit" class="submit-btn">Добавить</button></form>` : ''}${tc.length ? `<h2>Таблица</h2>${flts.length ? `<div class="filter-bar custom-filter-bar">${flh}</div>` : ''}<div class="table-container"><table><thead><tr>${th}</tr></thead><tbody class="custom-table-body" id="tbody_${section.id}"><tr><td colspan="${tc.length + 1}" class="no-records">Нет записей</td></tr></tbody></table></div>` : ''}</div>`;
    document.querySelector('.main-content').appendChild(div);
    const form = div.querySelector('.custom-record-form');
    if (form)
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const rd = {
          username: currentUser,
          sectionId: section.id,
          customFields: {},
          createdAt: new Date().toISOString(),
        };
        let err = false;
        flds.forEach(f => {
          const inp = form.querySelector(`[data-field="${f.columnId}"]`);
          if (f.required && inp && !inp.value.trim()) {
            alert(`Поле "${f.label}" обязательно`);
            err = true;
          }
          if (inp) rd.customFields[f.columnId] = inp.value.trim();
        });
        if (err) return;
        try {
          const r = await fetch('/penny/sections/' + section.id, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rd),
          });
          if (!r.ok) throw new Error('');
          const result = await r.json();
          form.reset();
          renderCustomTableBody(section, result.record);
          showToast('Запись успешно добавлена');
        } catch (ex) {
          alert('Ошибка');
        }
      });
    const expBtn = div.querySelector('.custom-export-btn');
    if (expBtn)
      expBtn.addEventListener('click', async () => {
        try {
          const r = await fetch('/penny/sections/' + section.id);
          if (!r.ok) return;
          const data = await r.json();
          const cols = tc.map(c => ({ id: c.id, label: c.label }));
          exportToCSV(
            data.map(r => {
              const row = {};
              cols.forEach(c => {
                row[c.id] =
                  r.customFields && r.customFields[c.id]
                    ? r.customFields[c.id]
                    : '';
              });
              return row;
            }),
            cols,
            section.label + '_' + new Date().toISOString().slice(0, 10)
          );
        } catch (e) {}
      });
    loadCustomSectionRecords(section);
  }
  async function loadCustomSectionRecords(section) {
    try {
      const r = await fetch('/penny/sections/' + section.id);
      if (!r.ok) return;
      const data = await r.json();
      const tb = document.getElementById('tbody_' + section.id);
      if (tb && data.length) {
        const nr = tb.querySelector('.no-records');
        if (nr) tb.innerHTML = '';
      }
      data.forEach(rec => renderCustomTableBody(section, rec));
    } catch (e) {}
  }
  function renderCustomTableBody(section, record) {
    const tb = document.getElementById('tbody_' + section.id);
    if (!tb) return;
    const nr = tb.querySelector('.no-records');
    if (nr) tb.innerHTML = '';
    const tc = section.config?.tableColumns || [];
    const tr = document.createElement('tr');
    let rh = '';
    tc.forEach(c => {
      let v = '-';
      if (record.customFields?.[c.id])
        v = escapeHtml(record.customFields[c.id]);
      if (c.id === 'col_1' && record.createdAt)
        v = new Date(record.createdAt).toLocaleString('ru-RU');
      rh += `<td>${v}</td>`;
    });
    rh += '<td><button class="delete-btn">' + ICON('trash') + '</button></td>';
    tr.innerHTML = rh;
    tr.querySelector('.delete-btn')?.addEventListener('click', async () => {
      if (confirm('Удалить?')) {
        try {
          await fetch('/penny/sections/' + section.id, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: record.id }),
          });
          tr.remove();
          if (!tb.children.length)
            tb.innerHTML = `<tr><td colspan="${tc.length + 1}" class="no-records">Нет записей</td></tr>`;
        } catch (e) {}
      }
    });
    tb.appendChild(tr);
  }

  function setupStatusChange() {
    const statusSelect = document.getElementById('recordStatus');
    if (!statusSelect) return;
    const allConditionalFields = [
      'newLocationField',
      'malfunctionDateField',
      'brokenLocationField',
      'recoveryDateField',
      'replaceTitleField',
      'replaceSerialField',
      'replaceProductField',
      'replaceTypeField',
      'replaceLocationField',
    ];
    statusSelect.addEventListener('change', function () {
      const st = this.value;
      allConditionalFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('visible');
      });
      const replaceTitle = document.getElementById('replaceTitleField');
      if (replaceTitle) replaceTitle.style.display = 'none';
      const locationInput = document.getElementById('recordLocation');
      if (locationInput) {
        locationInput.removeAttribute('readonly');
        locationInput.style.opacity = '';
        locationInput.style.cursor = '';
      }
      if (st === 'move') {
        document.getElementById('newLocationField')?.classList.add('visible');
      }
      if (st === 'malfunction') {
        [
          'malfunctionDateField',
          'brokenLocationField',
          'recoveryDateField',
          'replaceSerialField',
          'replaceProductField',
          'replaceTypeField',
          'replaceLocationField',
        ].forEach(id => {
          document.getElementById(id)?.classList.add('visible');
        });
        if (replaceTitle) replaceTitle.style.display = 'block';
        if (locationInput) locationInput.setAttribute('readonly', 'readonly');
      }
    });
  }

  setupAllSuggestions();
  setupStatusChange();

  function getSerialDisplay(r) {
    return escapeHtml(r.serialNumber);
  }
  function getTypeDisplay(r) {
    return escapeHtml(r.techType || '-');
  }
  function getLocationDisplay(r) {
    let d = escapeHtml(r.location || '-');
    if (r.status === 'move' && r.newLocation)
      d += ` → <span style="color:var(--accent);">${escapeHtml(r.newLocation)}</span>`;
    return d;
  }

  function renderRecordsTable() {
    const tb = document.getElementById('recordsTableBody');
    if (!tb) return;
    tb.innerHTML = '';
    if (!records.length) {
      tb.innerHTML =
        '<tr><td colspan="11" class="no-records">Нет записей</td></tr>';
      return;
    }
    records.forEach(r => renderRecordRow(r, tb));
    if (!recordsAllLoaded) {
      const tr = document.createElement('tr');
      tr.id = 'recordsLoader';
      tr.innerHTML =
        '<td colspan="11" style="text-align:center;padding:1rem;color:var(--text-secondary);">Загрузка...</td>';
      tb.appendChild(tr);
    }
  }

  function renderRecordRow(r, tb) {
    const tr = document.createElement('tr');
    if (r.status === 'repair' && !r.completed) tr.classList.add('repair-row');
    else if (r.status === 'replace') tr.classList.add('repair-row');
    else if (r.status === 'archive') tr.classList.add('archive-row');
    else if (r.completed || r.status === 'info' || r.status === 'move')
      tr.classList.add('completed');
    else if (r.status === 'malfunction')
      tr.style.background = 'rgba(255,71,87,0.2)';
    const isMalfunctionActive = r.status === 'malfunction' && !r.completed;
    const isRepairActive = r.status === 'repair' && !r.completed;
    const isReplaceActive = r.status === 'replace' && !r.completed;
    const hasSolution = isMalfunctionActive || isRepairActive;
    const showComplete =
      isReplaceActive ||
      (!hasSolution && !r.completed && r.status !== 'archive');
    const statusLabel =
      r.completed && r.status === 'repair'
        ? 'Ремонт (выполнено)'
        : r.completed && r.status === 'replace'
          ? 'Замена (выполнено)'
          : STATUS_LABELS[r.status] || r.status || '-';
    const statusKey =
      r.completed && (r.status === 'repair' || r.status === 'replace')
        ? r.status + '_done'
        : r.status || 'info';
    const impKey = [1, 2, 3].includes(Number(r.importance))
      ? Number(r.importance)
      : 2;
    const completedDateSrc = r.fullRecoveryDate || r.completedAt || r.createdAt;
    tr.innerHTML = `<td>${new Date(r.createdAt).toLocaleDateString('ru-RU')}<br>${new Date(r.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td><td>${escapeHtml(r.username)}</td><td>${escapeHtml(r.requestNumber || '-')}</td><td><span class="imp-badge imp-${impKey}">${IMPORTANCE_LABELS[r.importance] || '2-Средняя'}</span></td><td><span class="status-badge status-${statusKey}">${statusLabel}</span></td><td><a href="javascript:void(0)" onclick="openDeviceInfoModal('${escapeHtml(r.serialNumber)}')" class="serial-link">${getSerialDisplay(r)}</a></td><td>${escapeHtml(r.product || '-')}</td><td>${getTypeDisplay(r)}</td><td>${getLocationDisplay(r)}</td><td title="${escapeHtml(r.description || '')}"><div class="cell-clamp">${escapeHtml(r.description || '-')}</div></td><td><div class="action-buttons">${hasSolution ? `<button class="solution-btn" title="Решение">Решение ▼</button>` : ''}${r.completed && r.status !== 'repair' && r.status !== 'replace' ? `<span class="completed-time">${ICON('check')} ${new Date(completedDateSrc).toLocaleDateString('ru-RU')}<br>${new Date(completedDateSrc).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>` : r.completed && (r.status === 'repair' || r.status === 'replace') ? `<span class="completed-time">${ICON('check')} ${new Date(completedDateSrc).toLocaleDateString('ru-RU')}<br>${new Date(completedDateSrc).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>` : showComplete ? `<button class="complete-btn" title="Выполнено">${ICON('check')}</button>` : ''}<button class="edit-btn" title="Редактировать">${ICON('pencil')}</button><button class="delete-btn" title="Удалить">${ICON('trash')}</button></div></td>`;
    if (showComplete)
      tr.querySelector('.complete-btn')?.addEventListener('click', () => {
        if (r.status === 'replace') {
          openEditModalWithStatus(r.id, 'replace_done');
        } else {
          completeRecord(r.id);
        }
      });
    tr.querySelector('.edit-btn')?.addEventListener('click', () =>
      openEditModal(r.id)
    );
    tr.querySelector('.delete-btn')?.addEventListener('click', () =>
      deleteRecord(r.id)
    );
    const solBtn = tr.querySelector('.solution-btn');
    if (solBtn)
      solBtn.addEventListener('click', e => {
        e.stopPropagation();
        showSolutionMenu(solBtn, r.id, r.status);
      });
    tb.appendChild(tr);
  }

  function appendRecordsTable(newRecords) {
    const tb = document.getElementById('recordsTableBody');
    if (!tb) return;
    const loader = document.getElementById('recordsLoader');
    if (loader) loader.remove();
    newRecords.forEach(r => renderRecordRow(r, tb));
    if (!recordsAllLoaded) {
      const tr = document.createElement('tr');
      tr.id = 'recordsLoader';
      tr.innerHTML =
        '<td colspan="11" style="text-align:center;padding:1rem;color:var(--text-secondary);">Загрузка...</td>';
      tb.appendChild(tr);
    }
  }

  function showSolutionMenu(btn, recordId, currentStatus) {
    closeSolutionMenu();
    const menu = document.createElement('div');
    menu.className = 'solution-menu visible';
    menu.id = 'activeSolutionMenu';
    let options = [];
    if (currentStatus === 'malfunction') {
      options = [
        ['Ремонт', 'repair'],
        ['Замена', 'replace'],
        ['Архив', 'archive'],
      ];
    } else if (currentStatus === 'repair') {
      options = [
        ['Выполнено', 'repair_done'],
        ['Замена', 'replace'],
        ['Архив', 'archive'],
      ];
    }
    options.forEach(([label, status]) => {
      const item = document.createElement('button');
      item.className = 'solution-menu-item';
      item.textContent = label;
      item.addEventListener('click', e => {
        e.stopPropagation();
        closeSolutionMenu();
        openEditModalWithStatus(recordId, status);
      });
      menu.appendChild(item);
    });
    btn.parentElement.appendChild(menu);
    setTimeout(() => {
      document.addEventListener('click', closeSolutionMenu, {
        once: true,
      });
    }, 0);
  }
  window.showSolutionMenu = showSolutionMenu;

  function closeSolutionMenu() {
    const menu = document.getElementById('activeSolutionMenu');
    if (menu) menu.remove();
  }
  window.closeSolutionMenu = closeSolutionMenu;

  function openEditModalWithStatus(id, status) {
    openEditModal(id);
    document.getElementById('editStatus').value = status;
    if (status === 'repair_done' || status === 'replace_done') {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      document.getElementById('editFullRecoveryDate').value = now
        .toISOString()
        .slice(0, 16);
    }
    updateEditModalConditionalFields();
  }

  async function addRecord(data) {
    try {
      await apiPost(API.records, data);
      await loadRecordsPage(1, true);
      await loadStatistics();
      return true;
    } catch (e) {
      alert('Ошибка');
      return false;
    }
  }

  // Актуальное устройство с сервера (не из кэша браузера)
  async function getDeviceFresh(serial) {
    const r = await fetch(
      API.devices + '/search?q=' + encodeURIComponent(serial)
    );
    if (!r.ok) throw new Error('Ошибка поиска устройства');
    const list = (await r.json()).filter(d => d.serialNumber === serial);
    return list.find(d => d.product) || list[0] || null;
  }

  // Изменения устройств и сохранение заявки — одна операция.
  // changes: { serialNumber, fields } — изменить поля устройства
  //          { create } — создать устройство
  // Сначала применяются изменения устройств, потом сохраняется заявка.
  // Если что-то не удалось, уже сделанные изменения устройств откатываются,
  // и пользователь видит сообщение — расхождений между заявкой и устройством нет.
  async function saveWithDeviceChanges(changes, saveRecord) {
    const undo = [];
    const rollback = async () => {
      let failed = false;
      for (const fn of undo.reverse()) {
        try {
          await fn();
        } catch (e) {
          failed = true;
        }
      }
      return !failed;
    };
    const jsonHeaders = { 'Content-Type': 'application/json' };
    try {
      for (const ch of changes) {
        if (ch.create) {
          const r = await fetch(API.devices, {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify(ch.create),
          });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error('Не удалось создать устройство');
          const newId = j.device && j.device.id;
          if (newId) undo.push(() => apiDelete(API.devices, { id: newId }));
        } else {
          const cur = await getDeviceFresh(ch.serialNumber);
          if (!cur) continue; // устройства нет — менять нечего
          const prev = { serialNumber: ch.serialNumber };
          Object.keys(ch.fields).forEach(k => (prev[k] = cur[k] || ''));
          const r = await fetch(API.devices, {
            method: 'PUT',
            headers: jsonHeaders,
            body: JSON.stringify({
              serialNumber: ch.serialNumber,
              ...ch.fields,
            }),
          });
          if (!r.ok) throw new Error('Не удалось обновить устройство');
          undo.push(async () => {
            const rr = await fetch(API.devices, {
              method: 'PUT',
              headers: jsonHeaders,
              body: JSON.stringify(prev),
            });
            if (!rr.ok) throw new Error('rollback');
          });
        }
      }
    } catch (e) {
      const ok = await rollback();
      alert(
        'Не удалось обновить данные устройства. Заявка не сохранена.' +
          (ok ? '' : ' Проверьте данные устройства в «Вся техника».')
      );
      return false;
    }
    let saved = false;
    try {
      saved = await saveRecord();
    } catch (e) {
      saved = false;
    }
    if (!saved) {
      const ok = await rollback();
      if (!ok)
        alert(
          'Заявка не сохранена, но данные устройства могли измениться. Проверьте «Вся техника».'
        );
      return false;
    }
    return true;
  }

  // Все заявки по серийному номеру — с сервера, а не из списка в браузере
  // (там только загруженная страница и с учётом выбранных фильтров)
  async function fetchAllRecordsBySerial(serial) {
    const all = [];
    for (let page = 1; ; page++) {
      const r = await apiGet(
        `${API.records}?serialNumber=${encodeURIComponent(serial)}&limit=500&page=${page}&sort=createdAt&order=asc`
      );
      all.push(...r.data);
      if (page >= r.totalPages) break;
    }
    return all.filter(x => x.serialNumber === serial);
  }

  // Расположение, которое устройству задаёт заявка:
  // Перемещение — новое расположение, Неисправность и её продолжения — brokenLocation
  function recordSetsLocation(r) {
    if (r.status === 'move') return r.newLocation || '';
    return r.brokenLocation || '';
  }

  async function deleteRecord(id) {
    if (!confirm('Удалить?')) return;
    const rec = records.find(r => r.id === id);
    const deletedLocation = rec ? recordSetsLocation(rec) : '';

    // Расположение пересчитываем по полному списку заявок устройства
    // (до удаления, пока сервер доступен для чтения)
    let restoreTo = null;
    if (rec && rec.serialNumber && deletedLocation) {
      try {
        const others = (await fetchAllRecordsBySerial(rec.serialNumber)).filter(
          r => r.id !== id
        );
        const at = r => new Date(r.createdAt).getTime();
        const events = others
          .filter(r => recordSetsLocation(r))
          .sort((a, b) => at(a) - at(b));
        // Если есть более поздняя заявка, задающая расположение, — устройство
        // уже находится там, откатывать нечего
        const hasLater = events.some(r => at(r) > at(rec));
        if (!hasLater) {
          const before = events.filter(r => at(r) < at(rec));
          if (before.length) {
            restoreTo = recordSetsLocation(before[before.length - 1]);
          } else if (others.length) {
            // Заявок с расположением раньше нет — берём расположение
            // из самой ранней заявки устройства
            const first = [...others].sort((a, b) => at(a) - at(b))[0];
            restoreTo = first.location || null;
          }
        }
      } catch (e) {
        showToast('Расположение устройства не пересчитано', 'error');
      }
    }

    try {
      await apiDelete(API.records, { id });
      if (restoreTo) {
        try {
          await fetch(API.devices, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              serialNumber: rec.serialNumber,
              location: restoreTo,
            }),
          });
        } catch (e) {}
      }
      await loadRecordsPage(1, true);
      await loadDevicesPage(1, true);
      await loadStatistics();
    } catch (e) {}
  }

  async function completeRecord(id) {
    const rec = records.find(r => r.id === id);
    if (!rec) return;
    rec.completed = true;
    rec.completedAt = new Date().toISOString();
    try {
      await fetch(API.records, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          completed: true,
          completedAt: rec.completedAt,
        }),
      });
      showToast('Заявка отмечена как выполненная');
      await loadRecordsPage(1, true);
      await loadStatistics();
    } catch (e) {}
  }

  function initAddRecordModal() {
    const openBtn = document.getElementById('openAddRecordModal');
    if (openBtn) {
      const newBtn = openBtn.cloneNode(true);
      openBtn.parentNode.replaceChild(newBtn, openBtn);
      newBtn.addEventListener('click', openAddRecordModal);
    }
    document
      .getElementById('closeAddRecordModal')
      ?.addEventListener('click', closeAddRecordModal);
    document
      .getElementById('addRecordModalOverlay')
      ?.addEventListener('click', function (e) {
        if (e.target === this) closeAddRecordModal();
      });
    const form = document.getElementById('addRecordForm');
    if (form) {
      const newForm = form.cloneNode(true);
      form.parentNode.replaceChild(newForm, form);
      document
        .getElementById('cancelAddRecordBtn')
        ?.addEventListener('click', closeAddRecordModal);
      newForm.addEventListener('submit', async e => {
        e.preventDefault();
        newForm
          .querySelectorAll('.error')
          .forEach(el => el.classList.remove('error'));
        const st = document.getElementById('recordStatus').value;
        const sn = document.getElementById('recordSerial').value.trim();
        const pr = document.getElementById('recordProduct').value;
        const tt = document.getElementById('recordType').value.trim();
        const loc = document.getElementById('recordLocation').value.trim();
        const nl =
          st === 'move'
            ? document.getElementById('recordNewLocation').value.trim()
            : '';
        const desc = document.getElementById('recordDescription').value.trim();
        const mDate =
          st === 'malfunction'
            ? document.getElementById('recordMalfunctionDate')?.value || ''
            : '';
        const brokenLoc =
          st === 'malfunction'
            ? document.getElementById('recordBrokenLocation')?.value.trim() ||
              ''
            : '';
        const recDate =
          st === 'malfunction'
            ? document.getElementById('recordRecoveryDate')?.value || ''
            : '';
        const repSN =
          st === 'malfunction'
            ? document.getElementById('recordReplaceSerial')?.value.trim() || ''
            : '';
        const repPr =
          st === 'malfunction'
            ? document.getElementById('recordReplaceProduct')?.value || ''
            : '';
        const repTT =
          st === 'malfunction'
            ? document.getElementById('recordReplaceType')?.value.trim() || ''
            : '';
        const repLoc =
          st === 'malfunction'
            ? document.getElementById('recordReplaceLocation')?.value.trim() ||
              ''
            : '';
        if (!st) {
          alert('Выберите статус');
          return;
        }

        // Для Перемещения с новым серийником изделие не участвует.
        // Определяем, найден ли серийник в базе заранее.
        let existingDevice = null;
        if (sn) {
          existingDevice = await findDeviceBySerial(sn);
        }
        const isNewSerialForMove = st === 'move' && sn && !existingDevice;
        const isNewSerialForInfo = st === 'info' && sn && !existingDevice;

        // Проверка серийника/изделия:
        // - Серийник есть в базе → изделие обязано совпадать (для всех статусов).
        // - Серийника нет в базе (устройство не наше):
        //   * Неисправность → ошибка «не найден в базе».
        //   * Перемещение / Информация → допускается только БЕЗ изделия.
        if (sn && existingDevice) {
          if (pr && existingDevice.product && existingDevice.product !== pr) {
            alert(
              `Серийный номер "${sn}" принадлежит изделию "${existingDevice.product}", а не "${pr}".`
            );
            document.getElementById('recordSerial').classList.add('error');
            document.getElementById('recordProduct').classList.add('error');
            return;
          }
        } else if (sn && !existingDevice) {
          if (st === 'malfunction') {
            alert(`Серийный номер "${sn}" не найден в базе.`);
            document.getElementById('recordSerial').classList.add('error');
            return;
          }
          // Для move/info с новым серийником изделие не допускается
          // (проверка ниже).
        }

        // Устройство считается «в базе», только если оно есть в «Вся техника»
        // (у него указано изделие). Устройства не из базы («левые») можно
        // вести в заявках только без изделия.
        const existingInBase = Boolean(
          existingDevice &&
          existingDevice.product &&
          String(existingDevice.product).trim()
        );
        if (sn && !existingInBase && pr && (st === 'info' || st === 'move')) {
          alert(
            `Серийного номера "${sn}" нет в базе (Вся техника). Для устройств не из базы изделие не выбирается.`
          );
          document.getElementById('recordSerial').classList.add('error');
          document.getElementById('recordProduct').classList.add('error');
          return;
        }
        if (st === 'malfunction' && sn && existingDevice && !existingInBase) {
          alert(`Серийный номер "${sn}" не найден в базе.`);
          document.getElementById('recordSerial').classList.add('error');
          return;
        }

        // Серийник, который есть в базе «Вся техника» (у устройства указано
        // изделие), нельзя использовать в заявке Информация/Перемещение
        // без выбора изделия.
        if ((st === 'info' || st === 'move') && sn && existingInBase && !pr) {
          alert(
            `Серийный номер "${sn}" есть в базе (изделие "${existingDevice.product}"). Выберите изделие.`
          );
          document.getElementById('recordSerial').classList.add('error');
          document.getElementById('recordProduct').classList.add('error');
          return;
        }

        const deviceChanges = [];
        let hasError = false;
        if (st === 'move') {
          if (!sn) {
            document.getElementById('recordSerial').classList.add('error');
            hasError = true;
          }
          // pr обязателен ТОЛЬКО если серийник есть в базе «Вся техника»
          if (existingInBase && !pr) {
            document.getElementById('recordProduct').classList.add('error');
            hasError = true;
          }
          if (!tt) {
            document.getElementById('recordType').classList.add('error');
            hasError = true;
          }
          if (!nl) {
            document.getElementById('recordNewLocation').classList.add('error');
            hasError = true;
          }
          if (hasError) {
            alert('Заполните обязательные поля (выделены красным)');
            return;
          }

          if (existingDevice) {
            // Устройство есть — обновляем расположение
            deviceChanges.push({
              serialNumber: sn,
              fields: { location: nl },
            });
          } else {
            // Серийник новый — создаём устройство с пустым product
            deviceChanges.push({
              create: {
                product: '',
                device: tt,
                serialNumber: sn,
                supplyBasis: '',
                spRequisites: '',
                lsiRequisites: '',
                location: nl,
                specs: '',
                notes: '',
                warranty: '',
              },
            });
          }
        }
        if (st === 'malfunction') {
          if (!mDate) {
            document
              .getElementById('recordMalfunctionDate')
              .classList.add('error');
            hasError = true;
          }
          if (!sn) {
            document.getElementById('recordSerial').classList.add('error');
            hasError = true;
          }
          if (!pr) {
            document.getElementById('recordProduct').classList.add('error');
            hasError = true;
          }
          if (!tt) {
            document.getElementById('recordType').classList.add('error');
            hasError = true;
          }
          if (!desc) {
            document.getElementById('recordDescription').classList.add('error');
            hasError = true;
          }
          if (!loc) {
            document.getElementById('recordLocation').classList.add('error');
            hasError = true;
          }
          if (hasError) {
            alert('Заполните обязательные поля (выделены красным)');
            return;
          }

          // Серийник гарантированно в базе (проверено выше).
          if (brokenLoc) {
            deviceChanges.push({
              serialNumber: sn,
              fields: { location: brokenLoc },
            });
          }
          if (repSN && repLoc) {
            const repDev = await findDeviceBySerial(repSN);
            if (repDev) {
              deviceChanges.push({
                serialNumber: repSN,
                fields: { location: repLoc },
              });
            }
          }
        }
        const data = {
          username: currentUser,
          requestNumber: document.getElementById('recordRequest').value.trim(),
          importance: document.getElementById('recordImportance').value,
          status: st,
          serialNumber: sn,
          newSerialNumber: '',
          product: pr,
          techType: tt,
          newTechType: '',
          location: loc,
          newLocation: nl,
          description: desc,
          newSPRequisites: '',
          newLSIRequisites: '',
          malfunctionDate: mDate,
          brokenLocation: brokenLoc,
          recoveryDate: recDate,
          replaceSerial: repSN,
          replaceProduct: repPr,
          replaceType: repTT,
          replaceLocation: repLoc,
          completed: st === 'info' || st === 'move',
        };
        if (await saveWithDeviceChanges(deviceChanges, () => addRecord(data))) {
          showToast('Запись успешно добавлена');
          document.getElementById('recordSerial').value = '';
          document.getElementById('recordProduct').value = '';
          document.getElementById('recordType').value = '';
          document.getElementById('recordLocation').value = '';
          document.getElementById('recordNewLocation').value = '';
          document.getElementById('recordDescription').value = '';
          document.getElementById('recordRequest').value =
            getNextRequestNumber();
          document.getElementById('recordStatus').value = '';
          document.getElementById('recordImportance').value = '2';
          [
            'recordMalfunctionDate',
            'recordBrokenLocation',
            'recordRecoveryDate',
            'recordReplaceSerial',
            'recordReplaceProduct',
            'recordReplaceType',
            'recordReplaceLocation',
          ].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
          });
          [
            'newLocationField',
            'malfunctionDateField',
            'brokenLocationField',
            'recoveryDateField',
            'replaceSerialField',
            'replaceProductField',
            'replaceTypeField',
            'replaceLocationField',
          ].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('visible');
          });
          const replaceTitle = document.getElementById('replaceTitleField');
          if (replaceTitle) replaceTitle.style.display = 'none';
          document.getElementById('recordLocation').removeAttribute('readonly');
          updateDateTime();
          if (st === 'move' || st === 'malfunction')
            await loadDevicesPage(1, true);
          closeAddRecordModal();
        }
      });
      setupAllSuggestions();
      setupStatusChange();
    }
  }

  function openAddRecordModal() {
    document.getElementById('recordRequest').value = getNextRequestNumber();
    document.getElementById('recordUser').value = currentUser;
    updateDateTime();
    updateProductSelect();
    document.getElementById('addRecordModalOverlay').classList.add('active');
  }
  function closeAddRecordModal() {
    document.getElementById('addRecordModalOverlay').classList.remove('active');
  }

  function initAddDeviceModal() {
    const openBtn = document.getElementById('openAddDeviceModal');
    if (openBtn) {
      const newBtn = openBtn.cloneNode(true);
      openBtn.parentNode.replaceChild(newBtn, openBtn);
      newBtn.addEventListener('click', openAddDeviceModal);
    }
    document
      .getElementById('closeAddDeviceModal')
      ?.addEventListener('click', closeAddDeviceModal);
    document
      .getElementById('addDeviceModalOverlay')
      ?.addEventListener('click', function (e) {
        if (e.target === this) closeAddDeviceModal();
      });
    const form = document.getElementById('addDeviceForm');
    if (form) {
      const newForm = form.cloneNode(true);
      form.parentNode.replaceChild(newForm, form);
      document
        .getElementById('cancelAddDeviceBtn')
        ?.addEventListener('click', closeAddDeviceModal);
      newForm.addEventListener('submit', async e => {
        e.preventDefault();
        const p = document.getElementById('deviceProduct').value.trim(),
          d = document.getElementById('deviceName').value.trim(),
          s = document.getElementById('deviceSerial').value.trim(),
          sb = document.getElementById('deviceSupplyBasis').value.trim(),
          sp = document.getElementById('deviceSPRequisites').value.trim(),
          lsi = document.getElementById('deviceLSIRequisites').value.trim(),
          w = document.getElementById('deviceWarranty')?.value || '';
        if (!p || !d || !s || !sb || !sp || !lsi) {
          alert('Заполните обязательные поля');
          return;
        }
        if (
          await addDevice({
            product: p,
            device: d,
            serialNumber: s,
            supplyBasis: sb,
            spRequisites: sp,
            lsiRequisites: lsi,
            location: document.getElementById('deviceLocation').value.trim(),
            specs: document.getElementById('deviceSpecs').value.trim(),
            notes: document.getElementById('deviceNotes').value.trim(),
            warranty: w,
          })
        ) {
          showToast('Устройство успешно добавлено');
          [
            'deviceProduct',
            'deviceName',
            'deviceSerial',
            'deviceSupplyBasis',
            'deviceSPRequisites',
            'deviceLSIRequisites',
            'deviceLocation',
            'deviceSpecs',
            'deviceNotes',
            'deviceWarranty',
          ].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
          });
          closeAddDeviceModal();
        }
      });
    }
  }
  function openAddDeviceModal() {
    document.getElementById('addDeviceModalOverlay').classList.add('active');
  }
  function closeAddDeviceModal() {
    document.getElementById('addDeviceModalOverlay').classList.remove('active');
  }

  // ===== Сводка фильтров: счётчик «Найдено», метки активных фильтров,
  // запоминание выбранных фильтров в браузере (для каждого пользователя) =====
  const FILTER_DEFS = {
    records: [
      { id: 'filterImportance', label: 'Важность' },
      { id: 'filterProduct', label: 'Изделие' },
      { id: 'filterStatus', label: 'Статус' },
      { id: 'filterUser', label: 'Пользователь' },
      { id: 'filterTechType', label: 'Тип техники' },
      { id: 'filterLocation', label: 'Расположение' },
      { id: 'filterSerial', label: 'Серийный номер' },
    ],
    // Только поля, которые реально отправляются на сервер
    devices: [
      { id: 'filterDevProduct', label: 'Изделие' },
      { id: 'filterDevDevice', label: 'Устройство' },
      { id: 'filterDevSerial', label: 'Серийный номер' },
      { id: 'filterDevLocation', label: 'Расположение' },
    ],
  };
  let filtersRestored = { records: false, devices: false };
  const filterStorageKey = () => 'penny_filters_' + (currentUser || '');

  function getActiveFilters(kind) {
    return FILTER_DEFS[kind]
      .map(def => {
        const el = document.getElementById(def.id);
        const value = el ? String(el.value || '').trim() : '';
        if (!el || !value) return null;
        const text =
          el.tagName === 'SELECT'
            ? (el.options[el.selectedIndex] || {}).text || value
            : value;
        return { id: def.id, label: def.label, value, text };
      })
      .filter(Boolean);
  }

  function saveFilters(kind) {
    if (!filtersRestored[kind] || !currentUser) return;
    try {
      const all = JSON.parse(localStorage.getItem(filterStorageKey()) || '{}');
      const vals = {};
      getActiveFilters(kind).forEach(f => (vals[f.id] = f.value));
      all[kind] = vals;
      localStorage.setItem(filterStorageKey(), JSON.stringify(all));
    } catch (e) {}
  }

  function updateFilterSummary(kind) {
    const active = getActiveFilters(kind);
    const total = kind === 'records' ? recordsTotal : devicesTotal;
    const countEl = document.getElementById(kind + 'FoundCount');
    if (countEl)
      countEl.innerHTML =
        (active.length ? 'Найдено: ' : 'Всего: ') + '<b>' + total + '</b>';
    const chipsEl = document.getElementById(kind + 'FilterChips');
    if (chipsEl)
      chipsEl.innerHTML = active
        .map(
          f =>
            `<span class="filter-chip"><span class="chip-label">${escapeHtml(f.label)}:</span> ${escapeHtml(f.text)}<button type="button" title="Убрать фильтр" data-filter-id="${f.id}">${ICON('x')}</button></span>`
        )
        .join('');
    saveFilters(kind);
  }

  function restoreFilters() {
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(filterStorageKey()) || '{}');
    } catch (e) {}
    ['records', 'devices'].forEach(kind => {
      if (filtersRestored[kind]) return;
      filtersRestored[kind] = true;
      const vals = saved[kind] || {};
      let changed = false;
      FILTER_DEFS[kind].forEach(def => {
        const el = document.getElementById(def.id);
        if (!el) return;
        const nv = vals[def.id] || '';
        if (
          nv &&
          el.tagName === 'SELECT' &&
          !Array.from(el.options).some(o => o.value === nv)
        ) {
          const o = document.createElement('option');
          o.value = nv;
          o.textContent = nv;
          el.appendChild(o);
        }
        if (el.value !== nv) {
          el.value = nv;
          changed = true;
        }
      });
      if (changed) {
        if (kind === 'records') loadRecordsPage(1, true);
        else loadDevicesPage(1, true);
      } else updateFilterSummary(kind);
    });
  }

  function initFilterSummary() {
    ['records', 'devices'].forEach(kind => {
      const chipsEl = document.getElementById(kind + 'FilterChips');
      if (!chipsEl || chipsEl._bound) return;
      chipsEl._bound = true;
      chipsEl.addEventListener('click', e => {
        const btn = e.target.closest('button[data-filter-id]');
        if (!btn) return;
        const el = document.getElementById(btn.dataset.filterId);
        if (el) el.value = '';
        if (kind === 'records') loadRecordsPage(1, true);
        else loadDevicesPage(1, true);
      });
    });
    restoreFilters();
  }

  function initFilters() {
    ['filterImportance', 'filterProduct', 'filterStatus', 'filterUser'].forEach(
      id =>
        document
          .getElementById(id)
          ?.addEventListener('change', () => loadRecordsPage(1, true))
    );
    ['filterTechType', 'filterLocation', 'filterSerial'].forEach(id =>
      document.getElementById(id)?.addEventListener('input', function () {
        clearTimeout(this._debounce);
        this._debounce = setTimeout(() => loadRecordsPage(1, true), 500);
      })
    );
    document
      .getElementById('resetFiltersBtn')
      ?.addEventListener('click', () => {
        [
          'filterImportance',
          'filterProduct',
          'filterStatus',
          'filterUser',
          'filterTechType',
          'filterLocation',
          'filterSerial',
        ].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = '';
        });
        loadRecordsPage(1, true);
      });
  }

  function openEditModal(id) {
    const rec = records.find(r => r.id === id);
    if (!rec) return;
    editingRecordId = id;
    const sv = (elId, v) => {
      const el = document.getElementById(elId);
      if (el) el.value = v || '';
    };

    const statusSelect = document.getElementById('editStatus');
    let options = [];
    if (rec.status === 'malfunction') {
      options = [
        { value: 'malfunction', label: 'Неисправность' },
        { value: 'repair', label: 'Ремонт' },
        { value: 'replace', label: 'Замена' },
        { value: 'archive', label: 'Архив' },
      ];
    } else if (rec.status === 'repair') {
      options = [
        { value: 'repair', label: 'Ремонт' },
        { value: 'repair_done', label: 'Ремонт (выполнено)' },
        { value: 'replace', label: 'Замена' },
        { value: 'archive', label: 'Архив' },
      ];
    } else if (rec.status === 'replace') {
      options = [
        { value: 'replace', label: 'Замена' },
        { value: 'replace_done', label: 'Замена (выполнено)' },
      ];
    } else if (rec.status === 'archive') {
      options = [{ value: 'archive', label: 'Архив' }];
    } else if (rec.status === 'info') {
      options = [{ value: 'info', label: 'Информация' }];
    } else if (rec.status === 'move') {
      options = [{ value: 'move', label: 'Перемещение' }];
    } else {
      options = [
        { value: 'malfunction', label: 'Неисправность' },
        { value: 'repair', label: 'Ремонт' },
        { value: 'replace', label: 'Замена' },
        { value: 'archive', label: 'Архив' },
      ];
    }
    statusSelect.innerHTML = '';
    options.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.label;
      statusSelect.appendChild(opt);
    });

    let displayStatus = rec.status;
    if (rec.status === 'repair' && rec.completed) displayStatus = 'repair_done';
    if (rec.status === 'replace' && rec.completed)
      displayStatus = 'replace_done';
    statusSelect.value = displayStatus;

    sv('editRequestNumber', rec.requestNumber || '');
    sv('editImportance', rec.importance || '2');
    sv('editSerialNumber', rec.serialNumber || '');
    sv('editProduct', rec.product || '');
    sv('editTechType', rec.techType || '');
    sv('editLocation', rec.location || '');
    sv('editNewLocation', rec.newLocation || '');
    sv('editDescription', rec.description || '');
    sv('editBrokenLocation', rec.brokenLocation || '');
    sv('editReplaceSerial', rec.replaceSerial || '');
    sv('editReplaceProduct', rec.replaceProduct || '');
    sv('editReplaceType', rec.replaceType || '');
    sv('editReplaceLocation', rec.replaceLocation || '');
    sv('editReplaceSP', rec.newSPRequisites || '');
    sv('editReplaceLSI', rec.newLSIRequisites || '');
    sv('editDefectAct', rec.defectAct || '');
    sv('editMalfunctionDate', rec.malfunctionDate || '');
    sv('editRecoveryDate', rec.recoveryDate || '');
    sv('editFullRecoveryDate', rec.fullRecoveryDate || '');
    sv('editNewDeviceSerial', rec.newDeviceSerial || '');
    sv('editNewDeviceType', rec.newDeviceType || '');
    sv('editNewDeviceSP', rec.newSPRequisites || '');
    sv('editNewDeviceLSI', rec.newLSIRequisites || '');

    updateEditModalConditionalFields();
    document.getElementById('editModalOverlay').classList.add('active');
  }

  function closeEditModal() {
    document.getElementById('editModalOverlay').classList.remove('active');
    editingRecordId = null;
  }

  function updateEditModalConditionalFields() {
    const s = document.getElementById('editStatus').value;

    [
      'editNewLocationGroup',
      'editBrokenLocationGroup',
      'editReplaceTitleGroup',
      'editReplaceSerialGroup',
      'editReplaceProductGroup',
      'editReplaceTypeGroup',
      'editReplaceLocationGroup',
      'editReplaceSPGroup',
      'editReplaceLSIGroup',
      'editDefectActGroup',
      'editMalfunctionDateGroup',
      'editRecoveryDateGroup',
      'editFullRecoveryDateGroup',
      'editNewDeviceTitleGroup',
      'editNewDeviceSerialGroup',
      'editNewDeviceTypeGroup',
      'editNewDeviceSPGroup',
      'editNewDeviceLSIGroup',
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    ['editSerialNumber', 'editProduct', 'editTechType'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.closest('.form-group').style.display = '';
    });

    const baseFields = ['editSerialNumber', 'editProduct', 'editTechType'];
    const brokenEl = document.getElementById('editBrokenLocation');
    const repSerEl = document.getElementById('editReplaceSerial');
    const repProdEl = document.getElementById('editReplaceProduct');
    const repTypeEl = document.getElementById('editReplaceType');
    const repLocEl = document.getElementById('editReplaceLocation');
    const defActEl = document.getElementById('editDefectAct');

    baseFields.forEach(id =>
      document.getElementById(id)?.removeAttribute('readonly')
    );
    [brokenEl, repSerEl, repProdEl, repTypeEl, repLocEl, defActEl].forEach(
      el => {
        if (el) el.removeAttribute('readonly');
      }
    );

    const roBlock = document.getElementById('editReadonlyBlock');
    let roDeviceRows = [];
    let roReplaceRows = [];
    const addDeviceRow = (label, value) => {
      if (value) roDeviceRows.push([label, value]);
    };
    const addReplaceRow = (label, value) => {
      if (value) roReplaceRows.push([label, value]);
    };

    if (s === 'move') {
      document.getElementById('editNewLocationGroup').style.display = 'flex';
    }

    if (s === 'malfunction') {
      document.getElementById('editMalfunctionDateGroup').style.display =
        'flex';
      document.getElementById('editRecoveryDateGroup').style.display = 'flex';
      document.getElementById('editBrokenLocationGroup').style.display = 'flex';
      document.getElementById('editReplaceTitleGroup').style.display = 'block';
      document.getElementById('editReplaceSerialGroup').style.display = 'flex';
      document.getElementById('editReplaceProductGroup').style.display = 'flex';
      document.getElementById('editReplaceTypeGroup').style.display = 'flex';
      document.getElementById('editReplaceLocationGroup').style.display =
        'flex';
      brokenEl.setAttribute('readonly', 'readonly');
      repSerEl.setAttribute('readonly', 'readonly');
      repProdEl.setAttribute('readonly', 'readonly');
      repTypeEl.setAttribute('readonly', 'readonly');
      repLocEl.setAttribute('readonly', 'readonly');
    }

    if (
      s === 'repair' ||
      s === 'repair_done' ||
      s === 'replace' ||
      s === 'replace_done' ||
      s === 'archive'
    ) {
      ['editSerialNumber', 'editProduct', 'editTechType'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.closest('.form-group').style.display = 'none';
      });
      addDeviceRow(
        'Серийный номер',
        document.getElementById('editSerialNumber').value
      );
      addDeviceRow('Изделие', document.getElementById('editProduct').value);
      addDeviceRow(
        'Тип техники',
        document.getElementById('editTechType').value
      );

      if (
        s === 'repair' ||
        s === 'repair_done' ||
        s === 'replace' ||
        s === 'replace_done'
      ) {
        addDeviceRow(
          'Куда отнесли',
          document.getElementById('editBrokenLocation').value
        );
        addDeviceRow(
          'Дефектовочная ведомость',
          document.getElementById('editDefectAct').value
        );
        addReplaceRow(
          'Серийный номер',
          document.getElementById('editReplaceSerial').value
        );
        addReplaceRow(
          'Изделие',
          document.getElementById('editReplaceProduct').value
        );
        addReplaceRow(
          'Тип техники',
          document.getElementById('editReplaceType').value
        );
      }
    }

    if (s === 'repair') {
      document.getElementById('editDefectActGroup').style.display = 'flex';
    }

    if (s === 'repair_done') {
      document.getElementById('editDefectActGroup').style.display = 'flex';
      document.getElementById('editReplaceSPGroup').style.display = 'flex';
      document.getElementById('editReplaceLSIGroup').style.display = 'flex';
      document.getElementById('editReplaceLocationGroup').style.display =
        'flex';
      document.getElementById('editFullRecoveryDateGroup').style.display =
        'flex';
      defActEl.setAttribute('readonly', 'readonly');
      repLocEl.removeAttribute('readonly');
      document.getElementById('editReplaceSP').removeAttribute('readonly');
      document.getElementById('editReplaceLSI').removeAttribute('readonly');
    }

    if (s === 'replace') {
      document.getElementById('editDefectActGroup').style.display = 'flex';
    }

    if (s === 'replace_done') {
      document.getElementById('editNewDeviceTitleGroup').style.display =
        'block';
      document.getElementById('editNewDeviceSerialGroup').style.display =
        'flex';
      document.getElementById('editNewDeviceTypeGroup').style.display = 'flex';
      document.getElementById('editNewDeviceSPGroup').style.display = 'flex';
      document.getElementById('editNewDeviceLSIGroup').style.display = 'flex';
      document.getElementById('editReplaceLocationGroup').style.display =
        'flex';
      repLocEl.removeAttribute('readonly');
    }

    let roHtml = '';
    if (roDeviceRows.length) {
      roHtml +=
        '<h4>Информация о неисправном устройстве</h4><table>' +
        roDeviceRows
          .map(
            ([l, v]) => `<tr><th>${l}</th><td>${escapeHtml(v || '-')}</td></tr>`
          )
          .join('') +
        '</table>';
    }
    if (roReplaceRows.length) {
      roHtml +=
        '<h4 style="margin-top:1rem;">' +
        ICON('refresh') +
        ' Выдано на подмену</h4><table>' +
        roReplaceRows
          .map(
            ([l, v]) => `<tr><th>${l}</th><td>${escapeHtml(v || '-')}</td></tr>`
          )
          .join('') +
        '</table>';
    }
    if (roHtml) {
      roBlock.innerHTML = roHtml;
      roBlock.classList.add('visible');
    } else {
      roBlock.innerHTML = '';
      roBlock.classList.remove('visible');
    }
  }

  async function saveEditRecord(e) {
    e.preventDefault();
    if (!editingRecordId) return;
    const s = document.getElementById('editStatus').value;
    const sn = document.getElementById('editSerialNumber').value.trim();
    const defectAct = document.getElementById('editDefectAct').value.trim();
    const originalRec = records.find(r => r.id === editingRecordId);

    // Информация и Перемещение можно редактировать только в тот же статус
    if (
      originalRec &&
      (originalRec.status === 'info' || originalRec.status === 'move') &&
      s !== originalRec.status
    ) {
      alert(
        `Статус «${STATUS_LABELS[originalRec.status]}» можно изменить только на «${STATUS_LABELS[originalRec.status]}».`
      );
      return;
    }

    // Те же проверки, что и при добавлении заявки
    if (s === 'info' || s === 'move') {
      document
        .getElementById('editRecordForm')
        ?.querySelectorAll('.error')
        .forEach(el => el.classList.remove('error'));
      const markError = id =>
        document.getElementById(id)?.classList.add('error');
      const pr = document.getElementById('editProduct').value.trim();
      const tt = document.getElementById('editTechType').value.trim();
      const nl =
        s === 'move'
          ? document.getElementById('editNewLocation').value.trim()
          : '';
      const existingDevice = sn ? await findDeviceBySerial(sn) : null;
      const existingInBase = Boolean(
        existingDevice &&
        existingDevice.product &&
        String(existingDevice.product).trim()
      );

      if (sn && existingInBase && pr && existingDevice.product !== pr) {
        alert(
          `Серийный номер "${sn}" принадлежит изделию "${existingDevice.product}", а не "${pr}".`
        );
        markError('editSerialNumber');
        markError('editProduct');
        return;
      }
      if (sn && !existingInBase && pr) {
        alert(
          `Серийного номера "${sn}" нет в базе (Вся техника). Для устройств не из базы изделие не указывается.`
        );
        markError('editSerialNumber');
        markError('editProduct');
        return;
      }
      if (sn && existingInBase && !pr) {
        alert(
          `Серийный номер "${sn}" есть в базе (изделие "${existingDevice.product}"). Укажите изделие.`
        );
        markError('editSerialNumber');
        markError('editProduct');
        return;
      }
      if (s === 'move') {
        let hasError = false;
        if (!sn) {
          markError('editSerialNumber');
          hasError = true;
        }
        if (!tt) {
          markError('editTechType');
          hasError = true;
        }
        if (!nl) {
          markError('editNewLocation');
          hasError = true;
        }
        if (hasError) {
          alert('Заполните обязательные поля (выделены красным)');
          return;
        }
      }
    } else if (s) {
      // Неисправность, Ремонт, Замена, их «выполнено», Архив:
      // серийный номер должен быть в базе «Вся техника»
      // (как при добавлении Неисправности)
      document
        .getElementById('editRecordForm')
        ?.querySelectorAll('.error')
        .forEach(el => el.classList.remove('error'));
      const markError = id =>
        document.getElementById(id)?.classList.add('error');
      if (!sn) {
        markError('editSerialNumber');
        alert('Укажите серийный номер');
        return;
      }
      const pr = document.getElementById('editProduct').value.trim();
      const dev = await findDeviceBySerial(sn);
      const inBase = Boolean(dev && dev.product && String(dev.product).trim());
      if (!inBase) {
        alert(`Серийный номер "${sn}" не найден в базе.`);
        markError('editSerialNumber');
        return;
      }
      if (pr && dev.product !== pr) {
        alert(
          `Серийный номер "${sn}" принадлежит изделию "${dev.product}", а не "${pr}".`
        );
        markError('editSerialNumber');
        markError('editProduct');
        return;
      }
    }

    // Неисправность и её продолжения (ремонт, замена, архив): серийный номер
    // и изделие проверяются так же, как при добавлении неисправности.
    // Проверка выполняется, если серийный номер или изделие были изменены.
    if (s !== 'info' && s !== 'move') {
      const pr = document.getElementById('editProduct').value.trim();
      const changed =
        !originalRec ||
        sn !== (originalRec.serialNumber || '') ||
        pr !== (originalRec.product || '');
      if (changed) {
        document
          .getElementById('editRecordForm')
          ?.querySelectorAll('.error')
          .forEach(el => el.classList.remove('error'));
        const markError = id =>
          document.getElementById(id)?.classList.add('error');
        if (!sn) {
          markError('editSerialNumber');
          alert('Укажите серийный номер');
          return;
        }
        const existingDevice = await findDeviceBySerial(sn);
        const existingInBase = Boolean(
          existingDevice &&
          existingDevice.product &&
          String(existingDevice.product).trim()
        );
        if (!existingInBase) {
          markError('editSerialNumber');
          alert(`Серийный номер "${sn}" не найден в базе.`);
          return;
        }
        if (!pr) {
          markError('editProduct');
          alert(
            `Укажите изделие (серийный номер "${sn}" принадлежит изделию "${existingDevice.product}").`
          );
          return;
        }
        if (existingDevice.product !== pr) {
          markError('editSerialNumber');
          markError('editProduct');
          alert(
            `Серийный номер "${sn}" принадлежит изделию "${existingDevice.product}", а не "${pr}".`
          );
          return;
        }
      }
    }

    const finalStatus =
      s === 'repair_done' ? 'repair' : s === 'replace_done' ? 'replace' : s;
    const isCompleted =
      s === 'archive' || s === 'repair_done' || s === 'replace_done'
        ? true
        : originalRec?.completed || false;

    if ((s === 'replace' || s === 'repair_done') && !defectAct) {
      document.getElementById('editDefectAct').classList.add('error');
      alert('Заполните дефектовочную ведомость');
      return;
    }

    let newDeviceSerial = '';
    let newDeviceType = '';
    let newDeviceSP = '';
    let newDeviceLSI = '';

    if (s === 'replace_done') {
      newDeviceSerial = document
        .getElementById('editNewDeviceSerial')
        .value.trim();
      newDeviceType = document.getElementById('editNewDeviceType').value.trim();
      newDeviceSP = document.getElementById('editNewDeviceSP').value.trim();
      newDeviceLSI = document.getElementById('editNewDeviceLSI').value.trim();

      let hasError = false;
      if (!newDeviceSerial) {
        document.getElementById('editNewDeviceSerial').classList.add('error');
        hasError = true;
      }
      if (!newDeviceType) {
        document.getElementById('editNewDeviceType').classList.add('error');
        hasError = true;
      }
      if (!newDeviceSP) {
        document.getElementById('editNewDeviceSP').classList.add('error');
        hasError = true;
      }
      if (!newDeviceLSI) {
        document.getElementById('editNewDeviceLSI').classList.add('error');
        hasError = true;
      }
      if (hasError) {
        alert('Заполните обязательные поля "Новое устройство"');
        return;
      }

      const newDev = devices.find(d => d.serialNumber === newDeviceSerial);
      if (!newDev) {
        document.getElementById('editNewDeviceSerial').classList.add('error');
        alert(
          `Серийный номер "${newDeviceSerial}" не найден в базе устройств!`
        );
        return;
      }
    }

    const data = {
      id: editingRecordId,
      requestNumber: document.getElementById('editRequestNumber').value.trim(),
      importance: document.getElementById('editImportance').value,
      status: finalStatus,
      serialNumber: sn,
      newSerialNumber: '',
      product: document.getElementById('editProduct').value.trim(),
      techType: document.getElementById('editTechType').value.trim(),
      newTechType: '',
      location: document.getElementById('editLocation').value.trim(),
      newLocation:
        s === 'move'
          ? document.getElementById('editNewLocation').value.trim()
          : originalRec?.newLocation || '',
      description: document.getElementById('editDescription').value.trim(),
      newSPRequisites:
        s === 'repair_done' || s === 'replace_done'
          ? newDeviceSP || originalRec?.newSPRequisites || ''
          : originalRec?.newSPRequisites || '',
      newLSIRequisites:
        s === 'repair_done' || s === 'replace_done'
          ? newDeviceLSI || originalRec?.newLSIRequisites || ''
          : originalRec?.newLSIRequisites || '',
      malfunctionDate: originalRec?.malfunctionDate || '',
      brokenLocation:
        originalRec?.brokenLocation ||
        document.getElementById('editBrokenLocation').value.trim(),
      recoveryDate: originalRec?.recoveryDate || '',
      fullRecoveryDate:
        s === 'repair_done' || s === 'replace_done'
          ? document.getElementById('editFullRecoveryDate').value || ''
          : originalRec?.fullRecoveryDate || '',
      replaceSerial:
        originalRec?.replaceSerial ||
        document.getElementById('editReplaceSerial').value.trim(),
      replaceProduct:
        originalRec?.replaceProduct ||
        document.getElementById('editReplaceProduct').value.trim(),
      replaceType:
        originalRec?.replaceType ||
        document.getElementById('editReplaceType').value.trim(),
      replaceLocation:
        s === 'replace_done'
          ? document.getElementById('editReplaceLocation').value.trim() ||
            originalRec?.replaceLocation ||
            ''
          : originalRec?.replaceLocation ||
            document.getElementById('editReplaceLocation').value.trim(),
      defectAct: defectAct || originalRec?.defectAct || '',
      completed: isCompleted,
      completedAt:
        s === 'archive' || s === 'repair_done' || s === 'replace_done'
          ? new Date().toISOString()
          : originalRec?.completedAt || null,
      newDeviceSerial: newDeviceSerial || originalRec?.newDeviceSerial || '',
      newDeviceType: newDeviceType || originalRec?.newDeviceType || '',
    };

    const deviceChanges = [];

    if (s === 'repair' || s === 'replace') {
      const brokenLoc = originalRec?.brokenLocation || '';
      const repLoc = originalRec?.replaceLocation || '';
      const repSN = originalRec?.replaceSerial || '';
      if (brokenLoc && sn) {
        deviceChanges.push({
          serialNumber: sn,
          fields: { location: brokenLoc },
        });
      }
      if (repSN && repLoc) {
        deviceChanges.push({
          serialNumber: repSN,
          fields: { location: repLoc },
        });
      }
    }

    if (s === 'repair_done') {
      const newSP =
        document.getElementById('editReplaceSP')?.value.trim() || '';
      const newLSI =
        document.getElementById('editReplaceLSI')?.value.trim() || '';
      const newRepLoc =
        document.getElementById('editReplaceLocation')?.value.trim() || '';
      const repSN = originalRec?.replaceSerial || '';
      if (sn && (newSP || newLSI)) {
        const fields = {};
        if (newSP) fields.spRequisites = newSP;
        if (newLSI) fields.lsiRequisites = newLSI;
        deviceChanges.push({ serialNumber: sn, fields });
      }
      if (repSN && newRepLoc) {
        deviceChanges.push({
          serialNumber: repSN,
          fields: { location: newRepLoc },
        });
      }
    }

    if (s === 'replace_done') {
      const repSN = originalRec?.replaceSerial || '';
      const newRepLoc =
        document.getElementById('editReplaceLocation')?.value.trim() || '';
      const fields = {};
      if (newDeviceSP) fields.spRequisites = newDeviceSP;
      if (newDeviceLSI) fields.lsiRequisites = newDeviceLSI;
      if (newDeviceType) fields.device = newDeviceType;
      if (Object.keys(fields).length) {
        deviceChanges.push({ serialNumber: newDeviceSerial, fields });
      }
      if (repSN && newRepLoc) {
        deviceChanges.push({
          serialNumber: repSN,
          fields: { location: newRepLoc },
        });
      }
    }

    const saved = await saveWithDeviceChanges(deviceChanges, async () => {
      try {
        await apiPut(API.records, data);
        return true;
      } catch (ex) {
        alert('Не удалось сохранить');
        return false;
      }
    });
    if (!saved) return;
    showToast('Изменения сохранены');
    closeEditModal();
    await loadRecordsPage(1, true);
    if (
      s === 'repair' ||
      s === 'replace' ||
      s === 'repair_done' ||
      s === 'replace_done'
    )
      await loadDevicesPage(1, true);
  }

  function getNextRequestNumber() {
    let m = 0;
    records.forEach(r => {
      const n = parseInt(r.requestNumber);
      if (!isNaN(n) && n > m) m = n;
    });
    return String(m + 1);
  }
  function initEditModal() {
    document
      .getElementById('closeEditModal')
      ?.addEventListener('click', closeEditModal);
    document
      .getElementById('cancelEditBtn')
      ?.addEventListener('click', closeEditModal);
    document
      .getElementById('editModalOverlay')
      ?.addEventListener('click', function (e) {
        if (e.target === this) closeEditModal();
      });
    document.addEventListener('keydown', function (e) {
      if (
        e.key === 'Escape' &&
        document.getElementById('editModalOverlay').classList.contains('active')
      )
        closeEditModal();
    });
    document
      .getElementById('editStatus')
      ?.addEventListener('change', updateEditModalConditionalFields);
    document
      .getElementById('editRecordForm')
      ?.addEventListener('submit', saveEditRecord);
  }

  function openDeviceEditModal(id) {
    const dev = devices.find(d => d.id === id);
    if (!dev) return;
    editingDeviceId = id;
    const sv = (elId, v) => {
      const el = document.getElementById(elId);
      if (el) el.value = v || '';
    };
    sv('editDeviceProduct', dev.product);
    sv('editDeviceName', dev.device);
    sv('editDeviceSerial', dev.serialNumber);
    sv('editDeviceSupplyBasis', dev.supplyBasis);
    sv('editDeviceSPRequisites', dev.spRequisites);
    sv('editDeviceLSIRequisites', dev.lsiRequisites);
    sv('editDeviceLocation', dev.location);
    sv('editDeviceSpecs', dev.specs);
    sv('editDeviceWarranty', dev.warranty);
    sv('editDeviceNotes', dev.notes);
    document.getElementById('editDeviceModalOverlay').classList.add('active');
  }
  function closeDeviceEditModal() {
    document
      .getElementById('editDeviceModalOverlay')
      .classList.remove('active');
    editingDeviceId = null;
  }
  async function saveDeviceEdit(e) {
    e.preventDefault();
    if (!editingDeviceId) return;
    const newSerial = document.getElementById('editDeviceSerial').value.trim();
    const data = {
      serialNumber: newSerial,
      product: document.getElementById('editDeviceProduct').value.trim(),
      device: document.getElementById('editDeviceName').value.trim(),
      supplyBasis: document
        .getElementById('editDeviceSupplyBasis')
        .value.trim(),
      spRequisites: document
        .getElementById('editDeviceSPRequisites')
        .value.trim(),
      lsiRequisites: document
        .getElementById('editDeviceLSIRequisites')
        .value.trim(),
      location: document.getElementById('editDeviceLocation').value.trim(),
      specs: document.getElementById('editDeviceSpecs').value.trim(),
      warranty: document.getElementById('editDeviceWarranty').value,
      notes: document.getElementById('editDeviceNotes').value.trim(),
    };
    if (
      !data.product ||
      !data.device ||
      !data.serialNumber ||
      !data.supplyBasis ||
      !data.spRequisites ||
      !data.lsiRequisites
    ) {
      alert('Заполните обязательные поля');
      return;
    }
    try {
      await fetch(API.devices, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      showToast('Изменения сохранены');
      closeDeviceEditModal();
      await loadDevicesPage(1, true);
      updateProductSelect();
    } catch (e) {
      alert('Ошибка сохранения');
    }
  }
  function initDeviceEditModal() {
    document
      .getElementById('closeEditDeviceModal')
      ?.addEventListener('click', closeDeviceEditModal);
    document
      .getElementById('cancelEditDeviceBtn')
      ?.addEventListener('click', closeDeviceEditModal);
    document
      .getElementById('editDeviceModalOverlay')
      ?.addEventListener('click', function (e) {
        if (e.target === this) closeDeviceEditModal();
      });
    document.addEventListener('keydown', function (e) {
      if (
        e.key === 'Escape' &&
        document
          .getElementById('editDeviceModalOverlay')
          .classList.contains('active')
      )
        closeDeviceEditModal();
    });
    document
      .getElementById('editDeviceForm')
      ?.addEventListener('submit', saveDeviceEdit);
  }

  async function openDeviceInfoModal(serialNumber) {
    // Ищем устройство на сервере — не полагаемся на локальный массив,
    // т.к. он может быть загружен не полностью
    let dev = null;
    try {
      const r = await fetch(
        API.devices + '/search?q=' + encodeURIComponent(serialNumber)
      );
      if (r.ok) {
        const results = await r.json();
        dev = results.find(d => d.serialNumber === serialNumber);
      }
    } catch (e) {
      dev = null;
    }

    if (!dev) {
      dev = devices.find(d => d.serialNumber === serialNumber);
    }

    if (!dev) {
      alert('Устройство не найдено');
      return;
    }

    let historyEvents = [];
    try {
      const r = await fetch(
        API.history + '?serialNumber=' + encodeURIComponent(serialNumber)
      );
      if (r.ok) {
        historyEvents = await r.json();
      }
    } catch (e) {
      historyEvents = [];
    }

    const dataCol = document.getElementById('deviceDataColumn');
    dataCol.innerHTML = `<h3 style="margin-bottom:0.8rem;">${ICON('package')} ${escapeHtml(dev.device)}</h3><table><tr><th>Изделие</th><td>${escapeHtml(dev.product)}</td></tr><tr><th>Серийный номер</th><td>${escapeHtml(dev.serialNumber)}</td></tr><tr><th>Основание поставки</th><td>${escapeHtml(dev.supplyBasis || '-')}</td></tr><tr><th>Реквизиты СП</th><td>${escapeHtml(dev.spRequisites || '-')}</td></tr><tr><th>Реквизиты ЛСИ</th><td>${escapeHtml(dev.lsiRequisites || '-')}</td></tr><tr><th>Расположение</th><td>${escapeHtml(dev.location || '-')}</td></tr><tr><th>Характеристики</th><td>${escapeHtml(dev.specs || '-')}</td></tr><tr><th>Гарантия до</th><td>${dev.warranty ? new Date(dev.warranty).toLocaleDateString('ru-RU') : '-'}</td></tr><tr><th>Примечание</th><td>${escapeHtml(dev.notes || '-')}</td></tr><tr><th>Дата добавления</th><td>${new Date(dev.createdAt).toLocaleString('ru-RU')}</td></tr></table>`;

    const timelineCol = document.getElementById('deviceTimelineColumn');

    // Не показываем update_record, если статус и completed не менялись
    historyEvents = historyEvents.filter(h => {
      if (h.action === 'update_record') {
        const statusChanged = Boolean(h.statusChanged);
        const completedChanged = Boolean(h.completedChanged);
        return statusChanged || completedChanged;
      }
      return true;
    });

    historyEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const fmtDate = v => {
      if (!v) return '';
      try {
        return new Date(v).toLocaleString('ru-RU');
      } catch (e) {
        return String(v);
      }
    };

    // Формирует строки деталей заявки — общие поля
    const buildRecordRows = h => {
      let rows = '';
      const addRow = (label, value) => {
        if (
          value !== undefined &&
          value !== null &&
          String(value).trim() !== ''
        ) {
          rows += `<tr><th>${label}</th><td>${escapeHtml(String(value))}</td></tr>`;
        }
      };

      addRow('Пользователь', h.username);
      addRow('№ Заявки', h.requestNumber);
      addRow('Важность', IMPORTANCE_LABELS[h.importance] || h.importance);
      addRow(
        'Статус',
        STATUS_LABELS[h.newStatus] || STATUS_LABELS[h.status] || h.status
      );
      const isCompleted =
        h.newCompleted !== undefined
          ? h.newCompleted
          : h.changes && h.changes.completed;
      addRow('Выполнено', isCompleted ? 'Да' : 'Нет');
      addRow('Серийный номер', h.serialNumber);
      addRow('Изделие', h.product);
      addRow('Тип техники', h.techType);
      addRow('Расположение', h.location);
      addRow('Новое расположение', h.newLocation);

      addRow(
        'Дата обнаружения',
        h.malfunctionDate ? fmtDate(h.malfunctionDate) : ''
      );
      addRow('Куда отнесли сломанное', h.brokenLocation);
      addRow(
        'Дата оперативного восстановления',
        h.recoveryDate ? fmtDate(h.recoveryDate) : ''
      );
      addRow(
        'Дата полного восстановления',
        h.fullRecoveryDate ? fmtDate(h.fullRecoveryDate) : ''
      );
      addRow('Дефектовочная ведомость', h.defectAct);

      addRow('Подменный Сер№', h.replaceSerial);
      addRow('Подменное изделие', h.replaceProduct);
      addRow('Подменный тип техники', h.replaceType);
      addRow('Расположение подменного', h.replaceLocation);

      addRow('Новое устройство Сер№', h.newDeviceSerial);
      addRow('Новое устройство тип', h.newDeviceType);
      addRow('Новые реквизиты СП', h.newSPRequisites);
      addRow('Новые реквизиты ЛСИ', h.newLSIRequisites);

      addRow('Описание', h.description);

      return rows;
    };

    if (!historyEvents.length) {
      timelineCol.innerHTML =
        '<p style="color:var(--text-secondary);text-align:center;padding:2rem;">Нет записей</p>';
    } else {
      let html =
        '<h3 style="margin-bottom:1rem;">' +
        ICON('clipboard') +
        ' История операций (' +
        historyEvents.length +
        ')</h3><div class="timeline">';
      historyEvents.forEach((h, i) => {
        const ts = new Date(h.timestamp);
        const dt =
          ts.toLocaleDateString('ru-RU') +
          '<br>' +
          ts.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
          });

        let title = '';
        let details = '';
        let kind = 'record';
        let iconName = 'clipboard';

        if (h.action === 'create_device') {
          title = 'Добавлено устройство';
          kind = 'create';
          iconName = 'plus';
          details = `
            <tr><th>Действие</th><td>Создание устройства</td></tr>
            <tr><th>Серийный номер</th><td>${escapeHtml(h.serialNumber || '-')}</td></tr>
            <tr><th>Изделие</th><td>${escapeHtml(h.product || '-')}</td></tr>
            <tr><th>Устройство</th><td>${escapeHtml(h.device || '-')}</td></tr>
          `;
        } else if (h.action === 'update_device') {
          title = 'Изменено устройство';
          kind = 'edit';
          iconName = 'pencil';
          const changes = h.changes || {};
          let changeRows = '';
          if (changes.serialNumber)
            changeRows += `<tr><th>Серийный номер</th><td>${escapeHtml(changes.serialNumber)}</td></tr>`;
          if (changes.product)
            changeRows += `<tr><th>Изделие</th><td>${escapeHtml(changes.product)}</td></tr>`;
          if (changes.device)
            changeRows += `<tr><th>Устройство</th><td>${escapeHtml(changes.device)}</td></tr>`;
          if (changes.location)
            changeRows += `<tr><th>Расположение</th><td>${escapeHtml(changes.location)}</td></tr>`;
          if (changes.supplyBasis)
            changeRows += `<tr><th>Основание поставки</th><td>${escapeHtml(changes.supplyBasis)}</td></tr>`;
          if (changes.spRequisites)
            changeRows += `<tr><th>Реквизиты СП</th><td>${escapeHtml(changes.spRequisites)}</td></tr>`;
          if (changes.lsiRequisites)
            changeRows += `<tr><th>Реквизиты ЛСИ</th><td>${escapeHtml(changes.lsiRequisites)}</td></tr>`;
          if (changes.specs)
            changeRows += `<tr><th>Характеристики</th><td>${escapeHtml(changes.specs)}</td></tr>`;
          if (changes.notes)
            changeRows += `<tr><th>Примечание</th><td>${escapeHtml(changes.notes)}</td></tr>`;
          if (changes.warranty)
            changeRows += `<tr><th>Гарантия до</th><td>${escapeHtml(changes.warranty)}</td></tr>`;
          details = `
            <tr><th>Действие</th><td>Обновление устройства</td></tr>
            <tr><th>Серийный номер</th><td>${escapeHtml(h.serialNumber || '-')}</td></tr>
            ${changeRows}
          `;
        } else if (h.action === 'delete_device') {
          title = 'Удалено устройство';
          kind = 'delete';
          iconName = 'trash';
          details = `
            <tr><th>Действие</th><td>Удаление устройства</td></tr>
            <tr><th>Серийный номер</th><td>${escapeHtml(h.serialNumber || '-')}</td></tr>
          `;
        } else if (h.action === 'create_record') {
          const statusLabel = STATUS_LABELS[h.status] || h.status || '—';
          title = `Создана: ${statusLabel}`;
          kind = 'record';
          iconName = 'clipboard';
          details =
            `<tr><th>Действие</th><td>Создание заявки</td></tr>` +
            buildRecordRows(h);
        } else if (h.action === 'update_record') {
          const oldLabel = STATUS_LABELS[h.oldStatus] || h.oldStatus || '—';
          const newLabel = STATUS_LABELS[h.newStatus] || h.newStatus || '—';
          if (h.statusChanged) {
            title = `${oldLabel} → ${newLabel}`;
            kind = 'status';
            iconName = 'refresh';
          } else if (h.completedChanged && h.newCompleted) {
            title = `${newLabel} (выполнено)`;
            kind = 'done';
            iconName = 'check-circle';
          } else {
            title = `Изменение: ${newLabel}`;
            kind = 'edit';
            iconName = 'pencil';
          }
          details =
            `<tr><th>Действие</th><td>Изменение заявки</td></tr>` +
            `<tr><th>Старый статус</th><td>${oldLabel}</td></tr>` +
            buildRecordRows(h);
        } else {
          title = h.action || 'Событие';
          iconName = 'info';
          details = `
            <tr><th>Действие</th><td>${escapeHtml(h.action || '-')}</td></tr>
            <tr><th>Серийный номер</th><td>${escapeHtml(h.serialNumber || '-')}</td></tr>
          `;
        }

        html += `<div class="timeline-item tl-${kind}" style="margin-bottom:${i < historyEvents.length - 1 ? '1.5rem' : '0'};"><span class="tl-marker">${ICON(iconName)}</span><button class="timeline-btn" onclick="toggleTimelineDetails(this, '${h.id}')"><span class="tl-status">${escapeHtml(title)}</span><span class="tl-date">${dt}</span></button><div class="timeline-details" id="details_${h.id}"><table>${details}</table></div></div>`;
      });
      html += '</div>';
      timelineCol.innerHTML = html;
    }
    document.getElementById('deviceInfoModalOverlay').classList.add('active');
  }
  window.openDeviceInfoModal = openDeviceInfoModal;

  function toggleTimelineDetails(btn, recordId) {
    const details = document.getElementById('details_' + recordId);
    if (!details) return;
    const isOpen = details.classList.contains('open');
    document
      .querySelectorAll('.timeline-details.open')
      .forEach(d => d.classList.remove('open'));
    document
      .querySelectorAll('.timeline-btn.active')
      .forEach(b => b.classList.remove('active'));
    if (!isOpen) {
      details.classList.add('open');
      btn.classList.add('active');
    }
  }
  window.toggleTimelineDetails = toggleTimelineDetails;

  function closeDeviceInfoModal() {
    document
      .getElementById('deviceInfoModalOverlay')
      .classList.remove('active');
  }
  function initDeviceInfoModal() {
    document
      .getElementById('closeDeviceInfoModal')
      ?.addEventListener('click', closeDeviceInfoModal);
    document
      .getElementById('deviceInfoModalOverlay')
      ?.addEventListener('click', function (e) {
        if (e.target === this) closeDeviceInfoModal();
      });
    document.addEventListener('keydown', function (e) {
      if (
        e.key === 'Escape' &&
        document
          .getElementById('deviceInfoModalOverlay')
          .classList.contains('active')
      )
        closeDeviceInfoModal();
    });
  }

  async function addDevice(data) {
    try {
      await apiPost(API.devices, data);
      await loadDevicesPage(1, true);
      updateProductSelect();
      return true;
    } catch (e) {
      alert('Ошибка');
      return false;
    }
  }
  async function deleteDevice(id) {
    if (!confirm('Удалить?')) return;
    try {
      await apiDelete(API.devices, { id });
      await loadDevicesPage(1, true);
      updateProductSelect();
    } catch (e) {}
  }

  function renderDevicesTable() {
    const tb = document.getElementById('devicesTableBody');
    if (!tb) return;
    tb.innerHTML = '';
    const isAdmin = currentUserRole === 'admin';
    const colSpan = isAdmin ? 11 : 10;
    const visibleDevices = devices.filter(
      d => d.product && String(d.product).trim()
    );
    if (!visibleDevices.length) {
      tb.innerHTML = `<tr><td colspan="${colSpan}" class="no-records">Нет устройств</td></tr>`;
      return;
    }
    const thead = document.querySelector('#devicesTable thead tr');
    if (thead) {
      thead.innerHTML =
        '<th>Изделие</th><th>Устройство</th><th>Серийный номер</th><th>Основание поставки</th><th>Реквизиты СП</th><th>Реквизиты ЛСИ</th><th>Расположение</th><th>Характеристики</th><th>Примечание</th><th>Дата добавления</th>' +
        (isAdmin ? '<th>Действия</th>' : '');
    }
    visibleDevices.forEach(d => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHtml(d.product)}</td><td>${escapeHtml(d.device)}</td><td><a href="javascript:void(0)" onclick="openDeviceInfoModal('${escapeHtml(d.serialNumber)}')" class="serial-link">${escapeHtml(d.serialNumber)}</a></td><td>${escapeHtml(d.supplyBasis || '-')}</td><td>${escapeHtml(d.spRequisites || '-')}</td><td>${escapeHtml(d.lsiRequisites || '-')}</td><td>${escapeHtml(d.location || '-')}</td><td class="cell-ellipsis-120" title="${escapeHtml(d.specs || '')}">${escapeHtml(d.specs || '-')}</td><td class="cell-ellipsis-150" title="${escapeHtml(d.notes || '')}">${escapeHtml(d.notes || '-')}</td><td>${new Date(d.createdAt).toLocaleDateString('ru-RU')}</td>${isAdmin ? `<td><div class="action-buttons"><button class="edit-btn" title="Редактировать">${ICON('pencil')}</button><button class="delete-btn" title="Удалить">${ICON('trash')}</button></div></td>` : ''}`;
      if (isAdmin) {
        tr.querySelector('.delete-btn')?.addEventListener('click', () =>
          deleteDevice(d.id)
        );
        tr.querySelector('.edit-btn')?.addEventListener('click', () =>
          openDeviceEditModal(d.id)
        );
      }
      tb.appendChild(tr);
    });
    if (!devicesAllLoaded) {
      const tr = document.createElement('tr');
      tr.id = 'devicesLoader';
      tr.innerHTML = `<td colspan="${colSpan}" style="text-align:center;padding:1rem;color:var(--text-secondary);">Загрузка...</td>`;
      tb.appendChild(tr);
    }
  }
  function appendDevicesTable(newDevices) {
    const tb = document.getElementById('devicesTableBody');
    if (!tb) return;
    const loader = document.getElementById('devicesLoader');
    if (loader) loader.remove();
    const isAdmin = currentUserRole === 'admin';
    newDevices.forEach(d => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHtml(d.product)}</td><td>${escapeHtml(d.device)}</td><td><a href="javascript:void(0)" onclick="openDeviceInfoModal('${escapeHtml(d.serialNumber)}')" class="serial-link">${escapeHtml(d.serialNumber)}</a></td><td>${escapeHtml(d.supplyBasis || '-')}</td><td>${escapeHtml(d.spRequisites || '-')}</td><td>${escapeHtml(d.lsiRequisites || '-')}</td><td>${escapeHtml(d.location || '-')}</td><td class="cell-ellipsis-120" title="${escapeHtml(d.specs || '')}">${escapeHtml(d.specs || '-')}</td><td class="cell-ellipsis-150" title="${escapeHtml(d.notes || '')}">${escapeHtml(d.notes || '-')}</td><td>${new Date(d.createdAt).toLocaleDateString('ru-RU')}</td>${isAdmin ? `<td><div class="action-buttons"><button class="edit-btn" title="Редактировать">${ICON('pencil')}</button><button class="delete-btn" title="Удалить">${ICON('trash')}</button></div></td>` : ''}`;
      if (isAdmin) {
        tr.querySelector('.delete-btn')?.addEventListener('click', () =>
          deleteDevice(d.id)
        );
        tr.querySelector('.edit-btn')?.addEventListener('click', () =>
          openDeviceEditModal(d.id)
        );
      }
      tb.appendChild(tr);
    });
    if (!devicesAllLoaded) {
      const colSpan = isAdmin ? 11 : 10;
      const tr = document.createElement('tr');
      tr.id = 'devicesLoader';
      tr.innerHTML = `<td colspan="${colSpan}" style="text-align:center;padding:1rem;color:var(--text-secondary);">Загрузка...</td>`;
      tb.appendChild(tr);
    }
  }

  function updateDeviceFilterSelects() {
    const el = document.getElementById('filterDevProduct');
    if (!el) return;
    const cv = el.value;
    el.innerHTML = '<option value="">Все изделия</option>';
    [...new Set(devices.map(d => d.product).filter(Boolean))]
      .sort()
      .forEach(p => {
        const o = document.createElement('option');
        o.value = p;
        o.textContent = p;
        el.appendChild(o);
      });
    el.value = cv;
  }

  function initDevicesFilters() {
    ['filterDevProduct'].forEach(id =>
      document
        .getElementById(id)
        ?.addEventListener('change', () => loadDevicesPage(1, true))
    );
    [
      'filterDevDevice',
      'filterDevSerial',
      'filterDevLocation',
      'filterDevSupplyBasis',
      'filterDevSPRequisites',
      'filterDevLSIRequisites',
    ].forEach(id =>
      document.getElementById(id)?.addEventListener('input', function () {
        clearTimeout(this._debounce);
        this._debounce = setTimeout(() => loadDevicesPage(1, true), 500);
      })
    );
    document
      .getElementById('resetDevFiltersBtn')
      ?.addEventListener('click', () => {
        [
          'filterDevProduct',
          'filterDevDevice',
          'filterDevSerial',
          'filterDevLocation',
          'filterDevSupplyBasis',
          'filterDevSPRequisites',
          'filterDevLSIRequisites',
        ].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = '';
        });
        loadDevicesPage(1, true);
      });
  }

  function exportToCSV(data, columns, filename) {
    if (!data?.length) {
      alert('Нет данных');
      return;
    }
    let csv =
      '\uFEFF' +
      columns
        .map(c => '"' + (c.label || c).replace(/"/g, '""') + '"')
        .join(';') +
      '\n';
    data.forEach(row => {
      csv +=
        columns
          .map(c => {
            let v = row[c.id] || '';
            if (row.customFields?.[c.id]) v = row.customFields[c.id];
            return '"' + String(v).replace(/"/g, '""') + '"';
          })
          .join(';') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
      url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = filename + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function initExportButtons() {
    const exportRecordsBtn = document.getElementById('exportRecordsBtn');
    if (exportRecordsBtn) {
      const newBtn = exportRecordsBtn.cloneNode(true);
      exportRecordsBtn.parentNode.replaceChild(newBtn, exportRecordsBtn);
      newBtn.addEventListener('click', () => {
        const f = records;
        exportToCSV(
          f.map(r => ({
            ...r,
            createdAt: new Date(r.createdAt).toLocaleString('ru-RU'),
            importance: IMPORTANCE_LABELS[r.importance] || r.importance,
            status: STATUS_LABELS[r.status] || r.status,
          })),
          [
            { id: 'createdAt', label: 'Дата и время' },
            { id: 'username', label: 'Пользователь' },
            { id: 'requestNumber', label: '№ Заявки' },
            { id: 'importance', label: 'Важность' },
            { id: 'status', label: 'Статус' },
            { id: 'serialNumber', label: 'Серийный номер' },
            { id: 'product', label: 'Изделие' },
            { id: 'techType', label: 'Тип техники' },
            { id: 'location', label: 'Расположение' },
            { id: 'description', label: 'Описание' },
          ],
          'records_' + new Date().toISOString().slice(0, 10)
        );
      });
    }
    const exportDevicesBtn = document.getElementById('exportDevicesBtn');
    if (exportDevicesBtn) {
      const newBtn = exportDevicesBtn.cloneNode(true);
      exportDevicesBtn.parentNode.replaceChild(newBtn, exportDevicesBtn);
      newBtn.addEventListener('click', () => {
        const f = devices;
        exportToCSV(
          f.map(d => ({
            ...d,
            createdAt: new Date(d.createdAt).toLocaleDateString('ru-RU'),
          })),
          [
            { id: 'product', label: 'Изделие' },
            { id: 'device', label: 'Устройство' },
            { id: 'serialNumber', label: 'Серийный номер' },
            { id: 'supplyBasis', label: 'Основание поставки' },
            { id: 'spRequisites', label: 'Реквизиты СП' },
            { id: 'lsiRequisites', label: 'Реквизиты ЛСИ' },
            { id: 'location', label: 'Расположение' },
            { id: 'specs', label: 'Характеристики' },
            { id: 'notes', label: 'Примечание' },
            { id: 'createdAt', label: 'Дата добавления' },
          ],
          'devices_' + new Date().toISOString().slice(0, 10)
        );
      });
    }
    const printActBtn = document.getElementById('printActBtn');
    if (printActBtn) {
      const newBtn = printActBtn.cloneNode(true);
      printActBtn.parentNode.replaceChild(newBtn, printActBtn);
      newBtn.addEventListener('click', () => {
        const devs = devices;
        if (!devs.length) {
          alert('Нет устройств');
          return;
        }
        const now = new Date().toLocaleString('ru-RU');
        let h = `<html><head><meta charset="utf-8"><title>Акт</title><style>body{font-family:Arial;padding:40px}h1{text-align:center;font-size:18px}h2{text-align:center;font-size:14px}table{width:100%;border-collapse:collapse;margin-top:20px;font-size:12px}th,td{border:1px solid #000;padding:6px 8px}th{background:#f0f0f0}.footer{margin-top:40px;display:flex;justify-content:space-between}.sign{width:200px;border-top:1px solid #000;text-align:center;padding-top:5px}</style></head><body><h1>АКТ ПРИЁМА-ПЕРЕДАЧИ</h1><h2>от ${now}</h2><table><tr><th>№</th><th>Изделие</th><th>Устройство</th><th>Серийный №</th><th>Основание</th><th>Расположение</th></tr>`;
        devs.forEach((d, i) => {
          h += `<tr><td>${i + 1}</td><td>${d.product}</td><td>${d.device}</td><td>${d.serialNumber}</td><td>${d.supplyBasis || '-'}</td><td>${d.location || '-'}</td></tr>`;
        });
        h += `</table><div class="footer"><div class="sign">Сдал</div><div class="sign">Принял</div></div></body></html>`;
        const pw = window.open('', '_blank');
        pw.document.write(h);
        pw.document.close();
        pw.print();
      });
    }
  }

  function initImportButtons() {
    const btn = document.getElementById('importDevicesBtn'),
      inp = document.getElementById('importFileInput');
    if (!btn || !inp) return;
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    const newInp = inp.cloneNode(true);
    inp.parentNode.replaceChild(newInp, inp);
    newBtn.addEventListener('click', () => newInp.click());
    newInp.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async function (ev) {
        const lines = ev.target.result.split('\n');
        if (lines.length < 2) {
          alert('Файл пуст');
          return;
        }
        const headers = lines[0].replace(/"/g, '').split(';');
        let imported = 0;
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const vals = lines[i].split(';').map(v => v.replace(/"/g, '').trim());
          const dev = {};
          headers.forEach((h, j) => {
            if (h.trim() === 'Изделие') dev.product = vals[j] || '';
            else if (h.trim() === 'Устройство') dev.device = vals[j] || '';
            else if (h.trim() === 'Серийный номер')
              dev.serialNumber = vals[j] || '';
            else if (h.trim() === 'Основание поставки')
              dev.supplyBasis = vals[j] || '';
            else if (h.trim() === 'Реквизиты СП')
              dev.spRequisites = vals[j] || '';
            else if (h.trim() === 'Реквизиты ЛСИ')
              dev.lsiRequisites = vals[j] || '';
            else if (h.trim() === 'Расположение') dev.location = vals[j] || '';
            else if (h.trim() === 'Характеристики') dev.specs = vals[j] || '';
            else if (h.trim() === 'Примечание') dev.notes = vals[j] || '';
            else if (h.trim() === 'Гарантия до') dev.warranty = vals[j] || '';
          });
          if (dev.serialNumber) {
            try {
              await apiPost(API.devices, dev);
              imported++;
            } catch (ex) {}
          }
        }
        if (imported) {
          alert(`Импортировано: ${imported}`);
          await loadDevicesPage(1, true);
          updateProductSelect();
          await loadStatistics();
        } else alert('Не удалось импортировать');
      };
      reader.readAsText(file, 'UTF-8');
    });
  }

  async function loadStatistics() {
    try {
      const stats = await apiGet('/penny/statistics');
      renderStatisticsFromData(stats);
    } catch (e) {}
  }

  function renderStatisticsFromData(stats) {
    if (!document.getElementById('statisticsPage')) return;
    document.getElementById('statTotalDevices').textContent =
      stats.totalDevices;
    document.getElementById('statTotalRecords').textContent =
      stats.totalRecords;
    document.getElementById('statCompleted').textContent = stats.completed;
    document.getElementById('statInProgress').textContent = stats.inProgress;
    document.getElementById('statMalfunctions').textContent =
      stats.malfunctions;
    document.getElementById('statMoves').textContent = stats.moves;
    const stb = document.getElementById('statsTableBody');
    stb.innerHTML = '';
    const sp = Object.entries(stats.byProduct).sort(
      (a, b) => b[1].count - a[1].count
    );
    if (!sp.length)
      stb.innerHTML =
        '<tr><td colspan="6" class="no-records">Нет данных</td></tr>';
    else
      sp.forEach(([p, s]) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${escapeHtml(p)}</td><td>${s.count}</td><td>${s.records}</td><td>${s.malfunctions}</td><td>${s.moves}</td><td>${s.infos}</td>`;
        stb.appendChild(tr);
      });
    const sstb = document.getElementById('statusStatsTableBody');
    sstb.innerHTML = '';
    Object.entries(stats.byStatus).forEach(([key, s]) => {
      const labels = {
        malfunction: 'Неисправность',
        move: 'Перемещение',
        info: 'Информация',
        repair: 'Ремонт',
        replace: 'Замена',
        archive: 'Архив',
      };
      if (!labels[key]) return;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${labels[key]}</td><td>${s.total}</td><td>${s.completed}</td><td>${s.total - s.completed}</td>`;
      sstb.appendChild(tr);
    });
    const ustb = document.getElementById('userStatsTableBody');
    if (ustb) {
      ustb.innerHTML = '';
      const su = Object.entries(stats.byUser).sort(
        (a, b) => b[1].total - a[1].total
      );
      if (!su.length)
        ustb.innerHTML =
          '<tr><td colspan="8" class="no-records">Нет данных</td></tr>';
      else
        su.forEach(([un, s]) => {
          const pt =
            stats.totalRecords > 0
              ? ((s.total / stats.totalRecords) * 100).toFixed(1) + '%'
              : '0%';
          const tr = document.createElement('tr');
          tr.innerHTML = `<td><strong>${escapeHtml(un)}</strong></td><td>${s.total} (${pt})</td><td>${s.completed}</td><td>${s.inProgress}</td><td>${pt}</td><td>${s.malfunctions}</td><td>${s.moves}</td><td>${s.infos}</td>`;
          ustb.appendChild(tr);
        });
    }
    const wtb = document.getElementById('warrantyTableBody');
    if (wtb) {
      wtb.innerHTML = '';
      if (!stats.warrantyAlerts.length)
        wtb.innerHTML =
          '<tr><td colspan="4" class="no-records">Нет данных</td></tr>';
      else
        stats.warrantyAlerts.forEach(d => {
          const tr = document.createElement('tr');
          let st = ICON('check-circle') + ' Действует';
          if (d.status === 'expired') {
            st = ICON('x-circle') + ' Истекла';
            tr.style.background = 'rgba(255,71,87,0.1)';
          } else if (d.status === 'expiring') {
            st = ICON('alert-triangle') + ' Истекает';
            tr.style.background = 'rgba(255,165,2,0.1)';
          }
          tr.innerHTML = `<td>${escapeHtml(d.device)}</td><td>${escapeHtml(d.serialNumber)}</td><td>${new Date(d.warranty).toLocaleDateString('ru-RU')}</td><td>${st}</td>`;
          wtb.appendChild(tr);
        });
    }
  }

  const instructionsContent = {
    user_guide: `<div class="instructions-content"><h1><svg class="icon" aria-hidden="true"><use href="#i-book"/></svg> Руководство пользователя</h1><h2><svg class="icon" aria-hidden="true"><use href="#i-lock"/></svg> Вход в систему</h2><p>Откройте браузер и перейдите по адресу <strong>http://localhost:3000</strong>.</p><p>Введите логин и пароль. Учётные данные по умолчанию:</p><ul><li><strong>Администратор:</strong> admin / admin123</li><li><strong>Пользователь:</strong> user / user123</li></ul><h2><svg class="icon" aria-hidden="true"><use href="#i-edit"/></svg> Добавление записи</h2><p>Нажмите кнопку <strong>«Добавить запись»</strong>. Выберите статус: Информация, Перемещение или Неисправность.</p><h2><svg class="icon" aria-hidden="true"><use href="#i-tool"/></svg> Решение по неисправности</h2><p>У заявки со статусом Неисправность есть кнопка <strong>«Решение ▼»</strong> с выбором: Ремонт, Замена, Архив.</p><p>У заявки со статусом Ремонт — кнопка «Решение ▼» с выбором: Выполнено, Замена, Архив.</p><p>У заявки со статусом Замена — кнопка «Выполнено» для перевода в Замена (выполнено).</p></div>`,
    admin_guide: `<div class="instructions-content"><h1><svg class="icon" aria-hidden="true"><use href="#i-tool"/></svg> Руководство администратора</h1><h2><svg class="icon" aria-hidden="true"><use href="#i-settings"/></svg> Вся техника</h2><p>Добавление, редактирование, удаление устройств. Импорт/экспорт CSV, печать акта.</p><h2><svg class="icon" aria-hidden="true"><use href="#i-bar-chart"/></svg> Статистика</h2><p>По изделиям, статусам, пользователям. Контроль гарантийных сроков.</p></div>`,
    dev_guide: `<div class="instructions-content"><h1><svg class="icon" aria-hidden="true"><use href="#i-monitor"/></svg> Руководство разработчика</h1><p>Стек: ванильный JS (SPA) + Node.js. Данные в JSON-файлах.</p></div>`,
  };
  function switchInstructionTab(id) {
    if (
      (id === 'admin_guide' || id === 'dev_guide') &&
      currentUserRole !== 'admin'
    )
      return;
    document
      .querySelectorAll('.instruction-tab')
      .forEach(t => t.classList.toggle('active', t.dataset.tab === id));
    const c = document.getElementById('instructionsContent');
    if (c && instructionsContent[id]) c.innerHTML = instructionsContent[id];
  }
  function updateInstructionsTabs() {
    document
      .querySelectorAll('.admin-only')
      .forEach(
        t => (t.style.display = currentUserRole === 'admin' ? '' : 'none')
      );
  }
  function initInstructionTabs() {
    updateInstructionsTabs();
    document.querySelectorAll('.instruction-tab').forEach(t =>
      t.addEventListener('click', () => {
        if (
          (t.dataset.tab === 'admin_guide' || t.dataset.tab === 'dev_guide') &&
          currentUserRole !== 'admin'
        )
          return;
        switchInstructionTab(t.dataset.tab);
      })
    );
  }

  document
    .getElementById('addNavItemBtn')
    .addEventListener('click', openCreateSectionModal);
  document.getElementById('backupBtn')?.addEventListener('click', async () => {
    try {
      const r = await fetch(API.backup, { method: 'POST' });
      if (r.ok) showToast('Резервная копия создана');
      else alert('Ошибка');
    } catch (e) {
      alert('Ошибка');
    }
  });

  function setupInfiniteScroll(containerId, loadMoreFn) {
    const container = document
      .getElementById(containerId)
      ?.closest('.table-container');
    if (!container) return;
    container.addEventListener('scroll', function () {
      if (this.scrollTop + this.clientHeight >= this.scrollHeight - 200) {
        loadMoreFn();
      }
    });
  }

  async function init() {
    await loadData();
    await loadStatistics();
    applyTheme(localStorage.getItem('navipro_theme') || 'dark');
    updateUserUI();
    updateToggleButton();
    renderNavMenu();
    updateProductSelect();
    initInstructionTabs();
    initDevicesFilters();
    initCreateSectionModal();
    initExportButtons();
    initImportButtons();
    initDeviceEditModal();
    initAddRecordModal();
    initAddDeviceModal();
    initDeviceInfoModal();
    setupInfiniteScroll('recordsTable', () => {
      if (!recordsAllLoaded && !recordsLoading)
        loadRecordsPage(recordsPage + 1);
    });
    setupInfiniteScroll('devicesTable', () => {
      if (!devicesAllLoaded && !devicesLoading)
        loadDevicesPage(devicesPage + 1);
    });
    loadingScreen.classList.add('hidden');
    if (!restoreSession()) authContainer.classList.remove('hidden');
  }
  init();
})();
