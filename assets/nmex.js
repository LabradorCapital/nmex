/*
 * nmex.ltd — website forms.
 *
 * Entries are saved to the Google Sheet "NMEX Website Form Submissions" through a
 * Google Apps Script web app (code: google-apps-script/Code.gs in this repository).
 * An entry only counts as saved when the web app answers {"ok": true}. If it does not
 * (no endpoint set, deployment broken, network down), the form opens the visitor's
 * email app with their details filled in, so nothing is lost.
 */
(function () {
  'use strict';

  var FORM_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyK-ZUxrIAXfbawztASjXixbb3h1jSV8IKEXSFjyP-7xOVwA3w9n2abiyIoiGFYFn-O/exec';
  var CONTACT_EMAIL = 'cerronrs@msn.com';
  var TIMEOUT_MS = 20000;

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

  function sendByEmail(form, data, intro) {
    var lines = [];
    data.forEach(function (value, key) {
      if (value && key !== 'form_name' && key !== 'website') lines.push(key + ': ' + value);
    });
    var who = [data.get('First name'), data.get('Last name')].join(' ').trim();
    var subject = 'nmex.ltd ' + (data.get('form_name') || 'Contact') + (who ? ' - ' + who : '');
    window.location.href = 'mailto:' + CONTACT_EMAIL +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(lines.join('\n'));
    setStatus(form, (intro || 'Your email app should open with your details filled in.') +
      ' Press Send to finish. If nothing opens, email ' + CONTACT_EMAIL + '.', 'ok');
  }

  // Resolves only when the web app confirms the entry was saved.
  function saveToSheet(data) {
    var controller = window.AbortController ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, TIMEOUT_MS) : null;
    return fetch(FORM_ENDPOINT, { method: 'POST', body: data, signal: controller ? controller.signal : undefined })
      .then(function (response) { return response.json(); })
      .then(function (result) {
        if (timer) clearTimeout(timer);
        if (!result || result.ok !== true) throw new Error('not saved');
      }, function (error) {
        if (timer) clearTimeout(timer);
        throw error;
      });
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

      saveToSheet(data)
        .then(function () {
          form.reset();
          if (choices.length) syncFields();
          setStatus(form, form.getAttribute('data-success') || 'Thank you, your details have been received.', 'ok');
        })
        .catch(function () {
          // Not confirmed as saved: hand the entry to the visitor's email app instead of losing it.
          sendByEmail(form, data, 'We could not save your details automatically, so your email app will open with them filled in.');
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
