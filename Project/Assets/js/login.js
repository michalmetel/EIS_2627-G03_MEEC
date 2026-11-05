'use strict';

const menuBtn = document.getElementById('menuToggle');
const nav = document.getElementById('mainNav');

if (menuBtn && nav) {
  menuBtn.addEventListener('click', function () {
    nav.classList.toggle('open');
  });
}

let role = 'client';

// page opened after login for each role
const rolePages = {
  client: 'client.html',
  courier: 'CourierPage.html',
  staff: 'StaffPage.html',
  admin: 'admin.html'
};

const tabs = document.querySelectorAll('.role-tab');
tabs.forEach(function (tab) {
  tab.addEventListener('click', function () {

    tabs.forEach(function (t) {
      t.classList.remove('active');
    });

    tab.classList.add('active');
    role = tab.dataset.role;

    // change the title depending on the selected user
    document.getElementById('authTitle').textContent = tab.textContent + ' Login';

    document.getElementById('loginMsg').textContent = '';
  });
});


const loginPanel = document.getElementById('loginPanel');
const registerPanel = document.getElementById('registerPanel');

document.getElementById('showRegister').addEventListener('click', function () {
  // hide login and show register form
  loginPanel.hidden = true;
  registerPanel.hidden = false;
});

document.getElementById('showLogin').addEventListener('click', function () {
  registerPanel.hidden = true;
  loginPanel.hidden = false;
});

// the Register links on other pages point to login.html#register
if (window.location.hash === '#register') {
  loginPanel.hidden = true;
  registerPanel.hidden = false;
}

// visitors are sent here with the role they need: by auth.js when they open
// a protected page, and by client.js when they submit an order
const params = new URLSearchParams(window.location.search);
tabs.forEach(function (tab) {
  if (tab.dataset.role === params.get('role')) {
    tab.click();
    document.getElementById('loginMsg').textContent = params.get('from') === 'order'
      ? 'Log in to send your order. It is saved and will be sent after you log in.'
      : 'Please log in to access the ' + tab.textContent + ' area.';
  }
});


document.getElementById('loginForm').addEventListener('submit', function (e) {
  e.preventDefault();

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const msg = document.getElementById('loginMsg');

  if (email === '' || password === '') {
    msg.textContent = 'Please complete all required fields.';
    msg.className = 'msg error';
    return;
  }

  if (!validEmail(email)) {
    msg.textContent = 'Please enter a valid email address.';
    msg.className = 'msg error';
    return;
  }

  if (password.length < 6) {
    msg.textContent = 'Password must contain at least 6 characters.';
    msg.className = 'msg error';
    return;
  }

  // only frontend validation for sprint 1
  msg.textContent = 'Login validated.';
  msg.className = 'msg success';

  // remembered until the tab is closed or the user logs out, auth.js reads it
  sessionStorage.setItem('cmsRole', role);

  setTimeout(function () {
    window.location.href = rolePages[role];
  }, 400);
});


const phoneField = setupPhone(document.getElementById('registerPhone'));


// captcha look only: pressing it always passes and nothing is saved.
// A real one needs the server to verify it (Sprint 2).
const captchaBox = document.getElementById('captchaBox');
let captchaState = 'empty';

captchaBox.addEventListener('click', function () {

  if (captchaState !== 'empty') return;

  captchaState = 'checking';
  captchaBox.classList.add('checking');
  document.getElementById('registerMsg').textContent = '';

  setTimeout(function () {
    captchaState = 'checked';
    captchaBox.classList.replace('checking', 'checked');
    captchaBox.setAttribute('aria-checked', 'true');
  }, 800);
});

function resetCaptcha() {
  captchaState = 'empty';
  captchaBox.classList.remove('checking', 'checked');
  captchaBox.setAttribute('aria-checked', 'false');
}


document.getElementById('registerForm').addEventListener('submit', function (e) {
  e.preventDefault();

  const name = document.getElementById('registerName').value.trim();
  const email = document.getElementById('registerEmail').value.trim();
  const phone = document.getElementById('registerPhone').value.trim();
  const nif = document.getElementById('registerNif').value.trim();
  const password = document.getElementById('registerPassword').value;
  const msg = document.getElementById('registerMsg');

  if (name === '' || email === '' || phone === '' || nif === '' || password === '') {
    msg.textContent = 'Please complete all required fields.';
    msg.className = 'msg error';
    return;
  }

  if (!validEmail(email)) {
    msg.textContent = 'Please enter a valid email address.';
    msg.className = 'msg error';
    return;
  }

  // checks the number against the country chosen in the picker
  if (phoneField && !phoneField.isValidNumberPrecise()) {
    msg.textContent = 'Please enter a valid phone number for the selected country.';
    msg.className = 'msg error';
    return;
  }

  // nif must have 9 digits
  if (!/^\d{9}$/.test(nif)) {
    msg.textContent = 'NIF must contain 9 digits.';
    msg.className = 'msg error';
    return;
  }

  if (password.length < 6) {
    msg.textContent = 'Password must contain at least 6 characters.';
    msg.className = 'msg error';
    return;
  }

  if (captchaState !== 'checked') {
    msg.textContent = "Please confirm you're not a robot.";
    msg.className = 'msg error';
    return;
  }

  resetCaptcha();
  msg.textContent = 'Registration validated. Data will be saved in sprint 2.';
  msg.className = 'msg success';
});


function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
