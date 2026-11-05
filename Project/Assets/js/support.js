'use strict';

const menuBtn = document.getElementById('menuToggle');
const nav = document.getElementById('mainNav');

if (menuBtn && nav) {
  menuBtn.addEventListener('click', function () {
    nav.classList.toggle('open');
  });
}

document.getElementById('contactForm').addEventListener('submit', function (e) {
  e.preventDefault();

  const name = document.getElementById('contactName').value.trim();
  const email = document.getElementById('contactEmail').value.trim();
  const message = document.getElementById('contactMessage').value.trim();
  const msg = document.getElementById('contactMsg');

  if (name === '' || email === '' || message === '') {
    msg.textContent = 'Please complete all required fields.';
    msg.className = 'contact-msg error';
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    msg.textContent = 'Please enter a valid email address.';
    msg.className = 'contact-msg error';
    return;
  }

  this.reset();
  msg.textContent = 'Message checked. Sending it needs the backend (Sprint 2).';
  msg.className = 'contact-msg success';
});
