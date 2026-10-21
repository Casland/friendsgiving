(function () {
  'use strict';
  var C = window.FG;
  var COURSES = [
    { key: 'appetizer', label: 'Starters', one: 'a starter', img: 'pumpkins' },
    { key: 'main', label: 'Mains', one: 'a main', img: 'gravy' },
    { key: 'side', label: 'Sides', one: 'a side', img: 'casserole' },
    { key: 'dessert', label: 'Desserts', one: 'a dessert', img: 'pie' },
    { key: 'drinks', label: 'Drinks', one: 'drinks', img: 'cider' },
    { key: 'other', label: 'Wild cards', one: 'anything', img: 'leaves' }
  ];
  var STATUS_LINE = {
    yes: function (n) { return 'See you there, ' + n + '!'; },
    maybe: function (n) { return 'Got it, ' + n + '. We’ll save you a maybe-chair.'; },
    no: function (n) { return 'We’ll miss you, ' + n + '.'; }
  };
  var $ = function (id) { return document.getElementById(id); };

  // ---------- who am I (kept in this browser) ----------
  var ME_KEY = 'fg2026-me';
  var me = load(ME_KEY) || {};
  if (!me.guestId) { me.guestId = 'g' + rand(); save(ME_KEY, me); }
  me.dishes = me.dishes || {};

  function rand() {
    var a = new Uint8Array(12); crypto.getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode: fine */ } }

  // ---------- data: Apps Script, or a browser-only preview ----------
  var api = C.apiUrl ? remoteApi(C.apiUrl) : previewApi();

  function remoteApi(url) {
    function handle(r) {
      if (!r.ok) throw new Error('The sign-up sheet didn’t answer (' + r.status + '). Try again in a minute.');
      return r.json().then(function (d) { if (!d.ok) throw new Error(d.error || 'Something went wrong.'); return d; });
    }
    return {
      list: function () { return fetch(url + '?action=list').then(handle); },
      // text/plain keeps this a "simple" request, so Apps Script doesn't need to answer a CORS preflight
      post: function (body) { return fetch(url, { method: 'POST', body: JSON.stringify(body) }).then(handle); }
    };
  }

  function previewApi() {
    var KEY = 'fg2026-preview';
    var db = load(KEY) || {
      rsvps: [
        { guestId: 'demo1', name: 'Priya', status: 'yes', count: 2 },
        { guestId: 'demo2', name: 'Marcus', status: 'yes', count: 1 },
        { guestId: 'demo3', name: 'Jen', status: 'maybe', count: 1 }
      ],
      dishes: [
        { id: 'ddemo1', guestId: 'demo1', name: 'Priya', dish: 'Sweet potato casserole', course: 'side', serves: '10', tags: ['vegetarian'] },
        { id: 'ddemo2', guestId: 'demo2', name: 'Marcus', dish: 'Bourbon pecan pie', course: 'dessert', serves: '8', tags: ['has nuts'] },
        { id: 'ddemo3', guestId: 'demo3', name: 'Jen', dish: 'Cranberry spritzers', course: 'drinks', serves: '', tags: ['vegan'] }
      ],
      tokens: {}
    };
    function out() { save(KEY, db); return Promise.resolve({ ok: true, rsvps: db.rsvps, dishes: db.dishes }); }
    function fail(msg) { return Promise.reject(new Error(msg)); }
    return {
      list: out,
      post: function (b) {
        if (b.action === 'rsvp') {
          var r = { guestId: b.guestId, name: b.name, status: b.status, count: b.count };
          var i = db.rsvps.findIndex(function (x) { return x.guestId === b.guestId; });
          if (i >= 0) db.rsvps[i] = r; else db.rsvps.push(r);
        } else if (b.action === 'dish') {
          db.dishes.push({ id: b.id, guestId: b.guestId, name: b.name, dish: b.dish, course: b.course, serves: b.serves, tags: b.tags });
          db.tokens[b.id] = b.token;
        } else if (b.action === 'removeDish') {
          if (db.tokens[b.id] !== b.token) return fail('Only the person who added this dish can remove it.');
          db.dishes = db.dishes.filter(function (d) { return d.id !== b.id; });
        }
        return out();
      }
    };
  }

  // ---------- static details ----------
  $('title').textContent = C.title;
  $('year').textContent = C.year;
  $('dateLabel').textContent = C.dateLabel;
  $('timeLabel').textContent = C.timeLabel;
  $('blurb').textContent = C.blurb;
  $('hosts').textContent = 'Hosted by ' + C.hosts;
  document.title = C.title + ' ' + C.year;
  if (C.address) {
    var a = document.createElement(C.mapUrl ? 'a' : 'span');
    a.textContent = C.address;
    if (C.mapUrl) { a.href = C.mapUrl; a.target = '_blank'; a.rel = 'noopener'; }
    $('where').appendChild(a);
  } else {
    $('where').textContent = 'At ' + C.place + '. The address is on your invite.';
  }
  if (!C.apiUrl) $('previewNote').hidden = false;

  var sel = $('courseSelect');
  COURSES.forEach(function (c) {
    var o = document.createElement('option'); o.value = c.key; o.textContent = c.label.replace(/s$/, '').replace('Wild card', 'Something else');
    sel.appendChild(o);
  });
  sel.value = 'side';

  // ---------- state + rendering ----------
  var state = { rsvps: [], dishes: [] };
  var justAdded = null;

  function render() {
    renderRsvp();
    renderTable();
    renderGuests();
  }

  function renderRsvp() {
    var mine = state.rsvps.find(function (r) { return r.guestId === me.guestId; });
    var form = $('rsvpForm');
    if (mine && !form.dataset.editing) {
      $('rsvpDone').hidden = false; form.hidden = true;
      $('rsvpDoneLine').textContent = STATUS_LINE[mine.status](mine.name) +
        (mine.status !== 'no' && mine.count > 1 ? ' (party of ' + mine.count + ')' : '');
    } else {
      $('rsvpDone').hidden = true; form.hidden = false;
    }
  }

  function renderTable() {
    var hostPlates = (C.hostDishes || []).map(function (d, i) {
      return { id: 'host' + i, name: 'the hosts', dish: d.dish, course: d.course, tags: d.tags || [], host: true };
    });
    var all = hostPlates.concat(state.dishes);
    var wrap = $('courses'); wrap.textContent = '';
    var openTotal = 0;

    COURSES.forEach(function (c) {
      var here = all.filter(function (d) { return (d.course || 'other') === c.key; });
      var guestCount = here.filter(function (d) { return !d.host; }).length;
      var open = Math.max(0, ((C.wants || {})[c.key] || 0) - guestCount);
      openTotal += open;
      if (!here.length && !open) return;

      var sec = el('div', 'course');
      var head = el('h3', 'course-head', c.label);
      if (here.length) head.appendChild(el('span', '', here.length + (here.length === 1 ? ' dish' : ' dishes')));
      sec.appendChild(head);
      var ul = el('ul', 'plates');
      here.forEach(function (d) { ul.appendChild(plate(d, c)); });
      for (var i = 0; i < open; i++) ul.appendChild(openPlate(c));
      sec.appendChild(ul);
      wrap.appendChild(sec);
    });

    var n = state.dishes.length;
    $('tableSum').textContent = (n ? n + (n === 1 ? ' dish' : ' dishes') + ' from friends so far' : 'No dishes from friends yet. Be the first!') +
      (openTotal ? '. ' + openTotal + ' open ' + (openTotal === 1 ? 'plate' : 'plates') + ' still.' : '. The table is full!');
  }

  function plate(d, c) {
    var li = el('li', 'plate' + (d.id === justAdded ? ' is-new' : ''));
    var dish = el('div', 'plate-dish');
    var img = el('img'); img.src = 'assets/' + c.img + '.webp'; img.alt = '';
    dish.appendChild(img); li.appendChild(dish);
    var label = el('div', 'plate-label');
    label.appendChild(el('span', 'plate-name', d.dish));
    label.appendChild(el('span', 'plate-who', 'from ' + d.name + (d.serves ? ', feeds ' + d.serves : '')));
    if (d.tags && d.tags.length) label.appendChild(el('span', 'plate-tags', d.tags.join(', ')));
    li.appendChild(label);
    if (me.dishes[d.id]) {
      var b = el('button', 'link-btn', 'Take it off the table'); b.type = 'button';
      b.addEventListener('click', function () { removeDish(d, b); });
      li.appendChild(b);
    }
    return li;
  }

  function openPlate(c) {
    var li = el('li', 'plate open');
    var b = el('button'); b.type = 'button';
    var dish = el('div', 'plate-dish'); dish.appendChild(el('span', '', '+'));
    var label = el('div', 'plate-label'); label.appendChild(el('span', 'plate-name', 'Room for ' + c.one));
    b.appendChild(dish); b.appendChild(label);
    b.addEventListener('click', function () {
      sel.value = c.key;
      $('dishForm').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
      $('dishForm').elements.dish.focus({ preventScroll: true });
    });
    li.appendChild(b);
    return li;
  }

  function renderGuests() {
    var coming = state.rsvps.filter(function (r) { return r.status === 'yes'; });
    var maybe = state.rsvps.filter(function (r) { return r.status === 'maybe'; });
    var heads = coming.reduce(function (s, r) { return s + (Number(r.count) || 1); }, 0);
    $('guestSum').textContent = heads
      ? heads + (heads === 1 ? ' person is' : ' people are') + ' coming' + (maybe.length ? ', and ' + maybe.length + ' maybe.' : '.')
      : (maybe.length ? maybe.length + ' maybe so far.' : 'No RSVPs yet.');
    var ul = $('guestList'); ul.textContent = '';
    if (!C.showGuestNames) return;
    coming.concat(maybe).forEach(function (r) {
      var extra = r.count > 1 ? ' +' + (r.count - 1) : '';
      ul.appendChild(el('li', r.status === 'maybe' ? 'maybe' : '', r.name + extra));
    });
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function refresh() {
    return api.list().then(function (d) { state = d; render(); }).catch(function (e) {
      $('tableSum').textContent = e.message;
    });
  }

  // ---------- RSVP form ----------
  var rsvpForm = $('rsvpForm');
  var count = 1;
  function setCount(n) { count = Math.max(1, Math.min(12, n)); $('countOut').textContent = count; }
  rsvpForm.addEventListener('click', function (e) {
    var s = e.target.getAttribute && e.target.getAttribute('data-step');
    if (s) setCount(count + Number(s));
  });
  rsvpForm.addEventListener('change', function () {
    var st = rsvpForm.elements.status.value;
    $('countField').hidden = st === 'no';
  });
  if (me.name) { rsvpForm.elements.name.value = me.name; $('dishForm').elements.name.value = me.name; }

  $('rsvpEdit').addEventListener('click', function () {
    var mine = state.rsvps.find(function (r) { return r.guestId === me.guestId; });
    rsvpForm.dataset.editing = '1';
    if (mine) {
      rsvpForm.elements.name.value = mine.name;
      rsvpForm.elements.status.value = mine.status;
      setCount(mine.count || 1);
      $('countField').hidden = mine.status === 'no';
    }
    renderRsvp();
    rsvpForm.elements.name.focus();
  });

  rsvpForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = rsvpForm.elements, msg = $('rsvpMsg');
    var name = f.name.value.trim(), status = f.status.value;
    if (!name) return say(msg, 'Add your name so we know who’s coming.', true, f.name);
    if (!status) return say(msg, 'Pick one: I’ll be there, maybe, or can’t make it.', true);
    remember(name);
    submit(rsvpForm, msg, {
      action: 'rsvp', guestId: me.guestId, name: name, status: status,
      count: status === 'no' ? 0 : count, note: f.note.value.trim(), website: f.website.value
    }, function () { delete rsvpForm.dataset.editing; say(msg, ''); });
  });

  // ---------- dish form ----------
  var dishForm = $('dishForm');
  dishForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = dishForm.elements, msg = $('dishMsg');
    var name = f.name.value.trim(), dish = f.dish.value.trim();
    if (!name) return say(msg, 'Add your name so people know who’s bringing it.', true, f.name);
    if (!dish) return say(msg, 'Say what you’re bringing.', true, f.dish);
    remember(name);
    var id = 'd' + rand(), token = 't' + rand();
    var tags = Array.prototype.filter.call(f.tags, function (t) { return t.checked; }).map(function (t) { return t.value; });
    me.dishes[id] = token; save(ME_KEY, me);
    submit(dishForm, msg, {
      action: 'dish', guestId: me.guestId, id: id, token: token, name: name, dish: dish,
      course: f.course.value, serves: f.serves.value.trim(), tags: tags, website: f.website.value
    }, function () {
      justAdded = id; render(); justAdded = null;
      say(msg, dish + ' is on the table. Thank you!', false);
      f.dish.value = ''; f.serves.value = '';
      Array.prototype.forEach.call(f.tags, function (t) { t.checked = false; });
    }, function () { delete me.dishes[id]; save(ME_KEY, me); });
  });

  function removeDish(d, btn) {
    btn.disabled = true; btn.textContent = 'Taking it back…';
    api.post({ action: 'removeDish', id: d.id, token: me.dishes[d.id] }).then(function (res) {
      delete me.dishes[d.id]; save(ME_KEY, me);
      state = res; render();
      say($('dishMsg'), d.dish + ' is off the table.', false);
    }).catch(function (e) {
      btn.disabled = false; btn.textContent = 'Take it off the table';
      say($('dishMsg'), e.message, true);
    });
  }

  function submit(form, msg, body, done, failed) {
    var btn = form.querySelector('button[type=submit]'), label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Saving…'; say(msg, '');
    api.post(body).then(function (res) {
      state = res; render(); done();
    }).catch(function (e) {
      if (failed) failed();
      say(msg, e.message || 'That didn’t save. Check your connection and try again.', true);
    }).then(function () { btn.disabled = false; btn.textContent = label; });
  }

  function say(msg, text, isErr, focus) {
    msg.textContent = text; msg.className = 'form-msg' + (text ? (isErr ? ' err' : ' ok') : '');
    if (focus) focus.focus();
  }

  function remember(name) {
    me.name = name; save(ME_KEY, me);
    [rsvpForm, dishForm].forEach(function (f) { if (!f.elements.name.value.trim()) f.elements.name.value = name; });
  }

  // ---------- calendar ----------
  $('calBtn').addEventListener('click', function () {
    var stamp = function (s) { return s.replace(/[-:]/g, '').slice(0, 15); };
    var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//friendsgiving//EN', 'BEGIN:VEVENT',
      'UID:friendsgiving-' + C.year + '@casland.github.io',
      'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
      'DTSTART:' + stamp(C.start), 'DTEND:' + stamp(C.end),
      'SUMMARY:' + C.title + ' ' + C.year,
      'LOCATION:' + (C.address || 'See your invite'),
      'DESCRIPTION:RSVP and dishes: ' + location.href.split('#')[0],
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = 'friendsgiving-' + C.year + '.ics';
    a.click();
  });

  refresh();
  setInterval(function () { if (!document.hidden) refresh(); }, 45000);
})();
