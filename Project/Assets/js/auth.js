'use strict';

// Login guard for the pages behind a login. Load it first in <head>:
//   <script src="../Assets/js/auth.js" data-role="courier"></script>
// Without data-role the page stays public and only the Logout button is handled
// (the client page: it asks for a login when an order is submitted, see client.js).
// Frontend only for now: it stops normal navigation but is not real security,
// the server has to check the session once there is a backend.
(function () {
  const required = document.currentScript.dataset.role;

  function guard() {
    if (required && sessionStorage.getItem('cmsRole') !== required) {
      // hide the page so it doesn't flash before the redirect
      document.documentElement.style.visibility = 'hidden';
      window.location.replace('login.html?role=' + required);
    }
  }

  guard();

  // the Back button can restore a page from memory without running this script again
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) guard();
  });

  // the name of whoever logged in (the admin page shows its own editable profile)
  document.addEventListener('DOMContentLoaded', function () {
    const name = sessionStorage.getItem('cmsName');
    const text = document.querySelector('.user-text strong:not(#greeting)');
    const avatar = document.querySelector('span.avatar');

    if (name && text) text.textContent = 'Hello ' + name.split(' ')[0] + '!';
    if (name && avatar) avatar.textContent = name.charAt(0).toUpperCase();
  });

  document.addEventListener('click', function (e) {
    if (e.target.closest('.logout')) {
      ['cmsRole', 'cmsName', 'cmsEmail'].forEach(function (key) {
        sessionStorage.removeItem(key);
      });
    }
  });
})();
