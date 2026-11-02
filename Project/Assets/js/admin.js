/* =========================================================
   CMS – Courier Management System
   admin.js: behaviour for admin.html (admin panel).
   Data below is sample data; replace with an API call later.
   Sections:
     1. Sample data
     2. Helpers (DOM, storage, toast, mobile menu)
     3. KPI rendering (counters, donut, stars, progress, chart)
     4. Pending approvals
     5. Edit personal information (form + validation)
   ========================================================= */

'use strict';

/* ---------- 1. Sample data ---------- */
const KEYS = {
  profile: 'cms.admin.profile',
  decisions: 'cms.admin.decisions'
};

const DEFAULT_PROFILE = {
  name: 'Ricardo Almeida',
  email: 'ricardo.admin@cms.pt',
  phone: '912345678',
  nif: '123456789'          // valid NIF (passes the check-digit test)
};

const DATA = {
  users: { clients: 1050, couriers: 120, staff: 30, deltaPct: 5.4 },
  routes: { completedPct: 72 },
  fleet: { activeOrders: 43, activeVehicles: 43 },
  satisfaction: { rating: 4.0, positivePct: 90 },
  tasks: { completedPct: 78, onRoute: 12, totalDeliveries: 15 },
  trips: {
    labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'],
    request: [10, 20, 30, 40, 50, 60],
    completed: [20, 25, 50, 45, 30, 100]
  },
  // status of each request is kept in "decisions" below (default: pending)
  approvals: [
    { id: 1, name: 'Ana Ferreira',  email: 'ana.ferreira@cms.pt',  role: 'Staff',   dateReceived: '2026-10-14' },
    { id: 2, name: 'Miguel Costa',  email: 'miguel.costa@cms.pt',  role: 'Staff',   dateReceived: '2026-10-16' },
    { id: 3, name: 'Beatriz Lopes', email: 'beatriz.lopes@cms.pt', role: 'Courier', dateReceived: '2026-10-19' },
    { id: 4, name: 'Tiago Marques', email: 'tiago.marques@cms.pt', role: 'Staff',   dateReceived: '2026-10-22' }
  ]
};

const STATUS_LABEL = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };

/* ---------- 2. Helpers ---------- */
const $ = id => document.getElementById(id);

// Build elements with textContent (never innerHTML with data) to avoid XSS.
function el(tag, props = {}, ...children){
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)){
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  node.append(...children);
  return node;
}

function svgEl(tag, attrs = {}){
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

function load(key, fallback){
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}

function save(key, value){
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
}

const fmt = n => Number(n).toLocaleString('en-US');

function formatDate(iso){
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/* Mobile menu */
(() => {
  const toggle = $('menuToggle');
  const nav = $('mainNav');
  if (!toggle || !nav) return;
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
})();

/* Toast */
let toastTimer;
function toast(text, isError = false){
  const t = $('toast');
  if (!t) return;
  t.textContent = text;
  t.classList.toggle('error', isError);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- 3. KPI rendering ---------- */
const decisions = load(KEYS.decisions, {});   // { approvalId: 'approved' | 'rejected' }

function approvedCount(role){
  return DATA.approvals.filter(a => a.role === role && decisions[a.id] === 'approved').length;
}

function renderUsers(){
  const clients = DATA.users.clients + approvedCount('Client');
  const couriers = DATA.users.couriers + approvedCount('Courier');
  const staff = DATA.users.staff + approvedCount('Staff');

  $('totalUsers').textContent = fmt(clients + couriers + staff);
  $('clientsCount').textContent = fmt(clients);
  $('couriersCount').textContent = fmt(couriers);
  $('staffCount').textContent = fmt(staff);

  const pct = DATA.users.deltaPct;
  const delta = $('usersDelta');
  delta.textContent = (pct >= 0 ? '+' : '') + pct.toFixed(1).replace('.', ',') + '%';
  delta.classList.toggle('down', pct < 0);
}

function renderDonut(){
  const circle = $('donutValue');
  const r = Number(circle.getAttribute('r'));
  const circumference = 2 * Math.PI * r;
  const pct = DATA.routes.completedPct;

  circle.style.strokeDasharray = circumference;
  circle.style.strokeDashoffset = circumference;           // start empty
  requestAnimationFrame(() => requestAnimationFrame(() => {
    circle.style.strokeDashoffset = circumference * (1 - pct / 100);
  }));

  $('donutPct').textContent = pct + '%';
  $('routesDonut').setAttribute('aria-label', `Target routes: ${pct}% completed`);
}

function renderFleet(){
  $('activeOrders').textContent = DATA.fleet.activeOrders;
  $('activeVehicles').textContent = DATA.fleet.activeVehicles;
}

function renderSatisfaction(){
  const s = DATA.satisfaction;
  $('ratingValue').textContent = s.rating.toFixed(1);
  $('positiveFeedback').textContent = s.positivePct;
  $('ratingStars').setAttribute('aria-label', `Rated ${s.rating.toFixed(1)} out of 5`);
  requestAnimationFrame(() => { $('starsFill').style.width = (s.rating / 5 * 100) + '%'; });
}

function renderTasks(){
  const t = DATA.tasks;
  $('taskPct').textContent = t.completedPct + '%';
  $('taskBar').setAttribute('aria-valuenow', t.completedPct);
  $('deliveriesText').textContent = `${t.onRoute}/${t.totalDeliveries} Deliveries on route`;
  requestAnimationFrame(() => { $('taskFill').style.width = t.completedPct + '%'; });
}

function renderTripsChart(){
  const d = DATA.trips;
  const W = 340, H = 190;
  const m = { l: 30, r: 12, t: 10, b: 28 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const max = Math.ceil(Math.max(...d.request, ...d.completed) / 20) * 20;
  const n = d.labels.length;

  const x = i => m.l + (i * iw) / (n - 1);
  const y = v => m.t + ih - (v / max) * ih;

  const svg = svgEl('svg', {
    viewBox: `0 0 ${W} ${H}`,
    role: 'img',
    'aria-label': `Line chart comparing requested and completed trips over ${n} weeks`
  });

  // Horizontal grid + y labels
  for (let v = 0; v <= max; v += 20){
    svg.append(svgEl('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: 'grid-line' }));
    const t = svgEl('text', { x: m.l - 6, y: y(v) + 3, 'text-anchor': 'end', class: 'axis-text' });
    t.textContent = v;
    svg.append(t);
  }

  // x labels
  d.labels.forEach((label, i) => {
    const t = svgEl('text', { x: x(i), y: H - 8, 'text-anchor': 'middle', class: 'axis-text' });
    t.textContent = label;
    svg.append(t);
  });

  // Series
  [{ key: 'request', name: 'Request' }, { key: 'completed', name: 'Completed' }].forEach(s => {
    const pts = d[s.key].map((val, i) => `${x(i)},${y(val)}`).join(' ');
    svg.append(svgEl('polyline', { points: pts, class: `line-${s.key}` }));

    d[s.key].forEach((val, i) => {
      const dot = svgEl('circle', { cx: x(i), cy: y(val), r: 3, class: `dot-${s.key}` });
      const tip = svgEl('title');
      tip.textContent = `${s.name} – ${d.labels[i]}: ${val}`;
      dot.append(tip);
      svg.append(dot);
    });
  });

  $('tripsChart').replaceChildren(svg);
}

/* ---------- 4. Pending approvals ---------- */
function decide(approval, status){
  if (status === 'pending') delete decisions[approval.id];
  else decisions[approval.id] = status;
  save(KEYS.decisions, decisions);

  renderApprovals();
  renderUsers();

  if (status === 'approved') toast(`${approval.name} approved as ${approval.role}`);
  else if (status === 'rejected') toast(`${approval.name} was rejected`);
  else toast(`Decision for ${approval.name} undone`);
}

function renderApprovals(){
  const body = $('approvalsBody');
  body.replaceChildren();

  if (!DATA.approvals.length){
    body.append(el('tr', {}, el('td', { class: 'empty', colspan: '6' }, 'No pending staff approvals.')));
    return;
  }

  DATA.approvals.forEach(a => {
    const status = decisions[a.id] || 'pending';

    const actions = el('div', { class: 'actions' });
    if (status === 'pending'){
      actions.append(
        el('button', { class: 'btn', type: 'button', 'aria-label': `Approve ${a.name}`,
          onclick: () => decide(a, 'approved') }, 'Approve'),
        el('button', { class: 'btn btn-red', type: 'button', 'aria-label': `Reject ${a.name}`,
          onclick: () => decide(a, 'rejected') }, 'Reject')
      );
    } else {
      actions.append(
        el('button', { class: 'btn btn-ghost', type: 'button', 'aria-label': `Undo decision for ${a.name}`,
          onclick: () => decide(a, 'pending') }, 'Undo')
      );
    }

    body.append(el('tr', {},
      el('td', {}, a.name),
      el('td', {}, a.email),
      el('td', {}, a.role),
      el('td', {}, formatDate(a.dateReceived)),
      el('td', {}, el('span', { class: `status status-${status}` }, STATUS_LABEL[status])),
      el('td', {}, actions)
    ));
  });

  const pending = DATA.approvals.filter(a => !decisions[a.id]).length;
  $('pendingCount').textContent = `${pending} pending`;
}

/* ---------- 5. Edit personal information ---------- */
let profile = { ...DEFAULT_PROFILE, ...load(KEYS.profile, {}) };

function renderProfile(){
  const first = profile.name.trim().split(/\s+/)[0] || 'Admin';
  $('greeting').textContent = `Hello ${first}!`;
  $('avatarInitial').textContent = first.charAt(0).toUpperCase();
}

// Portuguese NIF: 9 digits, valid first digits and mod-11 check digit
function isValidNif(nif){
  if (!/^\d{9}$/.test(nif)) return false;
  if (!/^(1|2|3|5|6|8|9|45|70|71|72|74|75|77|78|79)/.test(nif)) return false;
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += Number(nif[i]) * (9 - i);
  let check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  return check === Number(nif[8]);
}

const validators = {
  name(v){
    if (!v) return 'Enter your full name.';
    if (v.length < 3) return 'The name needs at least 3 characters.';
    if (/\d/.test(v)) return 'The name cannot contain numbers.';
    return '';
  },
  email(v){
    if (!v) return 'Enter your email address.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Enter a valid email, like name@example.com.';
    return '';
  },
  phone(v){
    if (!v) return 'Enter your phone number.';
    if (!/^(\+\d{1,3})?\d{9}$/.test(v.replace(/\s+/g, ''))) return 'Use 9 digits, optionally with a country code (+351).';
    return '';
  },
  nif(v){
    if (!v) return 'Enter your NIF.';
    if (!/^\d+$/.test(v)) return 'The NIF must contain only digits.';
    if (v.length !== 9) return 'The NIF must have exactly 9 digits.';
    if (!isValidNif(v)) return 'This NIF is not valid. Check the digits.';
    return '';
  },
  password(v){
    if (!v) return '';                                   // optional
    if (v.length < 8 || !/[A-Za-z]/.test(v) || !/\d/.test(v)) return 'Use at least 8 characters, with letters and numbers.';
    return '';
  },
  confirm(v, all){
    if (all.password && !v) return 'Confirm the new password.';
    if (all.password && v !== all.password) return 'The passwords do not match.';
    return '';
  }
};

const fieldId = name => 'pf' + name.charAt(0).toUpperCase() + name.slice(1);

function readValues(){
  const values = {};
  for (const name of Object.keys(validators)){
    const raw = $(fieldId(name)).value;
    values[name] = (name === 'password' || name === 'confirm') ? raw : raw.trim();
  }
  return values;
}

function showError(name, message){
  const input = $(fieldId(name));
  const error = $(fieldId(name) + 'Error');
  error.textContent = message;
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
  if (message) input.setAttribute('aria-describedby', error.id);
  else input.removeAttribute('aria-describedby');
}

function validateField(name){
  const values = readValues();
  const message = validators[name](values[name], values);
  showError(name, message);
  return message;
}

function validateForm(){
  return Object.keys(validators).filter(name => validateField(name));
}

function setupProfileForm(){
  const dialog = $('profileDialog');
  const form = $('profileForm');
  const alertBox = $('formAlert');

  function fillForm(){
    $('pfName').value = profile.name;
    $('pfEmail').value = profile.email;
    $('pfPhone').value = profile.phone;
    $('pfNif').value = profile.nif;
    $('pfPassword').value = '';
    $('pfConfirm').value = '';
    Object.keys(validators).forEach(n => showError(n, ''));
    alertBox.hidden = true;
  }

  $('profileBtn').addEventListener('click', () => {
    fillForm();
    dialog.showModal();
    $('pfName').focus();
  });

  dialog.querySelectorAll('[data-close]').forEach(b => {
    b.addEventListener('click', () => dialog.close());
  });

  // Validate when the user leaves a field; clear the error as they fix it
  Object.keys(validators).forEach(name => {
    const input = $(fieldId(name));
    input.addEventListener('blur', () => validateField(name));
    input.addEventListener('input', () => {
      if (name === 'nif') input.value = input.value.replace(/\D/g, '');
      if (input.getAttribute('aria-invalid') === 'true') validateField(name);
    });
  });

  form.addEventListener('submit', e => {
    e.preventDefault();                       // empty/invalid fields never get submitted
    const invalid = validateForm();

    if (invalid.length){
      alertBox.textContent = invalid.length === 1
        ? 'Fix 1 field before saving your changes.'
        : `Fix ${invalid.length} fields before saving your changes.`;
      alertBox.hidden = false;
      $(fieldId(invalid[0])).focus();
      toast('Some fields need your attention', true);
      return;
    }

    const v = readValues();
    profile = { name: v.name, email: v.email, phone: v.phone.replace(/\s+/g, ''), nif: v.nif };
    save(KEYS.profile, profile);              // the password is never stored in this prototype
    renderProfile();
    dialog.close();
    toast(v.password ? 'Profile and password saved' : 'Profile saved');
  });

  // Close when clicking the dimmed backdrop
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
}

/* ---------- Init ---------- */
renderProfile();
renderUsers();
renderDonut();
renderFleet();
renderSatisfaction();
renderTasks();
renderTripsChart();
renderApprovals();
setupProfileForm();
