'use strict';

const menuBtn = document.getElementById('menuToggle');
const nav = document.getElementById('mainNav');

if (menuBtn && nav) {
  menuBtn.addEventListener('click', function () {
    nav.classList.toggle('open');
  });
}

let role = 'client';

const tabs = document.querySelectorAll('.role-tab');
tabs.forEach(function (tab) {
  tab.addEventListener('click', function () {

    tabs.forEach(function (t) {
      t.classList.remove('active');
    });

    tab.classList.add('active');
    role = tab.dataset.role;

    // change the title depending on the selected user
    if (role === 'client') {
      document.getElementById('authTitle').textContent = 'Client Login';
    } else {
      document.getElementById('authTitle').textContent = 'Staff Login';
    }

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

  setTimeout(function () {
    if (role === 'client') {
      window.location.href = 'client.html';
    } else {
      window.location.href = 'StaffPage.html';
    }
  }, 400);
});


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

  msg.textContent = 'Registration validated. Data will be saved in sprint 2.';
  msg.className = 'msg success';
});


function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
