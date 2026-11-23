// public/app.js
// Controlador de Escritorio — Sistema de Control de Asistencia y Personal ZKTeco

const state = {
  brand: null,
  companies: [],
  users: [],
  role: null,
  license: null,
  company: {
    companyName: '',
    branchName: '',
    weeklyMaxHours: 46,
    mealBreakMinutes: 60
  },
  employees: [],
  shifts: [],
  holidays: [],
  leaves: [],
  devices: [],
  device: null,
  recentLogs: [],
  currentReport: null
};

const VIEW_HEADERS = {
  reports: {
    title: 'Reporte de Asistencia',
    subtitle: 'Consulta de entradas, salidas, retardos, faltas y horas trabajadas'
  },
  employees: {
    title: 'Padrón de Empleados',
    subtitle: 'Altas, bajas y asignación de horario por trabajador'
  },
  rules: {
    title: 'Horarios, Vacaciones y Días Festivos',
    subtitle: 'Configuración de tolerancia de retardo, vacaciones y días inhábiles'
  },
  device: {
    title: 'Opciones de Checador ZKTeco y Datos de Empresa',
    subtitle: 'Agregue relojes checadores por Red IP, importe por USB o edite los datos del cliente'
  },
  companies: {
    title: 'Empresas',
    subtitle: 'Alta de clientes, logotipo, color y parámetros de jornada'
  },
  users: {
    title: 'Usuarios y Permisos',
    subtitle: 'Accesos y roles de cada usuario por empresa'
  },
  license: {
    title: 'Licencia y Respaldos',
    subtitle: 'Activación de la suscripción y copias de seguridad de la información'
  }
};

// Escapa texto antes de insertarlo en plantillas HTML (previene XSS almacenado)
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Descarga un archivo de la API enviando el token por encabezado (nunca en la URL)
async function downloadFile(path, fallbackName) {
  const headers = {};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  if (currentTenantId) headers['X-Tenant-ID'] = currentTenantId;
  const res = await fetch(path, { headers });
  if (!res.ok) {
    let message = 'No se pudo descargar el archivo.';
    try {
      message = (await res.json()).error?.message || message;
    } catch {}
    throw new Error(message);
  }
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = match ? match[1] : fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function showToast(message) {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.remove();
  }, 4000);
}

function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.hidden = false;
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.hidden = true;
}

// --- Marca blanca -----------------------------------------------------------
// El nombre, eslogan, logo y color del producto llegan del servidor (brand.json).
// Si la empresa tiene logo/color propio, éstos tienen prioridad.
const DEFAULT_ACCENT = '#FFB000'; // ámbar Aion (DESIGN.md)

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || ''));
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}

function mixRgb([r, g, b], [r2, g2, b2], t) {
  const c = (a, z) => Math.round(a + (z - a) * t);
  return `#${[c(r, r2), c(g, g2), c(b, b2)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// Calcula las variantes del color de marca (hover, suave, claro, texto encima)
function applyAccentColor(hex) {
  const rgb = hexToRgb(hex) || hexToRgb(DEFAULT_ACCENT);
  const root = document.documentElement.style;
  const [r, g, b] = rgb;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  root.setProperty('--brand-accent', mixRgb(rgb, rgb, 0));
  root.setProperty('--brand-accent-rgb', `${r}, ${g}, ${b}`);
  root.setProperty('--brand-accent-hover', mixRgb(rgb, [0, 0, 0], 0.15));
  root.setProperty('--brand-accent-soft', mixRgb(rgb, [255, 255, 255], 0.85));
  root.setProperty('--brand-accent-bright', luminance > 0.55 ? mixRgb(rgb, rgb, 0) : mixRgb(rgb, [255, 255, 255], 0.35));
  root.setProperty('--brand-on-accent', luminance > 0.6 ? '#111113' : '#FFFFFF');
}

function applyBranding() {
  const brand = state.brand || {};
  const company = state.company || {};
  const productName = brand.productName || 'Control de Asistencia';

  document.title = company.companyName ? `${productName} — ${company.companyName}` : productName;
  document.getElementById('appNameMeta')?.setAttribute('content', productName);
  document.querySelectorAll('[data-brand-name]').forEach((el) => (el.textContent = productName));
  if (brand.productTagline) {
    document.querySelectorAll('[data-brand-tagline]').forEach((el) => (el.textContent = brand.productTagline));
  }

  const brandLogo = brand.logoUrl || 'assets/brand-logo.svg';
  const companyLogo = company.logoUrl || brandLogo;
  document.querySelectorAll('img[data-logo]').forEach((img) => {
    if (img.getAttribute('src') !== companyLogo) img.src = companyLogo;
  });
  // El ícono de Aion va directo sobre el menú oscuro; el logo de un cliente lleva placa blanca
  // (suelen ser letras oscuras con fondo transparente, que no se verían sobre negro).
  document.querySelector('.brand-logo-wrap')?.classList.toggle('client-logo', Boolean(company.logoUrl));
  document.querySelectorAll('img[data-brand-logo]').forEach((img) => (img.src = brandLogo));
  const favicon = document.getElementById('faviconLink');
  if (favicon) favicon.href = brandLogo;

  applyAccentColor(brand.accentColor || DEFAULT_ACCENT);
}

const AUTH_STORAGE_KEY = 'app_auth_token';

try {
  localStorage.removeItem(AUTH_STORAGE_KEY);
} catch {}
let authToken = sessionStorage.getItem(AUTH_STORAGE_KEY) || '';
let currentUser = null;

// =============================================================================
// MULTIEMPRESA: empresa activa, selector, roles y administración
// =============================================================================
const TENANT_STORAGE_KEY = 'app_current_tenant';
const ROLE_LABELS = {
  VIEWER: 'Solo lectura',
  OPERATOR: 'Operador',
  ADMIN: 'Administrador',
  SUPERADMIN: 'Superadministrador'
};
let currentTenantId = '';
try {
  currentTenantId = sessionStorage.getItem(TENANT_STORAGE_KEY) || '';
} catch {}

function setCurrentTenant(id) {
  currentTenantId = id || '';
  try {
    if (currentTenantId) sessionStorage.setItem(TENANT_STORAGE_KEY, currentTenantId);
    else sessionStorage.removeItem(TENANT_STORAGE_KEY);
  } catch {}
}

// Al iniciar sesión: conservar la empresa elegida si sigue disponible, si no la primera
function adoptCompanies(companies) {
  state.companies = Array.isArray(companies) ? companies : [];
  const usable = state.companies.filter((c) => c.active !== false);
  if (!usable.some((c) => c.id === currentTenantId)) setCurrentTenant(usable[0]?.id || '');
}

function roleLabel(role) {
  return ROLE_LABELS[role] || role || '';
}

function applyRoleUI() {
  const role = state.role || 'VIEWER';
  document.body.dataset.role = role;
  document.body.dataset.superadmin = currentUser?.isSuperAdmin ? 'true' : 'false';
  const badge = document.getElementById('topUserRole');
  if (badge) {
    const r = currentUser?.isSuperAdmin ? 'SUPERADMIN' : role;
    badge.textContent = roleLabel(r).toUpperCase();
    badge.className = `user-role-badge role-badge role-${r}`;
  }
  // Si la vista actual quedó oculta para este rol, volver al dashboard
  const active = document.querySelector('.nav-item.active[data-view]');
  if (active && getComputedStyle(active).display === 'none') switchView('reports');
}

function renderCompanySwitcher() {
  const wrap = document.getElementById('companySwitcher');
  if (!wrap) return;
  const companies = (state.companies || []).filter((c) => c.active !== false);
  const current = companies.find((c) => c.id === currentTenantId) || null;
  wrap.hidden = !current;
  if (!current) return;

  document.getElementById('companySwitcherName').textContent = current.branchName
    ? `${current.name} · ${current.branchName}`
    : current.name;
  document.getElementById('companySwitcherDot').style.background =
    current.accentColor || state.brand?.accentColor || DEFAULT_ACCENT;

  const multi = companies.length > 1 || currentUser?.isSuperAdmin;
  const btn = document.getElementById('companySwitcherBtn');
  btn.disabled = !multi;
  btn.title = multi ? 'Cambiar de empresa' : current.name;
  document.getElementById('companySwitcherCaret').hidden = !multi;
  renderCompanySwitcherList();
}

function renderCompanySwitcherList() {
  const list = document.getElementById('companySwitcherList');
  if (!list) return;
  const q = (document.getElementById('companySwitcherSearch')?.value || '').trim().toLowerCase();
  const companies = (state.companies || [])
    .filter((c) => c.active !== false)
    .filter((c) => !q || `${c.name} ${c.branchName} ${c.rfc}`.toLowerCase().includes(q));
  if (companies.length === 0) {
    list.innerHTML = '<li class="company-switcher-empty">Sin coincidencias.</li>';
    return;
  }
  list.innerHTML = companies
    .map(
      (c) => `
      <li>
        <button type="button" class="company-option ${c.id === currentTenantId ? 'is-current' : ''}" data-company-id="${esc(c.id)}" role="option" aria-selected="${c.id === currentTenantId}">
          <span class="company-dot" style="background:${esc(c.accentColor || state.brand?.accentColor || DEFAULT_ACCENT)}"></span>
          <span class="company-option-text">
            <strong>${esc(c.name)}</strong>
            <span>${esc(c.branchName || 'Sin sucursal')} · ${esc(c.activeEmployees ?? 0)} empleados activos${c.licensed === false ? ' · <strong style="color:#B45309">fuera de licencia</strong>' : ''}</span>
          </span>
          <span class="role-badge role-${esc(c.role)}">${esc(roleLabel(c.role))}</span>
        </button>
      </li>`
    )
    .join('');
}

function toggleCompanySwitcher(open) {
  const panel = document.getElementById('companySwitcherPanel');
  const btn = document.getElementById('companySwitcherBtn');
  if (!panel || !btn || btn.disabled) return;
  const show = open ?? panel.hidden;
  panel.hidden = !show;
  btn.setAttribute('aria-expanded', String(show));
  if (show) {
    const search = document.getElementById('companySwitcherSearch');
    search.value = '';
    renderCompanySwitcherList();
    setTimeout(() => search.focus(), 0);
  }
}

async function switchCompany(companyId) {
  if (!companyId || companyId === currentTenantId) {
    toggleCompanySwitcher(false);
    return;
  }
  setCurrentTenant(companyId);
  toggleCompanySwitcher(false);
  state.currentReport = null;
  // Limpiar formularios con datos de la empresa anterior
  ['formEmployee', 'formDeviceSettings', 'formShift', 'formLeave', 'formHoliday'].forEach((id) =>
    document.getElementById(id)?.reset()
  );
  const devName = document.getElementById('devName');
  if (devName) devName.value = '';
  await refreshAllData();
  renderCompaniesTable();
  showToast(`Empresa activa: ${state.company?.companyName || ''}`);
}

function initCompanySwitcher() {
  document.getElementById('companySwitcherBtn')?.addEventListener('click', () => toggleCompanySwitcher());
  document.getElementById('companySwitcherSearch')?.addEventListener('input', renderCompanySwitcherList);
  document.getElementById('companySwitcherSearch')?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') toggleCompanySwitcher(false);
    if (e.key === 'Enter') {
      e.preventDefault();
      document.querySelector('#companySwitcherList .company-option')?.click();
    }
  });
  document.getElementById('companySwitcherList')?.addEventListener('click', (e) => {
    const opt = e.target.closest('[data-company-id]');
    if (opt) switchCompany(opt.dataset.companyId).catch((err) => showToast(err.message));
  });
  document.addEventListener('click', (e) => {
    const wrap = document.getElementById('companySwitcher');
    if (wrap && !wrap.contains(e.target)) toggleCompanySwitcher(false);
  });
}

// ---- Campos de marca (color + logotipo) reutilizables -----------------------
const MAX_LOGO_BYTES = 500 * 1024;

function renderBrandFields(prefix) {
  const box = document.querySelector(`[data-brand-fields="${prefix}"]`);
  if (!box || box.dataset.ready) return;
  box.dataset.ready = '1';
  box.innerHTML = `
    <div class="form-group">
      <label for="${prefix}Color">Color de la empresa</label>
      <div class="color-field">
        <input type="color" id="${prefix}Color" value="${DEFAULT_ACCENT}" />
        <input type="text" id="${prefix}ColorHex" maxlength="7" placeholder="#0E7C66" />
        <button type="button" class="btn btn-outline btn-sm" id="${prefix}ColorReset">Usar color del sistema</button>
      </div>
    </div>
    <div class="form-group">
      <label for="${prefix}LogoFile">Logotipo (PNG, JPG o WEBP · máx. 500 KB)</label>
      <div class="logo-field">
        <img class="logo-preview" id="${prefix}LogoPreview" alt="Vista previa del logotipo" src="assets/brand-logo.svg" />
        <div class="logo-field-actions">
          <input type="file" id="${prefix}LogoFile" accept="image/png,image/jpeg,image/webp" />
          <button type="button" class="btn btn-outline btn-sm" id="${prefix}LogoClear">Quitar logotipo</button>
          <span id="${prefix}LogoHint">Si no sube uno, se usa el logotipo del sistema.</span>
        </div>
      </div>
    </div>`;

  const color = document.getElementById(`${prefix}Color`);
  const hex = document.getElementById(`${prefix}ColorHex`);
  color.addEventListener('input', () => {
    hex.value = color.value.toUpperCase();
    box.dataset.accent = hex.value;
  });
  hex.addEventListener('input', () => {
    const v = hex.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      color.value = v;
      box.dataset.accent = v.toUpperCase();
    }
  });
  document.getElementById(`${prefix}ColorReset`).addEventListener('click', () => setBrandFields(prefix, { accentColor: '' }, true));

  document.getElementById(`${prefix}LogoFile`).addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      showToast('El logotipo debe ser PNG, JPG o WEBP.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      showToast('El logotipo es demasiado grande (máximo 500 KB).');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      box.dataset.logo = String(reader.result);
      document.getElementById(`${prefix}LogoPreview`).src = box.dataset.logo;
    };
    reader.readAsDataURL(file);
  });
  document.getElementById(`${prefix}LogoClear`).addEventListener('click', () => setBrandFields(prefix, { logoUrl: '' }, true));
}

// partial = true sólo actualiza los campos incluidos
function setBrandFields(prefix, { accentColor, logoUrl } = {}, partial = false) {
  renderBrandFields(prefix);
  const box = document.querySelector(`[data-brand-fields="${prefix}"]`);
  if (!box) return;
  if (!partial || accentColor !== undefined) {
    box.dataset.accent = accentColor || '';
    const shown = accentColor || state.brand?.accentColor || DEFAULT_ACCENT;
    document.getElementById(`${prefix}Color`).value = shown;
    document.getElementById(`${prefix}ColorHex`).value = accentColor ? accentColor.toUpperCase() : '';
  }
  if (!partial || logoUrl !== undefined) {
    box.dataset.logo = logoUrl || '';
    document.getElementById(`${prefix}LogoPreview`).src = logoUrl || state.brand?.logoUrl || 'assets/brand-logo.svg';
    document.getElementById(`${prefix}LogoFile`).value = '';
  }
}

function readBrandFields(prefix) {
  const box = document.querySelector(`[data-brand-fields="${prefix}"]`);
  return { accentColor: box?.dataset.accent || '', logoUrl: box?.dataset.logo || '' };
}

// ---- Vista: Empresas ---------------------------------------------------------
async function loadCompaniesView() {
  if (!currentUser?.isSuperAdmin) return;
  const [companies, lic] = await Promise.all([apiRequest('/api/v1/companies'), apiRequest('/api/v1/license')]);
  state.companies = companies;
  state.license = lic;
  renderLicenseBanner();
  renderCompaniesTable();
  renderCompanySwitcher();
}

function renderCompaniesTable() {
  const tbody = document.getElementById('tbodyCompanies');
  if (!tbody) return;
  const list = state.companies || [];
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay empresas registradas.</td></tr>';
    return;
  }
  tbody.innerHTML = list
    .map((c) => {
      const visual = c.logoUrl
        ? `<img class="company-thumb" src="${esc(c.logoUrl)}" alt="" />`
        : `<span class="company-color-swatch" style="background:${esc(c.accentColor || state.brand?.accentColor || DEFAULT_ACCENT)}"></span>`;
      return `
      <tr>
        <td>
          <div class="company-cell">
            ${visual}
            <div>
              <strong>${esc(c.name)}</strong>
              <div style="font-size:12px;color:#6B6B73">${esc(c.branchName || 'Sin sucursal')}${c.id === currentTenantId ? ' · <em>activa</em>' : ''}</div>
            </div>
          </div>
        </td>
        <td>${esc(c.rfc || '—')}</td>
        <td class="text-center">${esc(c.activeEmployees ?? 0)}</td>
        <td>
          <span class="status-pill ${c.active ? 'status-ASISTENCIA' : 'status-FALTA'}">${c.active ? 'Activa' : 'Inactiva'}</span>
          ${c.active && c.licensed === false ? '<span class="status-pill status-RETARDO" title="Sólo lectura: excede las empresas de la licencia">Fuera de licencia</span>' : ''}
        </td>
        <td class="text-right">
          ${c.active && c.id !== currentTenantId ? `<button class="btn btn-outline btn-sm" data-company-action="open" data-id="${esc(c.id)}">Abrir</button>` : ''}
          <button class="btn btn-outline btn-sm" data-company-action="edit" data-id="${esc(c.id)}">Editar</button>
          <button class="btn-danger-ghost" data-company-action="toggle" data-id="${esc(c.id)}">${c.active ? 'Desactivar' : 'Activar'}</button>
        </td>
      </tr>`;
    })
    .join('');
}

function resetCompanyAdminForm() {
  document.getElementById('formCompanyAdmin')?.reset();
  document.getElementById('caId').value = '';
  document.getElementById('companyFormTitle').textContent = 'Nueva Empresa';
  document.getElementById('caWeekly').value = '46';
  document.getElementById('caMeal').value = '60';
  setBrandFields('ca', { accentColor: '', logoUrl: '' });
}

function loadCompanyIntoAdminForm(c) {
  document.getElementById('caId').value = c.id;
  document.getElementById('caName').value = c.name || '';
  document.getElementById('caBranch').value = c.branchName || '';
  document.getElementById('caRfc').value = c.rfc || '';
  document.getElementById('caWeekly').value = String(c.weeklyMaxHours || 46);
  document.getElementById('caMeal').value = String(c.mealBreakMinutes ?? 60);
  document.getElementById('companyFormTitle').textContent = `Editando: ${c.name}`;
  setBrandFields('ca', { accentColor: c.accentColor || '', logoUrl: c.logoUrl || '' });
  document.getElementById('caName').focus();
}

function initCompaniesView() {
  renderBrandFields('ca');
  document.getElementById('btnNewCompany')?.addEventListener('click', () => {
    resetCompanyAdminForm();
    document.getElementById('caName').focus();
  });
  document.getElementById('btnResetCompanyAdmin')?.addEventListener('click', resetCompanyAdminForm);

  document.getElementById('formCompanyAdmin')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('caId').value;
    const payload = {
      ...(id ? { id } : {}),
      name: document.getElementById('caName').value,
      branchName: document.getElementById('caBranch').value,
      rfc: document.getElementById('caRfc').value,
      weeklyMaxHours: Number(document.getElementById('caWeekly').value),
      mealBreakMinutes: Number(document.getElementById('caMeal').value),
      ...readBrandFields('ca')
    };
    try {
      const saved = await apiRequest('/api/v1/companies', { method: 'POST', body: JSON.stringify(payload) });
      showToast(id ? 'Empresa actualizada.' : `Empresa "${saved.name}" creada con sus horarios y checador base.`);
      resetCompanyAdminForm();
      await loadCompaniesView();
      if (id && id === currentTenantId) await refreshAllData();
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById('tbodyCompanies')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-company-action]');
    if (!btn) return;
    const c = (state.companies || []).find((x) => x.id === btn.dataset.id);
    if (!c) return;
    try {
      if (btn.dataset.companyAction === 'edit') {
        // La lista resumida no trae todos los campos; se completan con los del catálogo
        loadCompanyIntoAdminForm({ weeklyMaxHours: 46, mealBreakMinutes: 60, ...c });
      } else if (btn.dataset.companyAction === 'open') {
        await switchCompany(c.id);
        renderCompaniesTable();
      } else if (btn.dataset.companyAction === 'toggle') {
        if (c.active && !confirm(`¿Desactivar "${c.name}"? Sus usuarios dejarán de verla (los datos se conservan).`)) return;
        await apiRequest(`/api/v1/companies/${encodeURIComponent(c.id)}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ active: !c.active })
        });
        await loadCompaniesView();
        showToast(c.active ? 'Empresa desactivada.' : 'Empresa activada.');
      }
    } catch (err) {
      showToast(err.message);
    }
  });
}

// ---- Vista: Usuarios ---------------------------------------------------------
async function loadUsersView() {
  if (!currentUser?.isSuperAdmin) return;
  const [users, companies] = await Promise.all([apiRequest('/api/v1/users'), apiRequest('/api/v1/companies')]);
  state.users = users;
  state.companies = companies;
  renderUsersTable();
  renderAccessMatrix(collectAccessFromMatrix());
}

function renderUsersTable() {
  const tbody = document.getElementById('tbodyUsers');
  if (!tbody) return;
  const byId = new Map((state.companies || []).map((c) => [c.id, c]));
  tbody.innerHTML = (state.users || [])
    .map((u) => {
      const access = u.isSuperAdmin
        ? `<span class="role-badge role-SUPERADMIN">${roleLabel('SUPERADMIN')}</span>`
        : `<div class="access-chips">${(u.access || [])
            .map((a) => `<span class="access-chip">${esc(byId.get(a.companyId)?.name || a.companyId)} <span class="role-badge role-${esc(a.role)}">${esc(roleLabel(a.role))}</span></span>`)
            .join('') || '<em style="color:#6B6B73">Sin empresas</em>'}</div>`;
      return `
      <tr>
        <td><strong>${esc(u.fullName)}</strong><div style="font-size:12px;color:#6B6B73">${esc(u.username)}${u.id === currentUser?.id ? ' · <em>usted</em>' : ''}</div></td>
        <td>${access}</td>
        <td><span class="status-pill ${u.active ? 'status-ASISTENCIA' : 'status-FALTA'}">${u.active ? 'Activo' : 'Inactivo'}</span></td>
        <td class="text-right">
          <button class="btn btn-outline btn-sm" data-user-action="edit" data-id="${esc(u.id)}">Editar</button>
          ${u.id !== currentUser?.id ? `<button class="btn-danger-ghost" data-user-action="toggle" data-id="${esc(u.id)}">${u.active ? 'Desactivar' : 'Activar'}</button>` : ''}
        </td>
      </tr>`;
    })
    .join('');
}

function renderAccessMatrix(access = []) {
  const box = document.getElementById('uaAccessMatrix');
  if (!box) return;
  const roleOf = new Map(access.map((a) => [a.companyId, a.role]));
  const companies = state.companies || [];
  if (companies.length === 0) {
    box.innerHTML = '<div class="company-switcher-empty">Primero dé de alta una empresa.</div>';
    return;
  }
  box.innerHTML = companies
    .map((c) => {
      const r = roleOf.get(c.id) || '';
      const opt = (v, label) => `<option value="${v}" ${r === v ? 'selected' : ''}>${label}</option>`;
      return `
      <div class="access-row">
        <span title="${esc(c.name)}">${esc(c.name)}${c.active ? '' : ' (inactiva)'}</span>
        <select data-access-company="${esc(c.id)}" aria-label="Rol en ${esc(c.name)}">
          ${opt('', 'Sin acceso')}${opt('VIEWER', 'Solo lectura')}${opt('OPERATOR', 'Operador')}${opt('ADMIN', 'Administrador')}
        </select>
      </div>`;
    })
    .join('');
}

function collectAccessFromMatrix() {
  return [...document.querySelectorAll('#uaAccessMatrix select[data-access-company]')]
    .filter((s) => s.value)
    .map((s) => ({ companyId: s.dataset.accessCompany, role: s.value }));
}

function syncSuperAdminCheckbox() {
  const isSuper = document.getElementById('uaSuperAdmin').checked;
  document.getElementById('uaAccessGroup').style.opacity = isSuper ? '0.5' : '';
}

function resetUserAdminForm() {
  document.getElementById('formUserAdmin')?.reset();
  document.getElementById('uaId').value = '';
  document.getElementById('uaUsername').disabled = false;
  document.getElementById('uaActive').checked = true;
  document.getElementById('uaPasswordLabel').textContent = 'Contraseña *';
  document.getElementById('uaPassword').placeholder = 'Mínimo 4 caracteres';
  document.getElementById('userFormTitle').textContent = 'Nuevo Usuario';
  renderAccessMatrix([]);
  syncSuperAdminCheckbox();
}

function loadUserIntoAdminForm(u) {
  document.getElementById('uaId').value = u.id;
  document.getElementById('uaUsername').value = u.username;
  document.getElementById('uaUsername').disabled = true;
  document.getElementById('uaFullName').value = u.fullName || '';
  document.getElementById('uaPassword').value = '';
  document.getElementById('uaPasswordLabel').textContent = 'Nueva contraseña (opcional)';
  document.getElementById('uaPassword').placeholder = 'Déjelo vacío para no cambiarla';
  document.getElementById('uaSuperAdmin').checked = Boolean(u.isSuperAdmin);
  document.getElementById('uaActive').checked = Boolean(u.active);
  document.getElementById('userFormTitle').textContent = `Editando: ${u.fullName}`;
  renderAccessMatrix(u.access || []);
  syncSuperAdminCheckbox();
}

function initUsersView() {
  document.getElementById('btnNewUser')?.addEventListener('click', () => {
    resetUserAdminForm();
    document.getElementById('uaUsername').focus();
  });
  document.getElementById('btnResetUserAdmin')?.addEventListener('click', resetUserAdminForm);
  document.getElementById('uaSuperAdmin')?.addEventListener('change', syncSuperAdminCheckbox);

  document.getElementById('formUserAdmin')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('uaId').value;
    const payload = {
      ...(id ? { id } : { username: document.getElementById('uaUsername').value }),
      fullName: document.getElementById('uaFullName').value,
      password: document.getElementById('uaPassword').value,
      globalRole: document.getElementById('uaSuperAdmin').checked ? 'SUPERADMIN' : 'USER',
      active: document.getElementById('uaActive').checked,
      access: collectAccessFromMatrix()
    };
    try {
      await apiRequest('/api/v1/users', { method: 'POST', body: JSON.stringify(payload) });
      showToast(id ? 'Usuario actualizado.' : 'Usuario creado.');
      resetUserAdminForm();
      await loadUsersView();
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById('tbodyUsers')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-user-action]');
    if (!btn) return;
    const u = (state.users || []).find((x) => x.id === btn.dataset.id);
    if (!u) return;
    try {
      if (btn.dataset.userAction === 'edit') {
        loadUserIntoAdminForm(u);
      } else if (btn.dataset.userAction === 'toggle') {
        if (u.active && !confirm(`¿Desactivar a ${u.fullName}? Ya no podrá iniciar sesión.`)) return;
        await apiRequest('/api/v1/users', { method: 'POST', body: JSON.stringify({ id: u.id, active: !u.active }) });
        await loadUsersView();
        showToast(u.active ? 'Usuario desactivado.' : 'Usuario activado.');
      }
    } catch (err) {
      showToast(err.message);
    }
  });
}


// ---- Licencia y respaldos -----------------------------------------------------
const LICENSE_LABELS = {
  UNLICENSED: 'SIN LICENCIA',
  ACTIVE: 'LICENCIA ACTIVA',
  EXPIRING: 'POR VENCER',
  EXPIRED: 'VENCIDA',
  INVALID: 'NO VÁLIDA'
};

function formatDateEs(isoDate) {
  if (!isoDate) return '';
  const d = new Date(`${String(isoDate).slice(0, 10)}T12:00:00`);
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

function renderLicenseBanner() {
  const lic = state.license;
  const banner = document.getElementById('licenseBanner');
  if (!banner) return;
  document.body.dataset.readonly = lic?.readOnly ? 'true' : 'false';
  if (!lic || (lic.state === 'ACTIVE' && !lic.overLimit)) {
    banner.hidden = true;
    return;
  }
  let text = '';
  let cls = '';
  if (lic.overLimit && !lic.readOnly) {
    text = `Tiene ${lic.activeCompanies} empresas activas y su licencia (${lic.planLabel}) permite ${lic.maxCompanies}. Las empresas fuera de licencia quedan en sólo lectura.`;
    cls = 'is-danger';
  } else if (lic.state === 'UNLICENSED') {
    text = 'Este equipo aún no tiene licencia. Active su clave para empezar a capturar (mientras tanto, sólo consulta).';
    cls = 'is-info';
  } else if (lic.state === 'EXPIRING') {
    text = `Su licencia vence en ${lic.daysLeft} día(s) (${formatDateEs(lic.expiresAt)}). Solicite su renovación.`;
  } else {
    text = `${lic.reason || 'La licencia no está vigente.'} Modo de sólo lectura: puede consultar y exportar, pero no capturar.`;
    cls = 'is-danger';
  }
  banner.className = `license-banner no-print ${cls}`;
  document.getElementById('licenseBannerText').textContent = text;
  banner.hidden = false;
}

function renderLicenseStatus() {
  const lic = state.license;
  const box = document.getElementById('licenseStatusBox');
  if (!box || !lic) return;
  document.getElementById('licenseMachineCode').textContent = lic.machineCode || '—';
  const lines = [`<span class="license-state state-${esc(lic.state)}">${esc(LICENSE_LABELS[lic.state] || lic.state)}</span>`];
  if (lic.customer) lines.push(`<div><strong>Cliente:</strong> ${esc(lic.customer)}</div>`);
  if (lic.planLabel) {
    const max = lic.maxCompanies === 0 ? 'ilimitadas' : lic.maxCompanies;
    lines.push(`<div><strong>Plan:</strong> ${esc(lic.planLabel)}</div>`);
    lines.push(
      `<div><strong>Empresas activas:</strong> ${esc(lic.activeCompanies ?? 0)} de ${esc(max)}${lic.overLimit ? ' <span style="color:#C8281E;font-weight:700">(excede el plan)</span>' : ''}</div>`
    );
  }
  if (lic.expiresAt) {
    lines.push(`<div><strong>Vigente hasta:</strong> ${esc(formatDateEs(lic.expiresAt))}${typeof lic.daysLeft === 'number' && lic.daysLeft >= 0 ? ` (${esc(lic.daysLeft)} días)` : ''}</div>`);
  }
  if (lic.reason) lines.push(`<div style="color:#C8281E">${esc(lic.reason)}</div>`);
  box.innerHTML = lines.join('');
}

function formatBytes(n) {
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

async function loadLicenseView() {
  if (!currentUser?.isSuperAdmin) return;
  const [lic, bk] = await Promise.all([apiRequest('/api/v1/license'), apiRequest('/api/v1/backups')]);
  state.license = lic;
  renderLicenseStatus();
  renderLicenseBanner();

  const tbody = document.getElementById('tbodyBackups');
  const pendingBox = document.getElementById('restorePendingBox');
  document.getElementById('btnBackupNow').disabled = !bk.enabled;
  pendingBox.hidden = !bk.pendingRestore;
  if (bk.pendingRestore) {
    pendingBox.textContent = `Restauración pendiente: "${bk.pendingRestore}". Cierre y vuelva a abrir el programa para aplicarla (se guardará antes una copia de los datos actuales).`;
  }
  if (!bk.enabled) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Respaldos no disponibles en este modo.</td></tr>';
    return;
  }
  if (bk.backups.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Aún no hay respaldos.</td></tr>';
    return;
  }
  tbody.innerHTML = bk.backups
    .map(
      (b) => `
      <tr>
        <td><strong>${esc(new Date(b.createdAt).toLocaleString('es-MX'))}</strong><div style="font-size:11.5px;color:#6B6B73">${esc(b.name)}</div></td>
        <td><span class="badge ${b.automatic ? 'badge-blue' : 'badge-amber'}">${b.automatic ? 'Automático' : 'Manual'}</span></td>
        <td class="text-right">${esc(formatBytes(b.sizeBytes))}</td>
        <td class="text-right">
          <button class="btn btn-outline btn-sm" data-backup-action="download" data-name="${esc(b.name)}">Descargar</button>
          <button class="btn-danger-ghost" data-backup-action="restore" data-name="${esc(b.name)}">Restaurar</button>
        </td>
      </tr>`
    )
    .join('');
}

function initLicenseView() {
  document.getElementById('licenseBannerBtn')?.addEventListener('click', () => switchView('license'));

  document.getElementById('btnCopyMachineCode')?.addEventListener('click', async () => {
    const code = document.getElementById('licenseMachineCode').textContent;
    try {
      await navigator.clipboard.writeText(code);
      showToast('Código de equipo copiado.');
    } catch {
      showToast(`Código de equipo: ${code}`);
    }
  });

  document.getElementById('formLicense')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = document.getElementById('licenseKeyInput').value.trim();
    if (!key) return showToast('Pegue la clave de licencia.');
    try {
      state.license = await apiRequest('/api/v1/license', { method: 'POST', body: JSON.stringify({ key }) });
      document.getElementById('licenseKeyInput').value = '';
      renderLicenseStatus();
      renderLicenseBanner();
      applyRoleUI();
      showToast(`Licencia activada hasta el ${formatDateEs(state.license.expiresAt)}.`);
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById('btnBackupNow')?.addEventListener('click', async () => {
    try {
      const b = await apiRequest('/api/v1/backups', { method: 'POST' });
      showToast(`Respaldo creado: ${b.name}`);
      await loadLicenseView();
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById('tbodyBackups')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-backup-action]');
    if (!btn) return;
    const name = btn.dataset.name;
    try {
      if (btn.dataset.backupAction === 'download') {
        await downloadFile(`/api/v1/backups/${encodeURIComponent(name)}/download`, name);
      } else if (btn.dataset.backupAction === 'restore') {
        const ok = confirm(
          `¿Restaurar el respaldo "${name}"?\n\nTODAS las empresas regresarán a como estaban en ese momento. ` +
            'Se guardará antes una copia de los datos actuales. El cambio se aplica al cerrar y volver a abrir el programa.'
        );
        if (!ok) return;
        await apiRequest(`/api/v1/backups/${encodeURIComponent(name)}/restore`, { method: 'POST' });
        await loadLicenseView();
        showToast('Restauración programada. Cierre y vuelva a abrir el programa.');
      }
    } catch (err) {
      showToast(err.message);
    }
  });
}

async function logout() {
  try {
    await apiRequest('/api/v1/auth/logout', { method: 'POST' });
  } catch {}
  authToken = '';
  currentUser = null;
  state.companies = [];
  state.role = null;
  try {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {}
  setCurrentTenant('');
  location.reload();
}

function renderAuthStatus() {
  const container = document.getElementById('authContainer');
  const userFullNameEl = document.getElementById('topUserFullName');
  const sidebarUserEl = document.getElementById('sidebarUserFullName');
  if (currentUser) {
    if (container) container.hidden = false;
    const name = currentUser.fullName || currentUser.username || 'Administrador';
    if (userFullNameEl) userFullNameEl.textContent = name;
    if (sidebarUserEl) sidebarUserEl.textContent = name;
  } else {
    if (container) container.hidden = true;
  }
}

function initAuthListeners() {
  const form = document.getElementById('formLogin');
  const btn = document.getElementById('btnLoginSubmit');
  const alertBox = document.getElementById('loginErrorMsg');
  const passInput = document.getElementById('loginPassword');

  const doLogin = async () => {
    if (alertBox) alertBox.style.display = 'none';
    const username = (document.getElementById('loginUsername')?.value || '').trim();
    const password = passInput?.value || '';

    if (!username || !password) {
      if (alertBox) {
        alertBox.textContent = 'Por favor ingrese usuario y contraseña.';
        alertBox.style.display = 'block';
      }
      return;
    }

    try {
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Verificando...';
      }
      const res = await apiRequest('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      authToken = res.token;
      currentUser = res.user;
      sessionStorage.setItem(AUTH_STORAGE_KEY, authToken);
      adoptCompanies(res.companies);

      const loginModal = document.getElementById('modalLogin');
      if (loginModal) loginModal.hidden = true;
      const appLayout = document.getElementById('appLayout');
      if (appLayout) appLayout.style.display = '';

      renderAuthStatus();
      showToast(`¡Bienvenido, ${currentUser.fullName || currentUser.username}!`);
      await refreshAllData();
    } catch (err) {
      if (alertBox) {
        alertBox.textContent = err.message || 'Usuario o contraseña incorrectos.';
        alertBox.style.display = 'block';
      } else {
        showToast(err.message || 'Usuario o contraseña incorrectos.');
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🔐 Iniciar Sesión';
      }
    }
  };

  btn?.addEventListener('click', (e) => {
    e.preventDefault();
    doLogin();
  });

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    doLogin();
  });

  passInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      doLogin();
    }
  });
}

// Inicializar listeners de autenticación y configuración inmediatamente
initAuthListeners();
initSetupListeners();

function initSetupListeners() {
  const form = document.getElementById('formInitialSetup');
  const btn = document.getElementById('btnInitialSetupSubmit');
  const alertBox = document.getElementById('setupErrorMsg');

  let setupBusy = false;

  // Muestra el error de forma visible: el cuadro está arriba del modal y el botón abajo,
  // así que se desplaza hasta él, enfoca el campo con problema y además muestra un aviso.
  const showSetupError = (message, fieldId) => {
    if (alertBox) {
      alertBox.textContent = message;
      alertBox.style.display = 'block';
      alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    showToast(message);
    const field = fieldId ? document.getElementById(fieldId) : null;
    if (field) {
      field.style.borderColor = '#C8281E';
      field.addEventListener('input', () => field.style.removeProperty('border-color'), { once: true });
      setTimeout(() => field.focus({ preventScroll: true }), 300);
    }
  };

  const doSetup = async () => {
    if (setupBusy) return; // evita doble envío (clic + Enter)
    if (alertBox) alertBox.style.display = 'none';

    const companyName = (document.getElementById('setupCompanyName')?.value || '').trim();
    const branchName = (document.getElementById('setupBranchName')?.value || '').trim();
    const deviceIp = (document.getElementById('setupDeviceIp')?.value || '').trim();
    const devicePort = Number(document.getElementById('setupDevicePort')?.value || 4370);
    const fullName = (document.getElementById('setupAdminFullName')?.value || '').trim();
    const username = (document.getElementById('setupAdminUsername')?.value || '').trim();
    // El servidor recorta espacios: validar igual aquí para que los mensajes coincidan
    const pass = (document.getElementById('setupAdminPassword')?.value || '').trim();
    const confirmPass = (document.getElementById('setupAdminPasswordConfirm')?.value || '').trim();

    if (!companyName) return showSetupError('Ingrese el nombre de la empresa.', 'setupCompanyName');
    if (!branchName) return showSetupError('Ingrese el nombre de la sucursal.', 'setupBranchName');
    if (!fullName) return showSetupError('Ingrese el nombre completo del administrador.', 'setupAdminFullName');
    if (username.length < 3) {
      return showSetupError('El nombre de usuario debe tener al menos 3 caracteres.', 'setupAdminUsername');
    }
    if (pass.length < 4) {
      return showSetupError('La contraseña debe tener al menos 4 caracteres.', 'setupAdminPassword');
    }
    if (pass !== confirmPass) {
      return showSetupError(
        'Las contraseñas no coinciden. Escríbalas de nuevo (revise que el navegador no las haya autocompletado).',
        'setupAdminPasswordConfirm'
      );
    }

    setupBusy = true;
    try {
      if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Configurando sistema...';
      }

      const res = await apiRequest('/api/v1/auth/setup', {
        method: 'POST',
        body: JSON.stringify({
          companyName,
          branchName,
          deviceIp,
          devicePort,
          fullName,
          username,
          password: pass
        })
      });

      authToken = res.token;
      currentUser = res.user;
      sessionStorage.setItem(AUTH_STORAGE_KEY, authToken);
      adoptCompanies(res.companies);

      closeModal('modalInitialSetup');
      const appLayout = document.getElementById('appLayout');
      if (appLayout) appLayout.style.display = '';

      renderAuthStatus();
      showToast(`¡Configuración inicial completada! Bienvenido, ${currentUser.fullName}.`);
      await refreshAllData();
    } catch (err) {
      if (err.code === 'ALREADY_INITIALIZED') {
        // El sistema ya quedó configurado (p. ej. en un intento anterior): pasar al inicio de sesión
        closeModal('modalInitialSetup');
        const loginModal = document.getElementById('modalLogin');
        if (loginModal) loginModal.hidden = false;
        const loginUser = document.getElementById('loginUsername');
        if (loginUser && username) loginUser.value = username;
        showToast('El sistema ya estaba configurado. Inicie sesión con el usuario administrador.');
        return;
      }
      showSetupError(err.message || 'Error al guardar la configuración inicial.');
    } finally {
      setupBusy = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🚀 Finalizar configuración';
      }
    }
  };

  btn?.addEventListener('click', (e) => {
    e.preventDefault();
    doSetup();
  });

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    doSetup();
  });
}

async function apiRequest(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  // Empresa activa: el servidor verifica que el usuario tenga acceso a ella
  if (currentTenantId) {
    headers['X-Tenant-ID'] = currentTenantId;
  }

  let res;
  try {
    res = await fetch(path, {
      ...options,
      headers
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor local del sistema. Cierre y vuelva a abrir el programa.');
  }
  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Respuesta inválida del servidor (HTTP ${res.status}).`);
  }
  if (res.status === 401) {
    authToken = '';
    currentUser = null;
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    renderAuthStatus();
    // Sin administrador todavía → mostrar configuración inicial, no el login
    const needsSetup = json.error?.code === 'SETUP_REQUIRED';
    document.getElementById('modalInitialSetup').hidden = !needsSetup;
    document.getElementById('modalLogin').hidden = needsSetup;
    document.getElementById('appLayout').style.display = 'none';
    const err = new Error(json.error?.message || 'Debe iniciar sesión como Administrador.');
    err.code = json.error?.code;
    throw err;
  }
  if (!res.ok || json.error) {
    const err = new Error(json.error?.message || 'Error procesando la solicitud');
    err.code = json.error?.code;
    throw err;
  }
  return json.data;
}

function setDefaultReportDates() {
  // Fecha LOCAL (toISOString usa UTC: en México, después de las 18:00 daría el día siguiente)
  const localIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 6);
  const startInput = document.getElementById('repStartDate');
  const endInput = document.getElementById('repEndDate');
  // Por omisión: los últimos 7 días hasta hoy
  if (!startInput.value) startInput.value = localIso(weekAgo);
  if (!endInput.value) endInput.value = localIso(today);

  const todayIso = localIso(today);
  if (document.getElementById('empHireDate')) document.getElementById('empHireDate').value = todayIso;
  if (document.getElementById('leaveStart')) document.getElementById('leaveStart').value = todayIso;
  if (document.getElementById('leaveEnd')) document.getElementById('leaveEnd').value = todayIso;
  if (document.getElementById('holidayDate')) document.getElementById('holidayDate').value = todayIso;
}

function renderCompanyBranding() {
  const co = state.company || {};
  const companyName = co.companyName || '';
  const branchName = co.branchName || '';

  applyBranding();

  const sidebarCompany = document.getElementById('sidebarCompanyName');
  if (sidebarCompany) sidebarCompany.textContent = companyName;
  const badge = document.getElementById('sidebarBranchBadge');
  if (badge) {
    badge.textContent = branchName.toUpperCase();
    badge.hidden = !branchName;
  }
  const sidebarSubtitle = document.getElementById('sidebarCompanyTitle');
  if (sidebarSubtitle && state.brand?.productName) {
    sidebarSubtitle.textContent = `${state.brand.productName} · ${state.brand.productTagline || ''}`.replace(/ · $/, '');
  }

  const printHeader = document.getElementById('printCompanyHeader');
  if (printHeader) printHeader.textContent = [companyName, branchName].filter(Boolean).join(' — ').toUpperCase();

  const printSig = document.getElementById('printSigCompany');
  if (printSig) printSig.textContent = branchName ? `${companyName} (${branchName})` : companyName;

  const compNameInput = document.getElementById('compName');
  if (compNameInput) compNameInput.value = companyName;
  const compBranchInput = document.getElementById('compBranch');
  if (compBranchInput) compBranchInput.value = branchName;
  const compWeeklyInput = document.getElementById('compWeeklyHours');
  if (compWeeklyInput) compWeeklyInput.value = String(co.weeklyMaxHours || 46);
  const compMealInput = document.getElementById('compMealMinutes');
  if (compMealInput) compMealInput.value = String(co.mealBreakMinutes ?? 60);
  setBrandFields('comp', { accentColor: co.accentColor || '', logoUrl: co.logoUrl || '' });
}

function renderTopbarKpis() {
  const activeCount = state.employees.filter((e) => e.active).length;
  document.getElementById('topActiveEmployees').textContent = String(activeCount);
  document.getElementById('topTotalLogs').textContent = String(state.recentLogs.length);

  if (state.device) {
    const devNameEl = document.getElementById('sidebarDeviceName');
    if (devNameEl) devNameEl.textContent = state.device.deviceName;
    const devIpEl = document.getElementById('sidebarDeviceIp');
    if (devIpEl) devIpEl.textContent = `IP: ${state.device.ipAddress}:${state.device.port}`;
  }
}

function renderDevicesTable() {
  const tbody = document.getElementById('tbodyDevicesList');
  if (!tbody) return;
  if (!state.devices || state.devices.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center">No hay checadores registrados.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.devices
    .map(
      (d) => `
      <tr>
        <td><strong>${esc(d.deviceName)}</strong></td>
        <td>${esc(d.location || 'General')}</td>
        <td><span class="pin-badge">${esc(d.ipAddress)}:${esc(d.port)}</span></td>
        <td>
          <span class="badge ${d.connectionMode === 'USB' ? 'badge-blue' : 'badge-amber'}">
            ${d.connectionMode === 'USB' ? 'Solo USB' : d.connectionMode === 'NETWORK' ? 'Solo Red IP' : 'Red IP + USB'}
          </span>
        </td>
        <td class="text-right">
          <button class="btn btn-outline btn-sm req-admin" data-action="ping-dev" data-id="${esc(d.id)}">Probar Conexión</button>
          <button class="btn btn-outline btn-sm req-admin" data-action="edit-dev" data-id="${esc(d.id)}">Editar</button>
          ${
            state.devices.length > 1
              ? `<button class="btn-danger-ghost req-admin" data-action="delete-dev" data-id="${esc(d.id)}">Quitar</button>`
              : ''
          }
        </td>
      </tr>
    `
    )
    .join('');
}

function loadDeviceIntoForm(dev) {
  if (!dev) return;
  document.getElementById('devId').value = dev.id || '';
  document.getElementById('devName').value = dev.deviceName || '';
  document.getElementById('devLocation').value = dev.location || '';
  document.getElementById('devMode').value = dev.connectionMode || 'HYBRID';
  document.getElementById('devIp').value = dev.ipAddress || '192.168.1.201';
  document.getElementById('devPort').value = dev.port || 4370;
  document.getElementById('devCommKey').value = dev.commKey || 0;
  document.getElementById('deviceFormTitle').textContent = `Configurando: ${dev.deviceName}`;
}

function resetDeviceFormForNew() {
  document.getElementById('devId').value = `zk-${Date.now()}`;
  document.getElementById('devName').value = '';
  document.getElementById('devLocation').value = '';
  document.getElementById('devIp').value = '192.168.1.202';
  document.getElementById('devPort').value = 4370;
  document.getElementById('devCommKey').value = 0;
  document.getElementById('deviceFormTitle').textContent = 'Agregar Nuevo Checador';
  document.getElementById('devName').focus();
}

function populateSelectOptions() {
  const empShiftSelect = document.getElementById('empShiftId');
  empShiftSelect.innerHTML = state.shifts
    .map((s) => `<option value="${esc(s.id)}">${esc(s.name)} (${esc(s.entryTime)} a ${esc(s.exitTime)})</option>`)
    .join('');

  const departments = Array.from(new Set(state.employees.map((e) => e.department))).sort();
  const repDept = document.getElementById('repDepartment');
  const currentDept = repDept.value;
  repDept.innerHTML =
    `<option value="">Todos los departamentos</option>` +
    departments.map((d) => `<option value="${esc(d)}">${esc(d)}</option>`).join('');
  repDept.value = currentDept;

  const activeEmps = state.employees.filter((e) => e.active);
  const repEmp = document.getElementById('repEmployeeId');
  const currentEmp = repEmp.value;
  repEmp.innerHTML =
    `<option value="">Todos los empleados (${activeEmps.length})</option>` +
    activeEmps.map((e) => `<option value="${esc(e.id)}">#${esc(e.zkUserId)} — ${esc(e.name)}</option>`).join('');
  repEmp.value = currentEmp;

  const leaveEmp = document.getElementById('leaveEmployeeId');
  if (leaveEmp) {
    leaveEmp.innerHTML = activeEmps
      .map((e) => `<option value="${esc(e.id)}">#${esc(e.zkUserId)} — ${esc(e.name)}</option>`)
      .join('');
  }
}

function renderEmployeesTable(searchQuery = '') {
  const tbody = document.getElementById('tbodyEmployees');
  const shiftMap = new Map(state.shifts.map((s) => [s.id, s.name]));
  const q = searchQuery.trim().toLowerCase();

  const filtered = state.employees.filter((e) => {
    if (!q) return true;
    return (
      e.name.toLowerCase().includes(q) ||
      String(e.zkUserId).toLowerCase().includes(q) ||
      e.department.toLowerCase().includes(q) ||
      e.position.toLowerCase().includes(q)
    );
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center">No se encontraron empleados.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered
    .map(
      (emp) => `
      <tr>
        <td><span class="pin-badge">#${esc(emp.zkUserId)}</span></td>
        <td><strong>${esc(emp.name)}</strong></td>
        <td>
          <div>${esc(emp.department)}</div>
          <div style="font-size:12px;color:#6B6B73">${esc(emp.position)}</div>
        </td>
        <td>${esc(shiftMap.get(emp.shiftId) || 'Turno General')}</td>
        <td>${esc(emp.hireDate || '-')}</td>
        <td>
          <span class="status-pill ${emp.active ? 'status-ASISTENCIA' : 'status-FALTA'}">
            ${emp.active ? 'Activo' : 'Baja'}
          </span>
        </td>
        <td class="text-right">
          <button class="btn btn-outline btn-sm req-operator" data-action="edit-emp" data-id="${esc(emp.id)}">Editar</button>
          <button class="btn btn-outline btn-sm req-operator" data-action="toggle-emp" data-id="${esc(emp.id)}" data-active="${!emp.active}">
            ${emp.active ? 'Dar de Baja' : 'Reactivar'}
          </button>
          <button class="btn-danger-ghost req-operator" data-action="delete-emp" data-id="${esc(emp.id)}">Eliminar</button>
        </td>
      </tr>
    `
    )
    .join('');
}

function renderRulesLists() {
  const shiftsBox = document.getElementById('listShiftsContainer');
  shiftsBox.innerHTML = state.shifts
    .map(
      (s) => `
      <div class="stack-row">
        <div>
          <strong>${esc(s.name)}</strong>
          <span>Entrada: ${esc(s.entryTime)} | Salida: ${esc(s.exitTime)} | Tolerancia: ${esc(s.lateToleranceMinutes)} min</span>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-outline btn-sm req-admin" data-action="edit-shift" data-id="${esc(s.id)}">Editar</button>
          ${
            state.shifts.length > 1
              ? `<button class="btn-danger-ghost req-admin" data-action="delete-shift" data-id="${esc(s.id)}">Borrar</button>`
              : ''
          }
        </div>
      </div>
    `
    )
    .join('');

  const leavesBox = document.getElementById('listLeavesContainer');
  if (state.leaves.length === 0) {
    leavesBox.innerHTML = `<div class="stack-row"><span>Sin vacaciones o permisos registrados.</span></div>`;
  } else {
    leavesBox.innerHTML = state.leaves
      .map(
        (l) => `
        <div class="stack-row">
          <div>
            <strong>${esc(l.employeeName)} <span class="status-pill status-${esc(l.type)}">${esc(l.type)}</span></strong>
            <span>Del ${esc(l.startDate)} al ${esc(l.endDate)} ${l.notes ? `— ${esc(l.notes)}` : ''}</span>
          </div>
          <button class="btn-danger-ghost req-operator" data-action="delete-leave" data-id="${esc(l.id)}">Quitar</button>
        </div>
      `
      )
      .join('');
  }

  const holidaysBox = document.getElementById('listHolidaysContainer');
  if (state.holidays.length === 0) {
    holidaysBox.innerHTML = `<div class="stack-row"><span>Sin días festivos registrados.</span></div>`;
  } else {
    holidaysBox.innerHTML = state.holidays
      .map(
        (h) => `
        <div class="stack-row">
          <div>
            <strong>${esc(h.date)} — ${esc(h.name)}</strong>
            <span>Día inhábil general</span>
          </div>
          <button class="btn-danger-ghost req-operator" data-action="delete-holiday" data-id="${esc(h.id)}">Quitar</button>
        </div>
      `
      )
      .join('');
  }
}

function renderRecentLogs() {
  const tbody = document.getElementById('tbodyRecentLogs');
  if (state.recentLogs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center">Aún no hay checadas registradas.</td></tr>`;
    return;
  }
  tbody.innerHTML = state.recentLogs
    .slice(0, 80)
    .map(
      (l) => `
      <tr>
        <td><strong>${esc(l.timestamp)}</strong></td>
        <td><span class="pin-badge">#${esc(l.zkUserId)}</span></td>
        <td>${esc(l.employeeName)}</td>
        <td>${esc(l.department)}</td>
        <td>${l.inOutState === 1 ? 'Salida' : 'Entrada'}</td>
        <td><span class="badge ${l.source === 'USB' ? 'badge-blue' : 'badge-amber'}">${esc(l.source)}</span></td>
      </tr>
    `
    )
    .join('');
}

async function runAttendanceReport() {
  const startDate = document.getElementById('repStartDate').value;
  const endDate = document.getElementById('repEndDate').value;
  const department = document.getElementById('repDepartment').value;
  const employeeId = document.getElementById('repEmployeeId').value;
  const tolerance = document.getElementById('repTolerance').value;

  const weeklyMax = state.company?.weeklyMaxHours || 46;
  const regimeMap = { 48: '2026', 46: '2027', 44: '2028', 42: '2029', 40: '2030' };
  const lftRegimeYear = regimeMap[weeklyMax] || '2027';
  const mealBreakMinutes = String(state.company?.mealBreakMinutes ?? 60);

  const params = new URLSearchParams({ startDate, endDate, lftRegimeYear, mealBreakMinutes });
  if (department) params.set('department', department);
  if (employeeId) params.set('employeeId', employeeId);
  if (tolerance !== '') params.set('tolerance', tolerance);

  const report = await apiRequest(`/api/v1/reports/attendance?${params.toString()}`);
  state.currentReport = report;

  document.getElementById('printMetaRange').textContent = `Periodo: ${startDate} al ${endDate} | Departamento: ${department || 'Todos'}`;
  document.getElementById('printEmissionDate').textContent = new Date().toLocaleDateString('es-MX');
  const printSealEl = document.getElementById('printIntegritySeal');
  if (printSealEl) printSealEl.textContent = '';

  const lftSummaryEl = document.getElementById('lftBannerSummary');
  if (lftSummaryEl) {
    lftSummaryEl.textContent = `Jornada máx. ${report.lftCompliance.legalMaxWeeklyHours}h/sem`;
  }

  document.getElementById('kpiTotalEmployees').textContent = String(report.summary.totalEmployees);
  document.getElementById('kpiRangeDays').textContent = `${report.range.totalDays} días evaluados`;
  document.getElementById('kpiPresentCount').textContent = String(report.summary.presentCount);
  document.getElementById('kpiLateCount').textContent = String(report.summary.lateCount);
  document.getElementById('kpiAbsenceCount').textContent = String(report.summary.absenceCount);
  document.getElementById('kpiLeaveHolidayCount').textContent = String(
    report.summary.vacationCount + report.summary.holidayCount
  );
  document.getElementById('kpiWorkedHours').textContent = `${report.summary.totalWorkedHours} hrs`;

  const tbodySum = document.getElementById('tbodyEmployeeSummary');
  if (report.employeeSummaries.length === 0) {
    tbodySum.innerHTML = `<tr><td colspan="12" class="text-center">Sin empleados activos para este filtro.</td></tr>`;
  } else {
    tbodySum.innerHTML = report.employeeSummaries
      .map(
        (s) => `
        <tr>
          <td><span class="pin-badge">#${esc(s.zkUserId)}</span></td>
          <td>
            <button type="button" class="emp-name-link" data-emp-detail="${esc(s.employeeId)}">${esc(s.name)}</button>
            <div style="font-size:11.5px;color:#6B6B73">${esc(s.shiftName)}</div>
          </td>
          <td>
            <div>${esc(s.department)}</div>
            <div style="font-size:11.5px;color:#6B6B73">${esc(s.position)}</div>
          </td>
          <td class="text-center"><strong>${esc(s.presentDays)}</strong></td>
          <td class="text-center"><strong style="color:${s.lateDays > 0 ? '#7A4F00' : 'inherit'}">${esc(s.lateDays)}</strong></td>
          <td class="text-center">${s.totalLateMinutes > 0 ? `<span class="status-pill status-RETARDO">+${esc(s.totalLateMinutes)} min</span>` : '0 min'}</td>
          <td class="text-center">${s.vacationDays + s.holidayDays}</td>
          <td class="text-center"><strong style="color:${s.absenceDays > 0 ? 'var(--danger)' : 'inherit'}">${esc(s.absenceDays)}</strong></td>
          <td class="text-center">${esc(s.ordinaryHours)} hrs</td>
          <td class="text-center">${s.overtimeHours > 0 ? `<span class="status-pill status-EXTRA">+${esc(s.overtimeHours)} hrs</span>` : '0 hrs'}</td>
          <td class="text-right"><strong>${esc(s.totalWorkedHours)} hrs</strong></td>
          <td class="text-center">
            <span class="status-pill ${s.lftStatus.startsWith('ALERTA') ? 'status-FALTA' : 'status-ASISTENCIA'}">
              ${s.lftStatus.startsWith('ALERTA') ? 'Exceso Hrs Extra' : 'Normal (En límite)'}
            </span>
          </td>
        </tr>
      `
      )
      .join('');
  }

  renderCharts(report);
}

function openEmployeeDetail(employeeId) {
  const s = state.currentReport?.employeeSummaries.find((e) => String(e.employeeId) === String(employeeId));
  if (!s) return;

  document.getElementById('empDetailName').textContent = `#${s.zkUserId} — ${s.name}`;
  document.getElementById('empDetailMeta').textContent =
    `${s.department || ""} · ${s.position || ""} · ${s.shiftName || ""} · Periodo ${state.currentReport.range.startDate} al ${state.currentReport.range.endDate}`;

  const kpis = [
    ['Asistencias', s.presentDays, 'kpi-success'],
    ['Retardos', s.lateDays, 'kpi-warning'],
    ['Faltas', s.absenceDays, 'kpi-danger'],
    ['Vac. / Festivos', s.vacationDays + s.holidayDays, 'kpi-info'],
    ['Horas Totales', `${esc(s.totalWorkedHours)}h`, ''],
    ['Horas Extra', `${esc(s.overtimeHours)}h`, s.overtimeHours > 0 ? 'kpi-warning' : '']
  ];
  document.getElementById('empDetailKpis').innerHTML = kpis
    .map(
      ([label, val, cls]) => `
      <div class="kpi-card ${cls}">
        <span class="kpi-label">${label}</span>
        <strong class="kpi-value">${val}</strong>
      </div>`
    )
    .join('');

  // Calendario: celdas vacías hasta el día de la semana del primer día
  const firstDow = new Date(`${s.days[0].date}T12:00:00`).getDay();
  const blanks = Array.from({ length: firstDow }, () => '<div class="cal-cell cal-empty"></div>').join('');
  const cells = s.days
    .map((d) => {
      const tip = `${d.date} (${d.dayName}) — ${d.statusLabel}${d.checkIn ? ` · Entrada ${d.checkIn}` : ''}${d.checkOut ? ` · Salida ${d.checkOut}` : ''}`;
      return `<div class="cal-cell cal-${esc(d.status)}" title="${esc(tip)}">
        ${Number(d.date.slice(8))}
        ${d.checkIn ? `<small>${esc(d.checkIn)}</small>` : ''}
      </div>`;
    })
    .join('');
  document.getElementById('empDetailCalendar').innerHTML = blanks + cells;

  // Gráfica de horas por día (barras)
  const maxH = Math.max(9, ...s.days.map((d) => d.workedHours || 0));
  document.getElementById('empDetailHoursChart').innerHTML = s.days
    .slice(-14)
    .map((d) => {
      const ordH = Math.round(((d.ordinaryHours || 0) / maxH) * 120);
      const otH = Math.round(((d.overtimeHours || 0) / maxH) * 120);
      return `<div class="day-bar-col" title="${esc(d.date)}: ${esc(d.workedHours)}h">
        <div class="day-bar-stack" style="height:125px">
          ${ordH > 0 ? `<div class="bar-seg-present" style="height:${ordH}px"></div>` : ''}
          ${otH > 0 ? `<div class="bar-seg-late" style="height:${otH}px"></div>` : ''}
        </div>
        <span class="day-bar-label">${d.date.slice(8)}</span>
      </div>`;
    })
    .join('');

  // Puntualidad promedio de entrada
  const ins = s.days.filter((d) => d.checkIn).map((d) => {
    const [h, m] = d.checkIn.split(':').map(Number);
    return h * 60 + m;
  });
  const punctBox = document.getElementById('empDetailPunctuality');
  if (ins.length === 0) {
    punctBox.className = 'probe-box probe-warn';
    punctBox.textContent = 'Sin checadas registradas en el periodo.';
  } else {
    const avg = Math.round(ins.reduce((a, b) => a + b, 0) / ins.length);
    const hh = String(Math.floor(avg / 60)).padStart(2, '0');
    const mm = String(avg % 60).padStart(2, '0');
    const scheduled = s.days[0].scheduledEntry;
    punctBox.className = `probe-box ${s.lateDays > 0 ? 'probe-warn' : 'probe-ok'}`;
    punctBox.innerHTML = `Hora promedio de entrada: <strong>${hh}:${mm}</strong> (horario ${esc(scheduled)}) · ${esc(s.totalLateMinutes)} min de retardo acumulados en ${ins.length} días con checada.`;
  }

  document.getElementById('modalEmployeeDetail').hidden = false;
}

// Gráficas del reporte (estilo Aion: tinta + un acento, marcas delgadas, valores visibles)
const CHART_STATUS = [
  { key: 'present', label: 'A tiempo', color: '#3F3F46' },
  { key: 'late', label: 'Retardo', color: '#FFB000' },
  { key: 'absent', label: 'Falta', color: '#C8281E' },
  { key: 'leave', label: 'Justificado', color: '#D6D6D1', hint: 'Vacaciones, permisos y festivos' }
];
const WEEKDAY_LETTER = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

function fmtHours(h) {
  const n = Number(h) || 0;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function ensureChartTooltip() {
  if (document.getElementById('axTip')) return;
  const tip = document.createElement('div');
  tip.id = 'axTip';
  tip.className = 'ax-tip';
  tip.hidden = true;
  document.body.appendChild(tip);
  const place = (ev) => {
    const pad = 14;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    let x = ev.clientX + pad;
    let y = ev.clientY - h - pad;
    if (x + w > window.innerWidth - 8) x = ev.clientX - w - pad;
    if (y < 8) y = ev.clientY + pad;
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  };
  document.addEventListener('mouseover', (ev) => {
    const el = ev.target.closest?.('[data-tip]');
    if (!el) return;
    tip.innerHTML = el.getAttribute('data-tip');
    tip.hidden = false;
    place(ev);
  });
  document.addEventListener('mousemove', (ev) => {
    if (!tip.hidden && ev.target.closest?.('[data-tip]')) place(ev);
  });
  document.addEventListener('mouseout', (ev) => {
    const el = ev.target.closest?.('[data-tip]');
    if (el && !el.contains(ev.relatedTarget)) tip.hidden = true;
  });
}

function tipHtml(title, rows) {
  return esc(
    `<strong>${esc(title)}</strong>` +
      rows
        .map((r) => `<span class="ax-tip-row"><i style="background:${r.color}"></i>${esc(r.label)}<b>${esc(r.value)}</b></span>`)
        .join('')
  );
}

function renderCharts(report) {
  ensureChartTooltip();
  const sum = report.summary;
  const counts = {
    present: sum.presentCount,
    late: sum.lateCount,
    absent: sum.absenceCount,
    leave: sum.vacationCount + sum.holidayCount
  };
  const total = counts.present + counts.late + counts.absent + counts.leave;
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);
  const compliance = pct(counts.present + counts.leave);

  // 1. Cumplimiento: número principal + barra de proporción + desglose
  const compEl = document.getElementById('chartCompliance');
  if (compEl) {
    const segs = CHART_STATUS.filter((s) => counts[s.key] > 0)
      .map(
        (s) =>
          `<span class="ax-seg" style="flex:${counts[s.key]};background:${s.color}" data-tip="${tipHtml(s.label, [
            { label: 'Días', value: counts[s.key], color: s.color },
            { label: 'Del total', value: `${pct(counts[s.key])}%`, color: 'transparent' }
          ])}"></span>`
      )
      .join('');
    compEl.innerHTML = `
      <div class="ax-hero">
        <span class="ax-hero-num">${compliance}<small>%</small></span>
        <span class="ax-hero-cap">sin retardo ni falta<br><b>${esc(total)}</b> días-empleado</span>
      </div>
      <div class="ax-segbar">${segs || '<span class="ax-seg ax-seg-empty" style="flex:1"></span>'}</div>
      <div class="ax-legend">
        ${CHART_STATUS.map(
          (s) => `
          <div class="ax-legend-row"${s.hint ? ` title="${esc(s.hint)}"` : ''}>
            <i style="background:${s.color}"></i>
            <span>${s.label}</span>
            <b>${esc(counts[s.key])}</b>
            <em>${pct(counts[s.key])}%</em>
          </div>`
        ).join('')}
      </div>`;
  }

  // 2. Asistencia por día: columnas apiladas con escala y valor arriba
  const dailyContainer = document.getElementById('chartDailyBars');
  if (dailyContainer) {
    const byDate = new Map();
    for (const r of report.dailyRows) {
      if (!byDate.has(r.date)) byDate.set(r.date, { date: r.date, present: 0, late: 0, absent: 0, leave: 0 });
      const b = byDate.get(r.date);
      if (r.status === 'ASISTENCIA') b.present++;
      else if (r.status === 'RETARDO') b.late++;
      else if (r.status === 'FALTA') b.absent++;
      else if (['VACACIONES', 'PERMISO', 'INCAPACIDAD', 'COMISION', 'FESTIVO'].includes(r.status)) b.leave++;
    }
    const days = Array.from(byDate.values()).slice(-14);
    const maxEmps = Math.max(1, sum.totalEmployees, ...days.map((d) => d.present + d.late + d.absent + d.leave));

    if (days.length === 0) {
      dailyContainer.innerHTML = '<p class="ax-empty">Sin días en el periodo seleccionado.</p>';
    } else {
      const W = 380;
      const H = 190;
      const top = 22;
      const bottom = 34;
      const left = 22;
      const plotH = H - top - bottom;
      const slot = (W - left) / days.length;
      const barW = Math.max(8, Math.min(26, slot * 0.56));
      const y = (v) => top + plotH - (v / maxEmps) * plotH;
      const GAP = 2;

      const grid = [0, Math.round(maxEmps / 2), maxEmps]
        .filter((v, i, a) => a.indexOf(v) === i)
        .map(
          (v) => `<line x1="${left}" x2="${W}" y1="${y(v)}" y2="${y(v)}" class="ax-grid${v === 0 ? ' ax-base' : ''}"/>
                  <text x="${left - 6}" y="${y(v) + 3.5}" class="ax-tick" text-anchor="end">${v}</text>`
        )
        .join('');

      const cols = days
        .map((d, i) => {
          const cx = left + slot * i + slot / 2;
          const x = cx - barW / 2;
          const dow = new Date(`${d.date}T12:00:00`).getDay();
          let acc = 0;
          const stack = CHART_STATUS.filter((s) => d[s.key] > 0);
          const rects = stack
            .map((s, idx) => {
              const y0 = y(acc);
              acc += d[s.key];
              const y1 = y(acc);
              const isTop = idx === stack.length - 1;
              const h = Math.max(1, y0 - y1 - (isTop ? 0 : GAP));
              const r = isTop ? Math.min(4, h, barW / 2) : 0;
              // Solo el extremo superior va redondeado; la base queda recta sobre el eje
              const path = r
                ? `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + barW - r} Q${x + barW},${y1} ${x + barW},${y1 + r} V${y0} Z`
                : `M${x},${y0} V${y0 - h} H${x + barW} V${y0} Z`;
              return `<path d="${path}" fill="${s.color}"/>`;
            })
            .join('');
          const attended = d.present + d.late;
          const tip = tipHtml(
            `${['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][dow]} ${Number(d.date.slice(8))}/${d.date.slice(5, 7)}`,
            CHART_STATUS.map((s) => ({ label: s.label, value: d[s.key], color: s.color }))
          );
          const onlyLeave = attended === 0 && d.absent === 0 && d.leave > 0;
          const noData = acc === 0;
          const label = noData ? '–' : onlyLeave ? 'J' : attended;
          return `<g class="ax-col${dow === 0 || dow === 6 ? ' ax-weekend' : ''}" data-tip="${tip}">
              <rect x="${left + slot * i}" y="${top - 18}" width="${slot}" height="${H - top + 18}" class="ax-hit"/>
              ${rects}
              <text x="${cx}" y="${y(acc) - 6}" text-anchor="middle" class="ax-val${onlyLeave || noData ? ' ax-val-muted' : ''}">${label}</text>
              <text x="${cx}" y="${H - bottom + 15}" text-anchor="middle" class="ax-day">${Number(d.date.slice(8))}</text>
              <text x="${cx}" y="${H - bottom + 28}" text-anchor="middle" class="ax-dow">${WEEKDAY_LETTER[dow]}</text>
            </g>`;
        })
        .join('');

      dailyContainer.innerHTML = `
        <svg viewBox="0 0 ${W} ${H}" class="ax-svg" role="img" aria-label="Asistencia por día">${grid}${cols}</svg>
        <div class="ax-keys">${CHART_STATUS.map((s) => `<span><i style="background:${s.color}"></i>${s.label}</span>`).join('')}</div>`;
    }
  }

  // 3. Horas por empleado: barras horizontales ordenadas, normales + extra
  const empHoursContainer = document.getElementById('chartEmployeeHours');
  if (empHoursContainer) {
    const emps = [...report.employeeSummaries]
      .sort((a, b) => (b.totalWorkedHours || 0) - (a.totalWorkedHours || 0))
      .slice(0, 6);
    const maxHours = Math.max(1, ...emps.map((e) => (e.ordinaryHours || 0) + (e.overtimeHours || 0)));
    const rest = report.employeeSummaries.length - emps.length;

    empHoursContainer.innerHTML = emps.length
      ? `${emps
          .map((e) => {
            const ord = e.ordinaryHours || 0;
            const ot = e.overtimeHours || 0;
            const ordPct = (ord / maxHours) * 100;
            const otPct = (ot / maxHours) * 100;
            const tip = tipHtml(e.name, [
              { label: 'Normales', value: `${fmtHours(ord)} h`, color: '#3F3F46' },
              { label: 'Extra', value: `${fmtHours(ot)} h`, color: '#A1A1AA' }
            ]);
            return `
            <div class="ax-hrow" data-tip="${tip}">
              <span class="ax-hname">${esc(e.name)}</span>
              <div class="ax-htrack">
                ${ord > 0 ? `<span class="ax-hord${ot > 0 ? '' : ' ax-hend'}" style="width:${ordPct}%"></span>` : ''}
                ${ot > 0 ? `<span class="ax-hot" style="width:${otPct}%"></span>` : ''}
              </div>
              <span class="ax-hval">${fmtHours(ord + ot)}<small> h</small>${ot > 0 ? `<em>+${fmtHours(ot)}</em>` : ''}</span>
            </div>`;
          })
          .join('')}
        <div class="ax-keys"><span><i style="background:#3F3F46"></i>Normales</span><span><i style="background:#A1A1AA"></i>Extra</span>${
          rest > 0 ? `<span class="ax-more">+${rest} más en la tabla</span>` : ''
        }</div>`
      : '<p class="ax-empty">Sin empleados en el periodo.</p>';
  }
}

function renderDailyReportRows() {
  if (!state.currentReport) return;
  const statusFilter = document.getElementById('filterDailyStatus')?.value || '';
  const tbodyDaily = document.getElementById('tbodyDailyReport');
  if (!tbodyDaily) return;

  const rows = state.currentReport.dailyRows.filter((r) => {
    if (!statusFilter) return true;
    if (statusFilter === 'VACACIONES') {
      return ['VACACIONES', 'PERMISO', 'INCAPACIDAD'].includes(r.status);
    }
    return r.status === statusFilter;
  });

  if (rows.length === 0) {
    tbodyDaily.innerHTML = `<tr><td colspan="10" class="text-center">No hay registros con ese filtro.</td></tr>`;
    return;
  }

  tbodyDaily.innerHTML = rows
    .map(
      (r) => `
      <tr>
        <td><strong>${esc(r.date)}</strong></td>
        <td>${esc(r.dayName)}</td>
        <td><span class="pin-badge">#${esc(r.zkUserId)}</span></td>
        <td><strong>${esc(r.employeeName)}</strong></td>
        <td>${esc(r.department)}</td>
        <td>${esc(r.scheduledEntry)} - ${esc(r.scheduledExit)}</td>
        <td>${r.checkIn ? `<strong>${esc(r.checkIn)}</strong>` : '<span style="color:#6B6B73">--:--</span>'}</td>
        <td>${r.checkOut ? `<strong>${esc(r.checkOut)}</strong>` : '<span style="color:#6B6B73">--:--</span>'}</td>
        <td>${r.workedHours > 0 ? `${esc(r.workedHours)} h` : '-'}</td>
        <td>
          <span class="status-pill status-${esc(r.status)}">${esc(r.statusLabel)}</span>
        </td>
      </tr>
    `
    )
    .join('');
}

function exportReportToExcelCsv() {
  if (!state.currentReport) {
    showToast('Consulte primero el reporte antes de exportar.');
    return;
  }
  const { startDate, endDate } = state.currentReport.range;
  const department = document.getElementById('repDepartment').value;
  const employeeId = document.getElementById('repEmployeeId').value;
  const tolerance = document.getElementById('repTolerance').value;

  const weeklyMax = state.company?.weeklyMaxHours || 46;
  const regimeMap = { 48: '2026', 46: '2027', 44: '2028', 42: '2029', 40: '2030' };
  const lftRegimeYear = regimeMap[weeklyMax] || '2027';
  const mealBreakMinutes = String(state.company?.mealBreakMinutes ?? 60);

  const params = new URLSearchParams({ startDate, endDate, lftRegimeYear, mealBreakMinutes });
  if (department) params.set('department', department);
  if (employeeId) params.set('employeeId', employeeId);
  if (tolerance !== '') params.set('tolerance', tolerance);

  showToast('Generando reporte Excel profesional con logo y estilos...');
  downloadFile(`/api/v1/reports/attendance/excel?${params.toString()}`, 'Reporte_Asistencia.xlsx').catch((err) =>
    showToast(err.message)
  );
}

function renderDetailedMatrixTable() {
  if (!state.currentReport || !state.currentReport.employeeSummaries) return;
  const thead = document.getElementById('theadDetailedMatrix');
  const tbody = document.getElementById('tbodyDetailedMatrix');
  if (!thead || !tbody) return;

  const sampleDays = state.currentReport.employeeSummaries[0]?.days || [];

  // Headers
  let thHtml = '<tr><th>ID</th><th>Empleado</th><th>Departamento</th>';
  sampleDays.forEach((d) => {
    let dayBadge = d.dayName;
    if (d.status === 'FESTIVO') dayBadge = 'FESTIVO';
    else if (d.status === 'DESCANSO') dayBadge = 'DESCANSO';
    thHtml += `<th>${d.date.slice(5)}<br><small style="font-weight:normal">${dayBadge}</small></th>`;
  });
  thHtml += '<th>Asist.</th><th>Ret.</th><th>Faltas</th><th>Total Hrs</th></tr>';
  thead.innerHTML = thHtml;

  // Rows
  tbody.innerHTML = state.currentReport.employeeSummaries
    .map((emp) => {
      let tr = `<tr>
        <td class="text-center font-bold">#${esc(emp.zkUserId)}</td>
        <td><strong>${esc(emp.name)}</strong></td>
        <td>${esc(emp.department)}</td>`;

      emp.days.forEach((d) => {
        let content = '';
        let cellClass = 'text-center';
        let bgStyle = '';

        if (d.status === 'FESTIVO') {
          content = 'FESTIVO';
          bgStyle = 'background:#E9E9E5;color:#4F4F57;font-weight:bold';
        } else if (d.status === 'VACACIONES') {
          content = 'VACACIONES';
          bgStyle = 'background:#E9E9E5;color:#4F4F57;font-weight:bold';
        } else if (d.status === 'DESCANSO') {
          content = 'DESCANSO';
          bgStyle = 'background:#F5F5F3;color:#6B6B73';
        } else if (d.status === 'FALTA') {
          content = 'FALTA';
          bgStyle = 'background:#FBE9E7;color:#B3261E;font-weight:bold';
        } else if (d.status === 'RETARDO') {
          let punch = d.checkIn || '--:--';
          if (d.checkOut) punch += ` - ${d.checkOut}`;
          content = `RETARDO<br><small>${esc(punch)}</small>`;
          bgStyle = 'background:#FFF3D6;color:#7A4F00;font-weight:bold;font-size:9.5px';
        } else {
          let punch = d.checkIn || '--:--';
          if (d.checkOut) punch += ` - ${d.checkOut}`;
          content = `<small>${esc(punch)}</small>`;
          bgStyle = 'font-size:9.5px';
        }

        tr += `<td class="${cellClass}" style="${bgStyle}">${content}</td>`;
      });

      tr += `<td class="text-center" style="font-weight:bold;color:var(--success)">${esc(emp.presentDays)}</td>
             <td class="text-center" style="font-weight:bold;color:${emp.lateDays > 0 ? 'var(--warning)' : 'inherit'}">${esc(emp.lateDays)}</td>
             <td class="text-center" style="font-weight:bold;color:${emp.absenceDays > 0 ? 'var(--danger)' : 'inherit'}">${esc(emp.absenceDays)}</td>
             <td class="text-center font-bold">${esc(emp.totalWorkedHours)} hrs</td>
           </tr>`;
      return tr;
    })
    .join('');
}

function preparePrint(mode = 'summary') {
  switchView('reports');
  const reportModal = document.getElementById('modalReportGenerator');
  if (reportModal) reportModal.hidden = true;

  const summaryCard = document.getElementById('cardSummaryTable');
  const matrixWrap = document.getElementById('printDetailedMatrixWrap');
  const printTitle = document.getElementById('printReportTitle');

  if (mode === 'detailed') {
    if (printTitle) printTitle.textContent = 'AUDITORÍA DE ASISTENCIA — DETALLE DÍA POR DÍA';
    renderDetailedMatrixTable();
    if (summaryCard) summaryCard.style.setProperty('display', 'none', 'important');
    if (matrixWrap) matrixWrap.style.setProperty('display', 'block', 'important');
  } else {
    if (printTitle) printTitle.textContent = 'REPORTE DE ASISTENCIA Y CONTROL DE PERSONAL';
    if (summaryCard) summaryCard.style.removeProperty('display');
    if (matrixWrap) matrixWrap.style.setProperty('display', 'none', 'important');
  }

  setTimeout(() => {
    window.print();
  }, 150);
}

window.addEventListener('afterprint', () => {
  const summaryCard = document.getElementById('cardSummaryTable');
  const matrixWrap = document.getElementById('printDetailedMatrixWrap');
  if (summaryCard) summaryCard.style.removeProperty('display');
  if (matrixWrap) matrixWrap.style.setProperty('display', 'none', 'important');
});

async function refreshAllData() {
  let boot;
  try {
    boot = await apiRequest('/api/v1/bootstrap');
  } catch (err) {
    // La empresa guardada ya no es accesible (desactivada o sin permiso): usar la predeterminada
    if (err.code === 'NO_COMPANY_ACCESS' && currentTenantId) {
      setCurrentTenant('');
      boot = await apiRequest('/api/v1/bootstrap');
    } else {
      throw err;
    }
  }

  if (boot.brand) state.brand = boot.brand;
  if (boot.company) state.company = boot.company;
  applyBranding();

  if (boot.auth) {
    if (!boot.auth.initialized) {
      document.getElementById('modalLogin').hidden = true;
      document.getElementById('modalInitialSetup').hidden = false;
      document.getElementById('appLayout').style.display = 'none';
      return;
    }

    if (!boot.auth.authenticated) {
      document.getElementById('modalInitialSetup').hidden = true;
      document.getElementById('modalLogin').hidden = false;
      document.getElementById('appLayout').style.display = 'none';
      return;
    }

    document.getElementById('modalInitialSetup').hidden = true;
    document.getElementById('modalLogin').hidden = true;
    document.getElementById('appLayout').style.display = '';
    currentUser = boot.auth.user;
    state.role = boot.auth.role || 'VIEWER';
    renderAuthStatus();
  }

  if (boot.tenantId) setCurrentTenant(boot.tenantId);
  if (Array.isArray(boot.companies)) state.companies = boot.companies;
  if (boot.license) state.license = boot.license;
  renderCompanySwitcher();
  renderLicenseBanner();
  applyRoleUI();

  // Equipo sin licencia: llevar al Superadministrador directo a activarla (una vez por sesión)
  if (state.license?.state === 'UNLICENSED' && currentUser?.isSuperAdmin && !state.licensePrompted) {
    state.licensePrompted = true;
    setTimeout(() => switchView('license'), 0);
  }

  if (boot.company) state.company = boot.company;
  state.employees = boot.employees || [];
  state.shifts = boot.shifts || [];
  state.holidays = boot.holidays || [];
  state.leaves = boot.leaves || [];
  state.devices = boot.devices || (boot.device ? [boot.device] : []);
  state.device = state.devices[0] || boot.device;
  state.recentLogs = boot.recentLogs || [];

  renderCompanyBranding();
  renderTopbarKpis();
  renderDevicesTable();
  if (state.device && !document.getElementById('devName').value) {
    loadDeviceIntoForm(state.device);
  }
  populateSelectOptions();
  renderEmployeesTable(document.getElementById('searchEmployeeInput').value);
  renderRulesLists();
  renderRecentLogs();
  await runAttendanceReport();
}

function switchView(viewName) {
  if (!viewName) return;
  document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });
  document.querySelectorAll('.view-section').forEach((sec) => {
    sec.classList.toggle('active', sec.id === `view-${viewName}`);
  });
  const hdr = VIEW_HEADERS[viewName];
  if (hdr) {
    document.getElementById('pageTitle').textContent = hdr.title;
    document.getElementById('pageSubtitle').textContent = hdr.subtitle;
  }
  if (viewName === 'companies') loadCompaniesView().catch((err) => showToast(err.message));
  if (viewName === 'users') loadUsersView().catch((err) => showToast(err.message));
  if (viewName === 'license') loadLicenseView().catch((err) => showToast(err.message));
}

window.addEventListener('DOMContentLoaded', async () => {
  setDefaultReportDates();
  initCompanySwitcher();
  initCompaniesView();
  initUsersView();
  initLicenseView();
  renderBrandFields('comp');
  document.getElementById('btnLogout')?.addEventListener('click', logout);

  // Hora actual en la pantalla de inicio de sesión (DESIGN.md: el ámbar = el tiempo)
  const tickLoginClock = () => {
    const el = document.getElementById('loginClock');
    if (el) el.textContent = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
  };
  tickLoginClock();
  setInterval(tickLoginClock, 15000);

  document.getElementById('btnExportUsbDat')?.addEventListener('click', (e) => {
    e.preventDefault();
    downloadFile('/api/v1/employees/export-usb', 'empleados_zkteco.dat').catch((err) => showToast(err.message));
  });

  // --- Detalle de empleado (clic en el nombre dentro del reporte) ---
  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest?.('[data-emp-detail]');
    if (btn) openEmployeeDetail(btn.dataset.empDetail);
  });
  const empDetailModal = document.getElementById('modalEmployeeDetail');
  document.getElementById('btnCloseEmpDetail')?.addEventListener('click', () => {
    empDetailModal.hidden = true;
  });
  empDetailModal?.addEventListener('click', (ev) => {
    if (ev.target === empDetailModal) empDetailModal.hidden = true;
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && empDetailModal && !empDetailModal.hidden) empDetailModal.hidden = true;
  });

  // --- Menú Lateral Auto-ocultable Automático (Hover) ---
  const sidebar = document.getElementById('appSidebar') || document.querySelector('.sidebar');
  const triggerZone = document.getElementById('sidebarTriggerZone');
  const edgeIndicator = document.getElementById('sidebarEdgeIndicator');
  const backdrop = document.getElementById('sidebarBackdrop');
  const toggleBtn = document.getElementById('btnToggleSidebar');

  let sidebarHideTimer = null;

  const openSidebarAuto = () => {
    clearTimeout(sidebarHideTimer);
    sidebar?.classList.add('visible');
    backdrop?.classList.add('active');
    if (edgeIndicator) edgeIndicator.style.opacity = '0';
  };

  const closeSidebarAuto = () => {
    clearTimeout(sidebarHideTimer);
    sidebarHideTimer = setTimeout(() => {
      sidebar?.classList.remove('visible');
      backdrop?.classList.remove('active');
      if (edgeIndicator) edgeIndicator.style.opacity = '1';
    }, 250);
  };

  // Apertura y Cierre Automáticos con el Mouse (Hover sin clicks)
  triggerZone?.addEventListener('mouseenter', openSidebarAuto);
  edgeIndicator?.addEventListener('mouseenter', openSidebarAuto);
  // Clic, toque (tabletas/celulares) o teclado sobre la pestaña "MENÚ" del borde izquierdo
  edgeIndicator?.addEventListener('click', openSidebarAuto);
  edgeIndicator?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      openSidebarAuto();
    }
  });
  sidebar?.addEventListener('mouseenter', () => clearTimeout(sidebarHideTimer));

  sidebar?.addEventListener('mouseleave', closeSidebarAuto);
  triggerZone?.addEventListener('mouseleave', closeSidebarAuto);
  backdrop?.addEventListener('click', () => {
    sidebar?.classList.remove('visible');
    backdrop?.classList.remove('active');
    if (edgeIndicator) edgeIndicator.style.opacity = '1';
  });

  // Botón superior: también permite abrir o cerrar
  toggleBtn?.addEventListener('click', () => {
    if (sidebar?.classList.contains('visible')) {
      sidebar.classList.remove('visible');
      backdrop?.classList.remove('active');
      if (edgeIndicator) edgeIndicator.style.opacity = '1';
    } else {
      openSidebarAuto();
    }
  });

  document.getElementById('btnCollapseSidebar')?.addEventListener('click', () => {
    sidebar?.classList.remove('visible');
    backdrop?.classList.remove('active');
    if (edgeIndicator) edgeIndicator.style.opacity = '1';
  });

  // Al hacer clic en cualquier opción del menú, se cierra automáticamente para dejar ver los datos
  document.querySelectorAll('.sidebar .nav-item, #btnOpenReportModalSidebar').forEach((btn) => {
    btn.addEventListener('click', () => {
      setTimeout(() => {
        sidebar?.classList.remove('visible');
        backdrop?.classList.remove('active');
        if (edgeIndicator) edgeIndicator.style.opacity = '1';
      }, 100);
    });
  });

  document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  document.getElementById('btnOpenNewEmployeeTop')?.addEventListener('click', () => {
    switchView('employees');
    document.getElementById('empZkUserId')?.focus();
  });

  // Report Generator Modal Handlers
  const reportModal = document.getElementById('modalReportGenerator');
  const openReportModal = () => {
    if (reportModal) reportModal.hidden = false;
  };
  const closeReportModal = () => {
    if (reportModal) reportModal.hidden = true;
  };

  document.getElementById('btnOpenReportModalSidebar')?.addEventListener('click', openReportModal);
  document.getElementById('btnCloseReportModal')?.addEventListener('click', closeReportModal);
  reportModal?.addEventListener('click', (e) => {
    if (e.target === reportModal) closeReportModal();
  });

  document.getElementById('formReportFilter')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await runAttendanceReport();
      closeReportModal();
      showToast('Dashboard actualizado con el nuevo rango de fechas.');
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById('filterDailyStatus')?.addEventListener('change', renderDailyReportRows);
  document.getElementById('btnExportExcel')?.addEventListener('click', exportReportToExcelCsv);
  document.getElementById('btnPrintReportSummary')?.addEventListener('click', () => preparePrint('summary'));
  document.getElementById('btnPrintReportDetailed')?.addEventListener('click', () => preparePrint('detailed'));

  // Employee Form
  document.getElementById('formEmployee')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const payload = {
        id: document.getElementById('empId').value || undefined,
        zkUserId: document.getElementById('empZkUserId').value,
        cardNumber: document.getElementById('empCardNumber').value,
        name: document.getElementById('empName').value,
        department: document.getElementById('empDepartment').value,
        position: document.getElementById('empPosition').value,
        shiftId: document.getElementById('empShiftId').value,
        hireDate: document.getElementById('empHireDate').value,
        privilege: 0,
        active: true,
        syncWithDevice: Boolean(document.getElementById('empSyncDevice')?.checked)
      };

      const res = await apiRequest('/api/v1/employees', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      document.getElementById('formEmployee').reset();
      document.getElementById('empId').value = '';
      document.getElementById('empFormTitle').textContent = 'Agregar Empleado';
      await refreshAllData();
      const sync = res.deviceSync;
      showToast(
        sync
          ? `Empleado ${res.employee.name} guardado. ${sync.message}`
          : `Empleado ${res.employee.name} guardado correctamente.`
      );
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById('btnResetEmpForm')?.addEventListener('click', () => {
    document.getElementById('formEmployee')?.reset();
    const empIdEl = document.getElementById('empId');
    if (empIdEl) empIdEl.value = '';
    const formTitle = document.getElementById('empFormTitle');
    if (formTitle) formTitle.textContent = 'Agregar Empleado';
  });

  document.getElementById('searchEmployeeInput')?.addEventListener('input', (e) => {
    renderEmployeesTable(e.target.value);
  });

  document.getElementById('tbodyEmployees')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    try {
      if (action === 'edit-emp') {
        const emp = state.employees.find((x) => x.id === id);
        if (!emp) return;
        document.getElementById('empId').value = emp.id;
        document.getElementById('empZkUserId').value = emp.zkUserId;
        document.getElementById('empCardNumber').value = emp.cardNumber || '';
        document.getElementById('empName').value = emp.name;
        document.getElementById('empDepartment').value = emp.department;
        document.getElementById('empPosition').value = emp.position;
        document.getElementById('empShiftId').value = emp.shiftId;
        document.getElementById('empHireDate').value = emp.hireDate || '';
        document.getElementById('empFormTitle').textContent = `Editando Empleado #${emp.zkUserId}`;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (action === 'toggle-emp') {
        const active = btn.dataset.active === 'true';
        await apiRequest(`/api/v1/employees/${encodeURIComponent(id)}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ active })
        });
        await refreshAllData();
        showToast(active ? 'Empleado reactivado.' : 'Empleado dado de baja.');
      } else if (action === 'delete-emp') {
        if (!confirm('¿Confirmas eliminar este empleado del padrón?')) return;
        const fromDevice = confirm(
          '¿Borrarlo también del reloj checador?\n\nAceptar: se borra del reloj (se pierden sus huellas).\nCancelar: solo se borra del sistema.'
        );
        const out = await apiRequest(
          `/api/v1/employees/${encodeURIComponent(id)}${fromDevice ? '?fromDevice=1' : ''}`,
          { method: 'DELETE' }
        );
        await refreshAllData();
        showToast(out.deviceSync ? `Empleado eliminado. ${out.deviceSync.message}` : 'Empleado eliminado.');
      }
    } catch (err) {
      showToast(err.message);
    }
  });

  // Shift Form (Alta / Modificación de Horarios)
  const resetShiftForm = () => {
    document.getElementById('formShift').reset();
    document.getElementById('shiftId').value = '';
    document.getElementById('shiftEntry').value = '08:00';
    document.getElementById('shiftExit').value = '18:00';
    document.getElementById('shiftTolerance').value = '10';
    document.getElementById('shiftWorkDaysPreset').value = '1,2,3,4,5,6';
    document.getElementById('shiftFormTitle').textContent = '1. Horarios y Regla de Retardo';
    document.getElementById('btnSaveShift').textContent = 'Guardar Horario';
    document.getElementById('btnResetShiftForm').style.display = 'none';
  };

  document.getElementById('btnResetShiftForm')?.addEventListener('click', resetShiftForm);

  document.getElementById('formShift')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const workDays = document
        .getElementById('shiftWorkDaysPreset')
        .value.split(',')
        .map(Number);
      const isEditing = Boolean(document.getElementById('shiftId').value);

      await apiRequest('/api/v1/shifts', {
        method: 'POST',
        body: JSON.stringify({
          id: document.getElementById('shiftId').value || undefined,
          name: document.getElementById('shiftName').value,
          entryTime: document.getElementById('shiftEntry').value,
          exitTime: document.getElementById('shiftExit').value,
          lateToleranceMinutes: Number(document.getElementById('shiftTolerance').value),
          workDays
        })
      });
      resetShiftForm();
      await refreshAllData();
      showToast(isEditing ? 'Horario modificado exitosamente.' : 'Nuevo horario guardado.');
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById('listShiftsContainer')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const shift = state.shifts.find((s) => s.id === id);
    if (!shift) return;

    if (action === 'edit-shift') {
      document.getElementById('shiftId').value = shift.id;
      document.getElementById('shiftName').value = shift.name;
      document.getElementById('shiftEntry').value = shift.entryTime;
      document.getElementById('shiftExit').value = shift.exitTime;
      document.getElementById('shiftTolerance').value = shift.lateToleranceMinutes;
      if (Array.isArray(shift.workDays)) {
        document.getElementById('shiftWorkDaysPreset').value = shift.workDays.join(',');
      }
      document.getElementById('shiftFormTitle').textContent = `Modificando Horario: ${shift.name}`;
      document.getElementById('btnSaveShift').textContent = 'Guardar Cambios';
      document.getElementById('btnResetShiftForm').style.display = 'inline-block';
      document.getElementById('shiftName').focus();
    } else if (action === 'delete-shift') {
      if (!confirm(`¿Está seguro de borrar el horario "${shift.name}"?`)) return;
      try {
        await apiRequest(`/api/v1/shifts/${encodeURIComponent(id)}`, { method: 'DELETE' });
        await refreshAllData();
        showToast('Horario eliminado.');
      } catch (err) {
        showToast(err.message);
      }
    }
  });

  // Leave Form
  document.getElementById('formLeave')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/api/v1/leaves', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: document.getElementById('leaveEmployeeId').value,
          type: document.getElementById('leaveType').value,
          startDate: document.getElementById('leaveStart').value,
          endDate: document.getElementById('leaveEnd').value,
          notes: document.getElementById('leaveNotes').value
        })
      });
      document.getElementById('leaveNotes').value = '';
      await refreshAllData();
      showToast('Vacaciones / permiso guardado.');
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById('listLeavesContainer')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action="delete-leave"]');
    if (!btn) return;
    await apiRequest(`/api/v1/leaves/${encodeURIComponent(btn.dataset.id)}`, { method: 'DELETE' });
    await refreshAllData();
    showToast('Registro eliminado.');
  });

  // Holiday Form
  document.getElementById('formHoliday')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/api/v1/holidays', {
        method: 'POST',
        body: JSON.stringify({
          date: document.getElementById('holidayDate').value,
          name: document.getElementById('holidayName').value,
          isOfficial: true
        })
      });
      document.getElementById('holidayName').value = '';
      await refreshAllData();
      showToast('Día festivo guardado.');
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById('listHolidaysContainer')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action="delete-holiday"]');
    if (!btn) return;
    await apiRequest(`/api/v1/holidays/${encodeURIComponent(btn.dataset.id)}`, { method: 'DELETE' });
    await refreshAllData();
    showToast('Día festivo eliminado.');
  });

  // Device Settings
  document.getElementById('formDeviceSettings')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/api/v1/devices', {
        method: 'POST',
        body: JSON.stringify({
          id: document.getElementById('devId').value || undefined,
          deviceName: document.getElementById('devName').value,
          location: document.getElementById('devLocation').value,
          model: 'ZKTeco Estándar',
          connectionMode: document.getElementById('devMode').value,
          ipAddress: document.getElementById('devIp').value,
          port: Number(document.getElementById('devPort').value),
          commKey: Number(document.getElementById('devCommKey').value),
          serialNumber: ''
        })
      });
      await refreshAllData();
      showToast('Checador guardado.');
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById('btnNewDeviceClean')?.addEventListener('click', resetDeviceFormForNew);

  document.getElementById('tbodyDevicesList')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const dev = state.devices.find((d) => d.id === id);
    if (!dev) return;

    if (action === 'edit-dev') {
      loadDeviceIntoForm(dev);
    } else if (action === 'ping-dev') {
      loadDeviceIntoForm(dev);
      await triggerZkPing();
    } else if (action === 'delete-dev') {
      if (!confirm(`¿Quitar el checador "${dev.deviceName}"?`)) return;
      await apiRequest(`/api/v1/devices/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await refreshAllData();
      showToast('Checador eliminado.');
    }
  });

  // Company Settings Form
  document.getElementById('formCompanySettings')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/api/v1/company', {
        method: 'POST',
        body: JSON.stringify({
          companyName: document.getElementById('compName').value,
          branchName: document.getElementById('compBranch').value,
          weeklyMaxHours: Number(document.getElementById('compWeeklyHours').value),
          mealBreakMinutes: Number(document.getElementById('compMealMinutes').value),
          ...readBrandFields('comp')
        })
      });
      await refreshAllData();
      showToast('Datos de la empresa y jornada LFT actualizados.');
    } catch (err) {
      showToast(err.message);
    }
  });

  async function triggerZkPing() {
    const box = document.getElementById('deviceProbeResult');
    const dot = document.getElementById('sidebarDeviceDot');
    box.className = 'probe-box';
    box.textContent = 'Probando conexión con el reloj checador...';
    try {
      const res = await apiRequest('/api/v1/device/test', {
        method: 'POST',
        body: JSON.stringify({
          ipAddress: document.getElementById('devIp').value,
          port: Number(document.getElementById('devPort').value),
          commKey: Number(document.getElementById('devCommKey').value || 0)
        })
      });
      box.className = `probe-box ${res.reachable ? 'probe-ok' : 'probe-warn'}`;
      box.textContent = res.message;
      if (dot) dot.classList.toggle('online', Boolean(res.reachable));
      showToast(res.message);
    } catch (err) {
      box.className = 'probe-box probe-warn';
      box.textContent = err.message;
    }
  }

  document.getElementById('btnTestDevice')?.addEventListener('click', triggerZkPing);

  async function runDeviceAction(btn, busyText, fn) {
    const box = document.getElementById('deviceNetResult');
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = busyText;
    box.hidden = false;
    box.className = 'probe-box';
    box.textContent = busyText;
    try {
      const msg = await fn();
      box.className = 'probe-box probe-ok';
      box.textContent = msg;
      showToast(msg);
    } catch (err) {
      box.className = 'probe-box probe-warn';
      box.textContent = err.message;
      showToast(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  }

  document.getElementById('btnDownloadDevice')?.addEventListener('click', (e) =>
    runDeviceAction(e.currentTarget, 'Descargando checadas del reloj...', async () => {
      const r = await apiRequest('/api/v1/attendance/download-device', { method: 'POST', body: '{}' });
      await refreshAllData();
      let msg = `Reloj ${r.device}: ${r.totalParsed} checada(s) leídas, ${r.importedCount} nuevas, ${r.duplicateCount} ya estaban.`;
      if (r.unknownPins?.length) msg += ` IDs del reloj sin empleado en el sistema: ${r.unknownPins.join(', ')}.`;
      return msg;
    })
  );

  document.getElementById('btnPushEmployees')?.addEventListener('click', (e) => {
    if (!confirm('¿Enviar todos los empleados activos al reloj? Se dan de alta los que falten y se actualiza el nombre de los que ya están (las huellas no se tocan).')) return;
    runDeviceAction(e.currentTarget, 'Enviando empleados al reloj...', async () => {
      const r = await apiRequest('/api/v1/employees/push-device', { method: 'POST', body: '{}' });
      let msg = `Empleados enviados: ${r.created} nuevos y ${r.updated} actualizados de ${r.total}.`;
      if (r.errors?.length) msg += ` Con error: ${r.errors.join('; ')}`;
      return msg;
    });
  });

  // USB Import
  document.getElementById('usbFileInput')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    document.getElementById('usbRawTextarea').value = text;
    showToast(`Archivo "${file.name}" listo para importar.`);
  });

  document.getElementById('btnLoadSampleUsb')?.addEventListener('click', () => {
    const y = new Date().getFullYear();
    const sample = [
      `101\t${y}-11-05 08:18:10\t1\t0\t1\t0`,
      `101\t${y}-11-05 17:40:22\t1\t1\t1\t0`,
      `102\t${y}-11-05 07:54:00\t1\t0\t1\t0`,
      `102\t${y}-11-05 18:12:45\t1\t1\t1\t0`
    ].join('\n');
    document.getElementById('usbRawTextarea').value = sample;
    showToast('Ejemplo cargado.');
  });

  document.getElementById('btnProcessUsb')?.addEventListener('click', async () => {
    const content = document.getElementById('usbRawTextarea').value;
    if (!content.trim()) {
      showToast('Seleccione un archivo de su USB primero.');
      return;
    }
    try {
      const res = await apiRequest('/api/v1/attendance/import-usb', {
        method: 'POST',
        body: JSON.stringify({ content })
      });
      await refreshAllData();
      showToast(`Listo: ${res.importedCount} checadas importadas.`);
    } catch (err) {
      showToast(err.message);
    }
  });



  // Cambio de contraseña
  document.getElementById('formChangePassword')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const oldPassword = document.getElementById('changePassOld').value;
    const newPassword = document.getElementById('changePassNew').value;
    const confirm = document.getElementById('changePassConfirm').value;

    if (newPassword !== confirm) {
      showToast('La nueva contraseña y su confirmación no coinciden.');
      return;
    }
    if (newPassword.length < 4) {
      showToast('La nueva contraseña debe tener mínimo 4 caracteres.');
      return;
    }

    try {
      await apiRequest('/api/v1/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword, newPassword })
      });
      showToast('Contraseña de administrador actualizada con éxito.');
      document.getElementById('formChangePassword').reset();
    } catch (err) {
      showToast(err.message);
    }
  });

  await refreshAllData();
});
