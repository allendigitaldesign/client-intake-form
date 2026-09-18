/* ---------------------------------------------------------------------------
   app.js — form rendering, autosave, uploads and submission.

   You should not need to edit this file to reuse the form for another client.
   Questions live in questions.js; backend settings live in config.js.
   --------------------------------------------------------------------------- */

(function () {
  'use strict';

  var CONFIG = window.FORM_CONFIG;
  var BACKEND = window.BACKEND_CONFIG;

  var STORAGE_KEY = BACKEND.storageKey;
  var MAX_BYTES = BACKEND.maxFileBytes;
  var UPLOAD_CONCURRENCY = 2;

  /* ----- Small helpers --------------------------------------------------- */

  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    var bytes = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(bytes);
    } else {
      for (var i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    var hex = [];
    for (var j = 0; j < 16; j++) hex.push((bytes[j] + 0x100).toString(16).slice(1));
    return hex.slice(0, 4).join('') + '-' + hex.slice(4, 6).join('') + '-' +
           hex.slice(6, 8).join('') + '-' + hex.slice(8, 10).join('') + '-' +
           hex.slice(10, 16).join('');
  }

  function formatBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function safeName(name) {
    return String(name).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-120) || 'file';
  }

  /* ----- State ------------------------------------------------------------ */

  var state = {
    submissionId: null,
    startedAt: null,
    answers: {},   /* fieldId -> string */
    files: {}      /* fieldId -> [ {uid,name,size,type,path,status,percent} ] */
  };

  var liveFiles = {};   /* uid -> File object, this page-load only */
  var uploadQueue = [];
  var activeUploads = 0;
  var submitted = false;

  function loadState() {
    var raw = null;
    try { raw = window.localStorage.getItem(STORAGE_KEY); } catch (e) { raw = null; }
    if (raw) {
      try {
        var saved = JSON.parse(raw);
        if (saved && saved.submissionId) {
          state.submissionId = saved.submissionId;
          state.startedAt = saved.startedAt || new Date().toISOString();
          state.answers = saved.answers || {};
          state.files = saved.files || {};
        }
      } catch (e) { /* corrupt entry — start fresh */ }
    }
    if (!state.submissionId) {
      state.submissionId = uuid();
      state.startedAt = new Date().toISOString();
    }
    /* Anything left mid-upload from a previous visit cannot be resumed —
       the File object is gone. Drop those so the list matches reality. */
    Object.keys(state.files).forEach(function (fieldId) {
      state.files[fieldId] = (state.files[fieldId] || []).filter(function (f) {
        return f.status === 'done';
      });
    });
  }

  var saveTimer = null;
  function saveState() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
          submissionId: state.submissionId,
          startedAt: state.startedAt,
          answers: state.answers,
          files: state.files
        }));
      } catch (e) { /* private mode or full — form still works, just no resume */ }
    }, 250);
  }

  function clearState() {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  /* ----- Question inventory (for the progress counter) -------------------- */

  var questionFields = [];
  CONFIG.sections.forEach(function (section) {
    section.fields.forEach(function (field) {
      if (field.type !== 'files') questionFields.push(field);
    });
  });

  function answeredCount() {
    var n = 0;
    questionFields.forEach(function (f) {
      var v = state.answers[f.id];
      if (v && String(v).trim() !== '') n++;
    });
    return n;
  }

  /* ----- Rendering --------------------------------------------------------- */

  var formEl, barCountEl, submitBtn, panelHost;

  function renderField(field, section) {
    if (field.type === 'radio') return renderRadio(field);
    if (field.type === 'files') return renderFiles(field);
    return renderTextish(field);
  }

  function renderTextish(field) {
    var wrap = el('div', 'field');
    var inputId = 'f_' + field.id;

    var label = el('label', 'field-label', field.label);
    label.setAttribute('for', inputId);
    wrap.appendChild(label);

    if (field.hint) wrap.appendChild(el('span', 'hint', field.hint));

    var input;
    if (field.type === 'textarea') {
      input = document.createElement('textarea');
      input.rows = 4;
    } else {
      input = document.createElement('input');
      input.type = 'text';
    }
    input.id = inputId;
    input.name = field.id;
    if (field.placeholder) input.placeholder = field.placeholder;
    input.value = state.answers[field.id] || '';

    input.addEventListener('input', function () {
      state.answers[field.id] = input.value;
      saveState();
      updateBar();
    });

    wrap.appendChild(input);
    return wrap;
  }

  function renderRadio(field) {
    var wrap = el('fieldset', 'field');
    var legend = el('legend', 'field-label', field.label);
    wrap.appendChild(legend);

    if (field.hint) wrap.appendChild(el('span', 'hint', field.hint));

    var list = el('div', 'options');

    field.options.forEach(function (optionText, idx) {
      var optId = 'f_' + field.id + '_' + idx;
      var row = el('label', 'option');
      row.setAttribute('for', optId);

      var radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = field.id;
      radio.id = optId;
      radio.value = optionText;
      if (state.answers[field.id] === optionText) {
        radio.checked = true;
        row.classList.add('is-selected');
      }

      radio.addEventListener('change', function () {
        state.answers[field.id] = optionText;
        saveState();
        Array.prototype.forEach.call(list.querySelectorAll('.option'), function (r) {
          r.classList.remove('is-selected');
        });
        row.classList.add('is-selected');
        updateBar();
      });

      row.appendChild(radio);
      row.appendChild(el('span', 'option-text', optionText));
      list.appendChild(row);
    });

    wrap.appendChild(list);
    return wrap;
  }

  function renderFiles(field) {
    var wrap = el('div', 'field');
    wrap.appendChild(el('span', 'field-label', field.label));

    var box = el('div', 'uploader');
    var inputId = 'f_' + field.id;

    var input = document.createElement('input');
    input.type = 'file';
    input.id = inputId;
    input.multiple = true;
    input.accept = 'image/*,.heic,.heif,.pdf,application/pdf';

    var btn = el('label', 'upload-btn', 'Choose files');
    btn.setAttribute('for', inputId);

    input.addEventListener('change', function () {
      addFiles(field.id, input.files);
      input.value = '';
    });

    box.appendChild(input);
    box.appendChild(btn);

    if (field.note) box.appendChild(el('p', 'upload-note', field.note));

    var list = el('ul', 'file-list');
    list.id = 'list_' + field.id;
    box.appendChild(list);

    /* Drag and drop, for when he does it at a desk instead. */
    box.addEventListener('dragover', function (e) {
      e.preventDefault();
      box.classList.add('is-dragging');
    });
    box.addEventListener('dragleave', function () { box.classList.remove('is-dragging'); });
    box.addEventListener('drop', function (e) {
      e.preventDefault();
      box.classList.remove('is-dragging');
      if (e.dataTransfer && e.dataTransfer.files) addFiles(field.id, e.dataTransfer.files);
    });

    wrap.appendChild(box);
    renderFileList(field.id, list);
    return wrap;
  }

  function renderFileList(fieldId, listEl) {
    var list = listEl || document.getElementById('list_' + fieldId);
    if (!list) return;
    list.innerHTML = '';

    var entries = state.files[fieldId] || [];
    entries.forEach(function (entry) {
      var li = el('li', 'file-item');
      li.appendChild(el('span', 'file-name', entry.name));
      li.appendChild(el('span', 'file-size', formatBytes(entry.size)));

      if (entry.status === 'uploading') {
        var track = el('div', 'progress-track');
        var fill = el('div', 'progress-fill');
        fill.style.width = (entry.percent || 0) + '%';
        track.appendChild(fill);
        li.appendChild(track);
        li.appendChild(el('span', 'file-state', (entry.percent || 0) + '%'));
      } else if (entry.status === 'done') {
        li.appendChild(el('span', 'file-state done', 'Sent'));
      } else if (entry.status === 'failed') {
        li.appendChild(el('span', 'file-state failed', 'Failed'));
        var retry = el('button', 'file-remove', 'Retry');
        retry.type = 'button';
        retry.addEventListener('click', function () {
          if (!liveFiles[entry.uid]) {
            alert('Choose that file again — it needs to be re-selected before it can be sent.');
            return;
          }
          entry.status = 'queued';
          entry.percent = 0;
          renderFileList(fieldId);
          uploadQueue.push({ fieldId: fieldId, entry: entry });
          pumpQueue();
        });
        li.appendChild(retry);
      } else {
        li.appendChild(el('span', 'file-state', 'Waiting'));
      }

      if (entry.status !== 'uploading') {
        var remove = el('button', 'file-remove', 'Remove');
        remove.type = 'button';
        remove.addEventListener('click', function () {
          state.files[fieldId] = (state.files[fieldId] || []).filter(function (f) {
            return f.uid !== entry.uid;
          });
          delete liveFiles[entry.uid];
          saveState();
          renderFileList(fieldId);
          updateBar();
        });
        li.appendChild(remove);
      }

      list.appendChild(li);
    });
  }

  /* ----- Uploads ------------------------------------------------------------ */

  function addFiles(fieldId, fileList) {
    if (!state.files[fieldId]) state.files[fieldId] = [];
    var rejected = [];

    Array.prototype.forEach.call(fileList, function (file) {
      if (file.size > MAX_BYTES) {
        rejected.push(file.name + ' (' + formatBytes(file.size) + ')');
        return;
      }
      var uid = uuid();
      var entry = {
        uid: uid,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        path: state.submissionId + '/' + fieldId + '/' + uid + '-' + safeName(file.name),
        status: 'queued',
        percent: 0
      };
      liveFiles[uid] = file;
      state.files[fieldId].push(entry);
      uploadQueue.push({ fieldId: fieldId, entry: entry });
    });

    saveState();
    renderFileList(fieldId);
    updateBar();
    pumpQueue();

    if (rejected.length) {
      alert('These were too big to send (limit is ' + formatBytes(MAX_BYTES) + ' each):\n\n' +
            rejected.join('\n'));
    }
  }

  function pumpQueue() {
    while (activeUploads < UPLOAD_CONCURRENCY && uploadQueue.length) {
      var job = uploadQueue.shift();
      if (!liveFiles[job.entry.uid]) continue;
      activeUploads++;
      uploadOne(job.fieldId, job.entry);
    }
    updateBar();
  }

  function uploadOne(fieldId, entry) {
    var file = liveFiles[entry.uid];
    entry.status = 'uploading';
    entry.percent = 0;
    renderFileList(fieldId);
    updateBar();

    var url = BACKEND.supabaseUrl + '/storage/v1/object/' +
              BACKEND.bucket + '/' + entry.path;

    var xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('apikey', BACKEND.supabaseKey);
    xhr.setRequestHeader('Authorization', 'Bearer ' + BACKEND.supabaseKey);
    xhr.setRequestHeader('Content-Type', entry.type);

    xhr.upload.onprogress = function (e) {
      if (!e.lengthComputable) return;
      var pct = Math.round((e.loaded / e.total) * 100);
      if (pct !== entry.percent) {
        entry.percent = pct;
        renderFileList(fieldId);
        updateBar();
      }
    };

    function finish(ok) {
      entry.status = ok ? 'done' : 'failed';
      entry.percent = ok ? 100 : entry.percent;
      activeUploads--;
      saveState();
      renderFileList(fieldId);
      updateBar();
      pumpQueue();
    }

    xhr.onload = function () { finish(xhr.status >= 200 && xhr.status < 300); };
    xhr.onerror = function () { finish(false); };
    xhr.onabort = function () { finish(false); };

    xhr.send(file);
  }

  function uploadStats() {
    var total = 0, done = 0, uploading = 0, failed = 0, pctSum = 0;
    Object.keys(state.files).forEach(function (fieldId) {
      (state.files[fieldId] || []).forEach(function (f) {
        total++;
        if (f.status === 'done') { done++; pctSum += 100; }
        else if (f.status === 'failed') { failed++; }
        else { uploading++; pctSum += (f.percent || 0); }
      });
    });
    return {
      total: total, done: done, inFlight: uploading, failed: failed,
      percent: total ? Math.round(pctSum / total) : 100
    };
  }

  /* ----- Sticky bar ---------------------------------------------------------- */

  function updateBar() {
    var stats = uploadStats();
    barCountEl.innerHTML = '';

    if (stats.inFlight > 0) {
      barCountEl.appendChild(el('strong', null, 'Sending files — ' + stats.percent + '%'));
      barCountEl.appendChild(document.createTextNode(
        ' · ' + stats.done + ' of ' + stats.total + ' done'));
    } else {
      barCountEl.appendChild(el('strong', null, answeredCount() + ' of ' + questionFields.length));
      barCountEl.appendChild(document.createTextNode(' answered'));
      if (stats.done > 0) {
        barCountEl.appendChild(document.createTextNode(
          ' · ' + stats.done + (stats.done === 1 ? ' file' : ' files')));
      }
    }
  }

  /* ----- Plain-text transcript (clipboard fallback) --------------------------- */

  function buildTranscript() {
    var lines = [];
    lines.push(CONFIG.title);
    lines.push('Submitted: ' + new Date().toLocaleString());
    lines.push('Reference: ' + state.submissionId);
    lines.push('');

    CONFIG.sections.forEach(function (section) {
      var head = section.number ? section.number + '. ' + section.heading : section.heading;
      lines.push('== ' + head.toUpperCase() + ' ==');
      section.fields.forEach(function (field) {
        if (field.type === 'files') {
          var entries = (state.files[field.id] || []);
          if (entries.length) {
            lines.push(field.label + ':');
            entries.forEach(function (f) {
              lines.push('  - ' + f.name + ' (' + formatBytes(f.size) + ', ' + f.status + ')');
            });
          }
          return;
        }
        var v = state.answers[field.id];
        if (v && String(v).trim() !== '') {
          lines.push(field.label + ':');
          lines.push(String(v).trim());
          lines.push('');
        }
      });
      lines.push('');
    });

    return lines.join('\n');
  }

  function copyTranscript(button) {
    var text = buildTranscript();
    function done() {
      button.textContent = 'Copied';
      setTimeout(function () { button.textContent = 'Copy my answers'; }, 2500);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { legacyCopy(text, done); });
    } else {
      legacyCopy(text, done);
    }
  }

  function legacyCopy(text, cb) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    try { document.execCommand('copy'); cb(); } catch (e) { alert('Copy did not work. Please screenshot instead.'); }
    document.body.removeChild(ta);
  }

  /* ----- Panels --------------------------------------------------------------- */

  function showPanel(heading, body, withCopy) {
    panelHost.innerHTML = '';
    var panel = el('div', 'panel');
    panel.setAttribute('role', 'alert');
    panel.appendChild(el('h2', null, heading));
    panel.appendChild(el('p', null, body));
    if (withCopy) {
      var btn = el('button', 'link-btn', 'Copy my answers');
      btn.type = 'button';
      btn.addEventListener('click', function () { copyTranscript(btn); });
      panel.appendChild(btn);
    }
    panelHost.appendChild(panel);
    panel.scrollIntoView({ block: 'center' });
  }

  function clearPanel() { panelHost.innerHTML = ''; }

  /* ----- Submission ------------------------------------------------------------ */

  function collectPayload() {
    var answers = [];
    var files = [];

    CONFIG.sections.forEach(function (section) {
      var sectionName = section.number
        ? section.number + '. ' + section.heading
        : section.heading;

      section.fields.forEach(function (field) {
        if (field.type === 'files') {
          (state.files[field.id] || []).forEach(function (f) {
            if (f.status !== 'done') return;
            files.push({
              section: sectionName,
              field: field.label,
              name: f.name,
              size: f.size,
              type: f.type,
              path: f.path
            });
          });
          return;
        }
        var v = state.answers[field.id];
        if (v && String(v).trim() !== '') {
          answers.push({
            section: sectionName,
            id: field.id,
            label: field.label,
            value: String(v).trim()
          });
        }
      });
    });

    return {
      submissionId: state.submissionId,
      formTitle: CONFIG.title,
      startedAt: state.startedAt,
      answeredCount: answeredCount(),
      questionCount: questionFields.length,
      answers: answers,
      files: files,
      website: document.getElementById('hp_website').value   /* honeypot */
    };
  }

  function handleSubmit() {
    clearPanel();
    var stats = uploadStats();

    if (stats.inFlight > 0) {
      showPanel(
        'Files are still going up',
        'Give it a moment — ' + stats.done + ' of ' + stats.total +
        ' are through. The button will work as soon as they finish.',
        false
      );
      return;
    }

    if (stats.failed > 0) {
      var go = window.confirm(
        stats.failed + (stats.failed === 1 ? ' file' : ' files') +
        ' did not upload. Send the form without ' +
        (stats.failed === 1 ? 'it' : 'them') + '?'
      );
      if (!go) return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    var payload = collectPayload();

    fetch(BACKEND.supabaseUrl + '/functions/v1/' + BACKEND.functionName, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': BACKEND.supabaseKey,
        'Authorization': 'Bearer ' + BACKEND.supabaseKey
      },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        try { data = JSON.parse(text); } catch (e) {}
        if (!res.ok) throw new Error((data && data.error) || ('HTTP ' + res.status));
        return data;
      });
    }).then(function () {
      submitted = true;
      clearState();
      showDone(payload);
    }).catch(function (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send it in';
      showPanel(
        'That did not go through',
        'Something blocked the send (' + err.message + '). Your answers are still ' +
        'saved on this device. Try again, or copy everything and text it to Joseph.',
        true
      );
    });
  }

  function showDone(payload) {
    document.body.innerHTML = '';

    var wrap = el('div', 'wrap');
    var screen = el('div', 'done-screen');

    screen.appendChild(el('p', 'done-mark', 'Received'));

    var h = el('h1', null, CONFIG.confirmation.heading);
    screen.appendChild(h);
    screen.appendChild(el('p', null, CONFIG.confirmation.body));

    var summary = el('div', 'done-files');
    summary.appendChild(el('strong', null,
      payload.answers.length + ' of ' + payload.questionCount + ' questions answered' +
      (payload.files.length
        ? ' · ' + payload.files.length + (payload.files.length === 1 ? ' file' : ' files') + ' uploaded'
        : ' · no files')));

    if (payload.files.length) {
      var ul = el('ul');
      payload.files.forEach(function (f) {
        ul.appendChild(el('li', null, f.name + ' (' + formatBytes(f.size) + ')'));
      });
      summary.appendChild(ul);
    }
    screen.appendChild(summary);

    screen.appendChild(el('p', 'colophon',
      'Reference ' + payload.submissionId + ' · Allen Digital Design Co.'));

    wrap.appendChild(screen);
    document.body.appendChild(wrap);
    window.scrollTo(0, 0);
    document.title = 'Sent — ' + CONFIG.title;
  }

  /* ----- Build the page --------------------------------------------------------- */

  function build() {
    loadState();

    document.title = CONFIG.title;
    document.getElementById('page-title').textContent = CONFIG.title;
    document.getElementById('page-intro').textContent = CONFIG.intro;

    formEl = document.getElementById('form-body');
    barCountEl = document.getElementById('progress-count');
    submitBtn = document.getElementById('submit-btn');
    panelHost = document.getElementById('panel-host');

    CONFIG.sections.forEach(function (section) {
      var sec = el('section', 'section');
      sec.id = 'sec_' + section.id;

      var head = el('div', 'section-head' + (section.number ? '' : ' no-num'));
      if (section.number) head.appendChild(el('div', 'section-num', section.number));
      head.appendChild(el('h2', 'section-title', section.heading));
      if (section.blurb) head.appendChild(el('p', 'section-blurb', section.blurb));
      sec.appendChild(head);

      section.fields.forEach(function (field) {
        sec.appendChild(renderField(field, section));
      });

      formEl.appendChild(sec);
    });

    submitBtn.addEventListener('click', function (e) {
      e.preventDefault();
      handleSubmit();
    });

    document.getElementById('intake-form').addEventListener('submit', function (e) {
      e.preventDefault();
      handleSubmit();
    });

    window.addEventListener('beforeunload', function (e) {
      if (submitted) return;
      if (uploadStats().inFlight > 0) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    });

    updateBar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }

})();
