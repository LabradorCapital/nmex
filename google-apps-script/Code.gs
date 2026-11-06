/**
 * nmex.ltd website forms -> Google Sheet "NMEX Website Form Submissions".
 *
 * Setup (once):
 *   1. Open the Google Sheet, then Extensions > Apps Script.
 *   2. Replace everything in Code.gs with this file and click Save.
 *   3. Deploy > New deployment > Select type (gear) > Web app.
 *        Execute as: Me
 *        Who has access: Anyone
 *      Click Deploy and allow access when Google asks.
 *   4. Copy the Web app URL (it ends in /exec) and set FORM_ENDPOINT in
 *      assets/nmex.js on the website.
 *
 * Changing this code later: save it, then Deploy > Manage deployments > edit (pencil)
 * > Version: New version > Deploy. That keeps the same URL, so the website needs no change.
 * Check: opening the URL in a browser should say "nmex.ltd form endpoint is running."
 *
 * Each form writes to its own tab, created on the first submission:
 *   Newsletter - newsletter sign-ups and shareholder contact-detail updates (Contact page)
 *   Contact    - homepage "Contact Us" messages
 *
 * To also get an email for every submission, put an address in NOTIFY_EMAIL
 * (Google will ask for permission to send email the next time you deploy).
 */

var NOTIFY_EMAIL = '';

var COLUMNS = {
  Newsletter: ['Submitted at', 'Request', 'First name', 'Last name', 'Email', 'Previous email',
               'Phone', 'Address line 1', 'Address line 2', 'City', 'State', 'ZIP', 'Page'],
  Contact: ['Submitted at', 'First name', 'Last name', 'Email', 'Phone', 'Message', 'Page']
};

var IGNORED_FIELDS = ['form_name', 'website']; // 'website' is a hidden spam trap

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var params = (e && e.parameter) || {};
    if (params.website) return respond({ ok: true }); // filled by a bot: ignore

    var formName = COLUMNS[params.form_name] ? params.form_name : 'Other';
    var sheet = getSheet(formName);
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    // Any field the sheet has not seen before gets its own column.
    Object.keys(params).forEach(function (key) {
      if (IGNORED_FIELDS.indexOf(key) === -1 && headers.indexOf(key) === -1) {
        headers.push(key);
        sheet.getRange(1, headers.length).setValue(key).setFontWeight('bold');
      }
    });

    var row = headers.map(function (header) {
      return header === 'Submitted at' ? new Date() : clean(params[header]);
    });
    sheet.appendRow(row);

    if (NOTIFY_EMAIL) {
      var body = headers.map(function (h, i) { return h + ': ' + row[i]; }).join('\n');
      MailApp.sendEmail(NOTIFY_EMAIL, 'nmex.ltd: new ' + formName + ' submission', body);
    }
    return respond({ ok: true });
  } catch (err) {
    return respond({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Visiting the web app URL in a browser shows this, which confirms it is deployed.
function doGet() {
  return ContentService.createTextOutput('nmex.ltd form endpoint is running.');
}

function getSheet(name) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
    var headers = COLUMNS[name] || ['Submitted at'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Keeps values as plain text so nothing typed into a form can run as a spreadsheet formula.
function clean(value) {
  var text = value == null ? '' : String(value).slice(0, 5000);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function respond(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
