// Google Apps Script for the form's response spreadsheet.
// It gives every submission 1 point and copies it to Supabase, and when an
// admin changes a "Points" cell to 0 (or back to 1) it updates Supabase too.
//
// Setup (once):
//   1. Open the response spreadsheet → Extensions → Apps Script.
//   2. Paste this whole file into Code.gs and save.
//   3. Project Settings (gear icon) → Script properties → add:
//        SUPABASE_URL         https://<project>.supabase.co
//        SUPABASE_SECRET_KEY  the secret / service_role key (NOT the publishable key)
//   4. Pick "setup" in the function dropdown → Run → allow the permissions.
//
// Admins: to remove a video's point, set its "Points" cell to 0.
// Don't delete rows — the website wouldn't notice.

const SHEET_NAME = 'Form Responses 1';
const TIMESTAMP_HEADER = 'Timestamp';
// The form question that identifies the person. It can be titled "Username"
// or "User ID" and can hold either a username or the long account ID.
const USER_HEADERS = ['Username', 'User ID'];
const VIDEO_HEADER = 'Video';     // must match the form question title
const ID_HEADER = 'Submission ID';
const POINTS_HEADER = 'Points';
const STATUS_HEADER = 'Sync status';

function setup() {
  const ss = SpreadsheetApp.getActive();
  ensureColumns(getSheet());

  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('onFormSubmitted').forSpreadsheet(ss).onFormSubmit().create();
  ScriptApp.newTrigger('onSheetEdited').forSpreadsheet(ss).onEdit().create();
}

// Adds a menu to the sheet for re-sending everything (e.g. after an error)
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Competition')
    .addItem('Re-sync all rows', 'syncAll')
    .addToUi();
}

function onFormSubmitted(e) {
  const sheet = e.range.getSheet();
  if (sheet.getName() !== SHEET_NAME) return;

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const cols = ensureColumns(sheet);
    const row = e.range.getRow();
    sheet.getRange(row, cols[ID_HEADER]).setValue(Utilities.getUuid());
    const pointsCell = sheet.getRange(row, cols[POINTS_HEADER]);
    pointsCell.setValue(1);
    pointsCell.setDataValidation(pointsRule());
    syncRow(sheet, row, cols);
  } finally {
    lock.releaseLock();
  }
}

function onSheetEdited(e) {
  const sheet = e.range.getSheet();
  if (sheet.getName() !== SHEET_NAME) return;

  const cols = headerMap(sheet);
  const pointsCol = cols[POINTS_HEADER];
  if (!pointsCol) return;
  if (pointsCol < e.range.getColumn() || pointsCol > e.range.getLastColumn()) return;

  for (let row = Math.max(2, e.range.getRow()); row <= e.range.getLastRow(); row++) {
    syncRow(sheet, row, cols);
  }
}

function syncAll() {
  const sheet = getSheet();
  const cols = ensureColumns(sheet);
  for (let row = 2; row <= sheet.getLastRow(); row++) {
    syncRow(sheet, row, cols);
  }
}

// ---------- Helpers ----------

function syncRow(sheet, row, cols) {
  const values = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  const get = header => values[cols[header] - 1];
  const status = sheet.getRange(row, cols[STATUS_HEADER]);

  if (!get(TIMESTAMP_HEADER)) return; // empty row

  let id = get(ID_HEADER);
  if (!id) {
    id = Utilities.getUuid();
    sheet.getRange(row, cols[ID_HEADER]).setValue(id);
  }

  const points = Number(get(POINTS_HEADER));
  if (points !== 0 && points !== 1) {
    status.setValue('Not synced: Points must be 0 or 1');
    return;
  }

  try {
    upsertSubmission({
      id: id,
      user_id: findUserId(String(get(userHeader(cols))).trim()),
      video_url: String(get(VIDEO_HEADER)),
      points: points,
      submitted_at: new Date(get(TIMESTAMP_HEADER)).toISOString(),
    });
    status.setValue('Synced ' + new Date().toLocaleString());
  } catch (err) {
    status.setValue('Error: ' + err.message);
  }
}

function supabaseConfig() {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty('SUPABASE_URL');
  const key = props.getProperty('SUPABASE_SECRET_KEY');
  if (!url || !key) {
    throw new Error('Add SUPABASE_URL and SUPABASE_SECRET_KEY in Script properties');
  }
  const headers = { apikey: key };
  if (key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + key; // legacy service_role key
  return { url: url.replace(/\/$/, ''), headers: headers };
}

// Turns what the person entered into their account ID.
// Accepts a username (any capitalisation) or the long account ID itself.
function findUserId(value) {
  if (!value) throw new Error('Username is empty');
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    return value.toLowerCase();
  }

  const cfg = supabaseConfig();
  const res = UrlFetchApp.fetch(
    cfg.url + '/rest/v1/profiles?select=id,username&username=ilike.' + encodeURIComponent(value),
    { headers: cfg.headers, muteHttpExceptions: true }
  );
  if (res.getResponseCode() >= 300) {
    throw new Error('Could not look up username: ' + res.getContentText());
  }
  // ilike treats _ and % as wildcards, so keep only an exact match
  const match = JSON.parse(res.getContentText())
    .find(p => String(p.username).toLowerCase() === value.toLowerCase());
  if (!match) throw new Error('No account has the username "' + value + '"');
  return match.id;
}

function upsertSubmission(body) {
  const cfg = supabaseConfig();
  const headers = Object.assign({ Prefer: 'resolution=merge-duplicates,return=minimal' }, cfg.headers);

  const res = UrlFetchApp.fetch(cfg.url + '/rest/v1/submissions?on_conflict=id', {
    method: 'post',
    contentType: 'application/json',
    headers: headers,
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() < 300) return;

  let message = res.getContentText();
  try {
    const json = JSON.parse(message);
    if (json.code === '23503') message = 'No account has this username';
    else if (json.code === '22P02') message = 'User ID is not valid';
    else message = json.message || message;
  } catch (_) {
    // not JSON, keep the raw text
  }
  throw new Error(message);
}

function getSheet() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('No sheet named "' + SHEET_NAME + '"');
  return sheet;
}

// { header name: column number }
function headerMap(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach((h, i) => { if (h) map[String(h).trim()] = i + 1; });
  return map;
}

// Adds our extra columns if they're missing, and checks the form ones exist
function ensureColumns(sheet) {
  let cols = headerMap(sheet);
  [TIMESTAMP_HEADER, VIDEO_HEADER].forEach(h => {
    if (!cols[h]) throw new Error('Missing column "' + h + '" — check the form question titles');
  });
  userHeader(cols); // throws if there's no Username / User ID column
  [ID_HEADER, POINTS_HEADER, STATUS_HEADER].forEach(h => {
    if (!cols[h]) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(h).setFontWeight('bold');
      cols = headerMap(sheet);
    }
  });
  return cols;
}

// Which of USER_HEADERS this sheet uses
function userHeader(cols) {
  const h = USER_HEADERS.find(name => cols[name]);
  if (!h) throw new Error('Missing a "Username" or "User ID" column — check the form question titles');
  return h;
}

function pointsRule() {
  return SpreadsheetApp.newDataValidation()
    .requireValueInList(['1', '0'])
    .setAllowInvalid(false)
    .build();
}
