'use strict';

// Phone field with the country picker (intl-tel-input). Returns null if the library
// didn't load, the field then still works as a plain text input.
function setupPhone(input) {

  if (!window.intlTelInput) return null;

  return window.intlTelInput(input, {
    initialCountry: 'pt',
    countryOrder: ['pt', 'es', 'fr', 'gb', 'de'],
    separateDialCode: true
  });
}
