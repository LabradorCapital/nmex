/*
 * nmex.ltd — website forms.
 *
 * Entries are saved to the Google Sheet "NMEX Website Form Submissions" through a
 * Google Apps Script web app (code: google-apps-script/Code.gs in this repository).
 * Paste the web app URL (it ends in /exec) into FORM_ENDPOINT below.
 * Until it is set, forms open the visitor's email app with their details filled in.
 */
(function () {
  'use strict';

  var FORM_ENDPOINT = '';
  var CONTACT_EMAIL = 'cerronrs@msn.com';

  function all(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function setStatus(form, text, state) {
    var status = form.querySelector('.nmex-form__status');
    if (!status) return;
    status.textContent = text;
    status.setAttribute('data-state', state || '');
  }

  function collect(form) {
    var data = new URLSearchParams();
    new FormData(form).forEach(function (value, key) {
      data.append(key, String(value).trim());
    });
    data.append('Page', window.location.href.split('#')[0]);
    return data;
  }

  function sendByEmail(form, data) {
    var lines = [];
    data.forEach(function (value, key) {
      if (value && key !== 'form_name' && key !== 'website') lines.push(key + ': ' + value);
    });
    var who = [data.get('First name'), data.get('Last name')].join(' ').trim();
    var subject = 'nmex.ltd ' + (data.get('form_name') || 'Contact') + (who ? ' - ' + who : '');
    window.location.href = 'mailto:' + CONTACT_EMAIL +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(lines.join('\n'));
    setStatus(form, 'Your email app should open with your details filled in. Press Send to finish. ' +
      'If nothing opens, email ' + CONTACT_EMAIL + '.', 'ok');
  }

  all('form[data-nmex-form]').forEach(function (form) {
    var choices = all('input[name="Request"]', form);

    // Show the extra fields only when a shareholder is updating their details.
    function syncFields() {
      var updating = choices.some(function (input) {
        return input.checked && input.value.indexOf('Update') === 0;
      });
      all('[data-show-when="update"]', form).forEach(function (field) {
        field.hidden = !updating;
        all('input, textarea', field).forEach(function (input) { input.disabled = !updating; });
      });
    }
    choices.forEach(function (input) { input.addEventListener('change', syncFields); });
    if (choices.length) syncFields();

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var trap = form.querySelector('[name="website"]');
      if (trap && trap.value) return; // spam bot filled the hidden field
      if (!form.reportValidity()) return;

      var data = collect(form);
      if (!FORM_ENDPOINT) {
        sendByEmail(form, data);
        return;
      }

      var button = form.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      setStatus(form, 'Sending…', '');

      fetch(FORM_ENDPOINT, { method: 'POST', mode: 'no-cors', body: data })
        .then(function () {
          form.reset();
          if (choices.length) syncFields();
          setStatus(form, form.getAttribute('data-success') || 'Thank you, your details have been received.', 'ok');
        })
        .catch(function () {
          setStatus(form, 'Sorry, that did not go through. Please try again, or email ' + CONTACT_EMAIL + '.', 'error');
        })
        .then(function () {
          if (button) button.disabled = false;
        });
    });
  });

  // Investor page: links to a collapsed section (e.g. earlier filings) open it.
  function openTarget(id) {
    var el = id && document.getElementById(id);
    if (el && el.tagName === 'DETAILS') el.open = true;
  }
  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('a[href^="#"]');
    if (link) openTarget(link.getAttribute('href').slice(1));
  });
  window.addEventListener('hashchange', function () { openTarget(window.location.hash.slice(1)); });
  openTarget(window.location.hash.slice(1));

  all('[data-nmex-year]').forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
