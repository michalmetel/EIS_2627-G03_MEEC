'use strict';

// Stand-in for the database until the backend exists: keeps sample records in this
// browser so the pages can work together. Passwords, phones and NIFs are never stored.
function cmsRead(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (e) {
    return fallback;
  }
}

function cmsWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // storage blocked: the page still works, it just won't remember
  }
}

function cmsAccounts() {
  return cmsRead('cms.accounts', []);
}

function cmsFindAccount(email) {
  return cmsAccounts().find(function (account) {
    return account.email === email.toLowerCase();
  });
}

function cmsAddAccount(account) {
  cmsWrite('cms.accounts', cmsAccounts().concat(account));
}

// sample people on the staff and admin pages aren't accounts, so nothing changes for them
function cmsSetAccountStatus(id, status) {
  cmsWrite('cms.accounts', cmsAccounts().map(function (account) {
    return account.id === id ? Object.assign({}, account, { status: status }) : account;
  }));
}
