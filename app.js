(function () {
  'use strict';
  var C = window.FG;
  var COURSES = [
    { key: 'appetizer', label: 'Starters', option: 'Starter', one: 'a starter', eg: 'Deviled eggs' },
    { key: 'main', label: 'Mains', option: 'Main', one: 'a main', eg: 'Honey baked ham' },
    { key: 'side', label: 'Sides', option: 'Side', one: 'a side', eg: 'Mom’s mac and cheese' },
    { key: 'dessert', label: 'Desserts', option: 'Dessert', one: 'a dessert', eg: 'Pecan pie' },
    { key: 'drinks', label: 'Drinks', option: 'Drinks', one: 'drinks', eg: 'Mulled cider' },
    { key: 'other', label: 'Something else', option: 'Something else', one: 'something', eg: 'A bag of ice' }
  ];
  var OPEN_PLATES = 3;   // each course starts with this many empty plates, and always keeps at least one
  var STATUS_LINE = {
    yes: function (n) { return 'See you there, ' + n + '!'; },
    maybe: function (n) { return 'Got it, ' + n + '. We’ll save you a maybe-chair.'; },
    no: function (n) { return 'We’ll miss you, ' + n + '.'; }
  };
  var $ = function (id) { return document.getElementById(id); };
  var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  var scrollMode = function () { return reduceMotion.matches ? 'auto' : 'smooth'; };

  // ?preview forces the browser-only preview, so testing never writes to the real sheet.
  var PREVIEW = !C.apiUrl || new URLSearchParams(location.search).has('preview');

  // ---------- who am I (kept in this browser) ----------
  var ME_KEY = PREVIEW ? 'fg2026-me-preview' : 'fg2026-me';
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
  var api = PREVIEW ? previewApi() : remoteApi(C.apiUrl);

  function remoteApi(url) {
    function handle(r) {
      if (!r.ok) throw new Error('The sign-up sheet didn’t answer (' + r.status + '). Try again in a minute.');
      return r.json().then(function (d) { if (!d.ok) throw new Error(d.error || 'Something went wrong.'); return d; });
    }
    return {
      list: function () { return fetch(url + '?action=list').then(handle); },
      // text/plain keeps this a "simple" request, so Apps Script doesn't need to answer a CORS preflight
      post: function (body) { return fetch(url, { method: 'POST', body: JSON.stringify(body) }).then(handle); },
      art: function (id) { return fetch(url + '?action=art&id=' + encodeURIComponent(id)).then(handle); }
    };
  }

  // ---------- drawn-to-order dish pictures (backend draws them with fal.ai; stock pictures until they arrive) ----------
  var artSrc = {}, artAsked = {}, artQueue = [], artBusy = false;
  function cachedArt(id) {
    if (!artSrc[id]) { try { artSrc[id] = localStorage.getItem('fg2026-art-' + id) || ''; } catch (e) { artSrc[id] = ''; } }
    return artSrc[id];
  }
  function wantArt() {
    if (!api.art) return;
    state.dishes.forEach(function (d) {
      if (cachedArt(d.id) || artAsked[d.id]) return;
      artAsked[d.id] = true; artQueue.push(d);
    });
    nextArt();
  }
  function nextArt() {
    if (artBusy || !artQueue.length) return;
    var d = artQueue.shift(); artBusy = true;
    (d.art ? Promise.resolve({ art: true }) : api.post({ action: 'art', id: d.id }).catch(function () { return {}; }))
      .then(function (r) { return r.art ? api.art(d.id) : null; })
      .then(function (a) {
        if (!a) return;
        var src = 'data:' + a.type + ';base64,' + a.data;
        artSrc[d.id] = src;
        try { localStorage.setItem('fg2026-art-' + d.id, src); } catch (e) { /* full: keep it for this visit only */ }
        var img = document.querySelector('.plate[data-id="' + d.id + '"] img.dish');
        if (img) { img.src = src; img.classList.add('drawn'); }
      })
      .catch(function () { /* stock picture stays */ })
      .then(function () { artBusy = false; nextArt(); });
  }

  function previewApi() {
    var KEY = 'fg2026-preview-v2';
    var db = load(KEY) || {
      rsvps: [
        { guestId: 'demo1', name: 'Priya', status: 'yes', count: 3, adults: 2, kids: 1 },
        { guestId: 'demo2', name: 'Marcus', status: 'yes', count: 1 },   // old-style row: count only
        { guestId: 'demo3', name: 'Jen', status: 'maybe', count: 1, adults: 1, kids: 0 }
      ],
      dishes: [
        { id: 'ddemo1', guestId: 'demo1', name: 'Priya', dish: 'Sweet potato casserole', course: 'side' },
        { id: 'ddemo2', guestId: 'demo2', name: 'Marcus', dish: 'Bourbon pecan pie', course: 'dessert' },
        { id: 'ddemo3', guestId: 'demo3', name: 'Jen', dish: 'Cranberry spritzers', course: 'drinks' }
      ],
      tokens: {}
    };
    function out() { save(KEY, db); return Promise.resolve(JSON.parse(JSON.stringify({ ok: true, rsvps: db.rsvps, dishes: db.dishes }))); }
    function fail(msg) { return Promise.reject(new Error(msg)); }
    return {
      list: out,
      post: function (b) {
        if (b.website) return out();
        if (b.action === 'rsvp') {
          var r = { guestId: b.guestId, name: b.name, status: b.status, count: b.count, adults: b.adults, kids: b.kids };
          var i = db.rsvps.findIndex(function (x) { return x.guestId === b.guestId; });
          if (i >= 0) db.rsvps[i] = r; else db.rsvps.push(r);
        } else if (b.action === 'dish') {
          db.dishes.push({ id: b.id, guestId: b.guestId, name: b.name, dish: b.dish, course: b.course });
          db.tokens[b.id] = b.token;
        } else if (b.action === 'removeDish') {
          if (db.tokens[b.id] !== b.token) return fail('Only the person who added this dish can remove it.');
          db.dishes = db.dishes.filter(function (d) { return d.id !== b.id; });
        }
        return out();
      }
    };
  }

  // ---------- dish pictures: keyword library in assets/dishes/map.json ----------
  var PICS = { base: 'assets/dishes/', keys: [], keywords: {}, fallback: {} };
  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/&/g, ' and ').replace(/['’‘`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function picture(dish, course) {
    var hay = ' ' + norm(dish) + ' ';
    for (var i = 0; i < PICS.keys.length; i++) {
      if (hay.indexOf(' ' + PICS.keys[i] + ' ') >= 0) return PICS.base + PICS.keywords[PICS.keys[i]];
    }
    return PICS.base + (PICS.fallback[course] || 'mystery-' + (course || 'other') + '.webp');
  }
  var picsReady = fetch('assets/dishes/map.json?v=4').then(function (r) { return r.json(); }).then(function (m) {
    PICS.base = m.base || PICS.base;
    PICS.keywords = m.keywords || {};
    PICS.fallback = m.fallback || {};
    PICS.keys = Object.keys(PICS.keywords).sort(function (a, b) { return b.length - a.length; });
  }).catch(function () { /* fall back to the per-course mystery dish */ });

  // ---------- static details ----------
  $('dateLabel').textContent = C.dateLabel;
  $('timeLabel').textContent = C.timeLabel;
  $('where').textContent = 'At ' + C.place;
  $('blurb').textContent = C.blurb;
  $('hosts').textContent = 'Hosted by ' + C.hosts;
  if (PREVIEW) $('previewNote').hidden = false;

  var sel = $('courseSelect');
  COURSES.forEach(function (c) {
    var o = document.createElement('option'); o.value = c.key; o.textContent = c.option;
    sel.appendChild(o);
  });
  function course(key) { return COURSES.find(function (c) { return c.key === key; }) || COURSES[COURSES.length - 1]; }

  // ---------- the turkey: hops a few times on load, tap for another ----------
  var turkeyBtn = $('turkeyBtn'), turkey = turkeyBtn.querySelector('.turkey');
  function syncTurkey() { turkeyBtn.disabled = reduceMotion.matches; }
  syncTurkey();
  if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', syncTurkey);
  turkeyBtn.addEventListener('click', function () {
    turkey.classList.add('tk-off');
    void turkey.offsetWidth;          // restart the CSS animations from the top
    turkey.classList.remove('tk-off');
    turkey.classList.add('tk-once');
  });

  // ---------- state + rendering ----------
  var state = { rsvps: [], dishes: [] };
  var extra = {};          // open plates added on this screen by tapping the last one, per course
  var picked = null;       // { course, index } of the open plate whose form is showing
  var grown = null;        // { course, index } of a plate that just appeared (for the pop-in)
  var justAdded = null;    // id of the dish that just landed

  function render() {
    renderRsvp();
    renderTable();
    renderGuests();
  }

  function party(r) {
    var a = Number(r.adults), k = Number(r.kids);
    if (!(a + k > 0)) { a = r.status === 'no' ? 0 : (Number(r.count) || 1); k = 0; }  // older backend: count only
    return { adults: a || 0, kids: k || 0 };
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function partyText(p) {
    if (!p.kids) return plural(p.adults, 'adult', 'adults');
    if (!p.adults) return plural(p.kids, 'kid', 'kids');
    return plural(p.adults, 'adult', 'adults') + ' and ' + plural(p.kids, 'kid', 'kids');
  }
  function joinAnd(list) {
    return list.length < 2 ? list.join('') : list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
  }

  function renderRsvp() {
    var mine = state.rsvps.find(function (r) { return r.guestId === me.guestId; });
    var form = $('rsvpForm');
    if (mine && !form.dataset.editing) {
      $('rsvpDone').hidden = false; form.hidden = true;
      $('rsvpDoneLine').textContent = (STATUS_LINE[mine.status] || STATUS_LINE.yes)(mine.name);
      var p = party(mine);
      $('rsvpParty').textContent = mine.status !== 'no' && p.adults + p.kids > 1 ? partyText(p) + '.' : '';
      $('rsvpParty').hidden = !$('rsvpParty').textContent;
      // the one next step after an RSVP: pick a dish (or a thank-you if they already have)
      var myDishes = state.dishes.filter(function (d) { return me.dishes[d.id]; }).map(function (d) { return d.dish; });
      var nudge = $('rsvpNudge');
      nudge.hidden = mine.status === 'no';
      if (myDishes.length) {
        $('nudgeText').textContent = 'You’re bringing ' + joinAnd(myDishes) + '. Thank you!';
        $('nudgeLink').hidden = true;
      } else {
        $('nudgeText').textContent = 'What are you bringing? Pick an empty plate on the table.';
        $('nudgeLink').hidden = false;
      }
    } else {
      $('rsvpDone').hidden = true; form.hidden = false;
    }
  }

  // ---------- the table ----------
  var dishForm = $('dishForm');
  var tableInner = dishForm.parentNode;

  function renderTable() {
    // keep the dish form (and what's being typed) when the table re-renders under it
    var active = document.activeElement, keep = dishForm.contains(active) ? active : null;
    var selStart = keep && keep.selectionStart, selEnd = keep && keep.selectionEnd;

    var hostPlates = (C.hostDishes || []).map(function (d, i) {
      return { id: 'host' + i, name: 'the hosts', dish: d.dish, course: d.course, host: true };
    });
    var all = hostPlates.concat(state.dishes);
    var wrap = $('courses'); wrap.textContent = '';

    COURSES.forEach(function (c) {
      var here = all.filter(function (d) { return course(d.course).key === c.key; });
      var filled = here.filter(function (d) { return !d.host; }).length;
      var open = Math.max(OPEN_PLATES - filled, 1) + (extra[c.key] || 0);

      var sec = el('div', 'course');
      sec.appendChild(el('h3', 'course-head', c.label));
      var ul = el('ul', 'plates');
      ul.setAttribute('aria-label', c.label);
      here.forEach(function (d) { ul.appendChild(plate(d, c)); });
      for (var i = 0; i < open; i++) ul.appendChild(openPlate(c, i, open));
      sec.appendChild(ul);
      if (picked && picked.course === c.key) sec.appendChild(dishForm);
      wrap.appendChild(sec);
    });
    if (!picked) tableInner.appendChild(dishForm);
    grown = null;

    if (keep && document.contains(keep)) {
      keep.focus({ preventScroll: true });
      try { if (selStart != null) keep.setSelectionRange(selStart, selEnd); } catch (e) { /* select box */ }
    }

    var n = state.dishes.length;
    $('tableSum').textContent = (n ? plural(n, 'dish', 'dishes') + ' from friends so far.' : 'No dishes from friends yet.') +
      ' Tap an empty plate to bring one.';
  }

  function setting(src, ghost) {
    var s = el('span', 'setting');
    if (src) {
      var img = el('img', 'dish' + (ghost ? ' ghost' : '')); img.src = src; img.alt = ''; img.decoding = 'async';
      s.appendChild(img);
    }
    return s;
  }

  function plate(d, c) {
    var li = el('li', 'plate' + (d.id === justAdded ? ' is-new' : ''));
    li.dataset.id = d.id;
    var drawn = cachedArt(d.id);
    var s = setting(drawn || picture(d.dish, c.key));
    if (drawn) s.firstChild.classList.add('drawn');
    li.appendChild(s);
    var card = el('span', 'place-card');
    card.appendChild(el('span', 'plate-name', d.dish));
    card.appendChild(el('span', 'plate-who', 'from ' + d.name));
    li.appendChild(card);
    if (me.dishes[d.id]) {
      var b = el('button', 'link-btn take-back', 'Take it back'); b.type = 'button';
      b.setAttribute('aria-label', 'Take ' + d.dish + ' back off the table');
      b.addEventListener('click', function () { removeDish(d, b); });
      li.appendChild(b);
    }
    return li;
  }

  function openPlate(c, i, open) {
    var isPicked = picked && picked.course === c.key && picked.index === i;
    var isGrown = grown && grown.course === c.key && grown.index === i;
    var typed = isPicked && dishForm.elements.dish.value.trim();
    var li = el('li', 'plate open' + (isPicked ? ' is-picked' : '') + (isGrown ? ' is-grown' : '') + (typed ? ' has-ghost' : ''));
    var b = el('button'); b.type = 'button';
    b.dataset.course = c.key; b.dataset.index = i;
    if (isPicked) b.setAttribute('aria-expanded', 'true');
    var s = setting(typed ? picture(typed, dishForm.elements.course.value) : null, true);
    if (!typed) s.appendChild(el('span', 'plus', '+'));
    b.appendChild(s);
    var card = el('span', 'place-card'); card.appendChild(el('span', 'plate-name', 'I’ll bring ' + c.one));
    b.appendChild(card);
    b.addEventListener('click', function () { pickPlate(c, i, open); });
    li.appendChild(b);
    return li;
  }

  function pickPlate(c, i, open) {
    if (i === open - 1) {                      // tapped the last open plate: set another one to its right
      extra[c.key] = (extra[c.key] || 0) + 1;
      grown = { course: c.key, index: open };
    }
    var f = dishForm.elements;
    var wasOpen = !!picked;
    picked = { course: c.key, index: i };
    f.course.value = c.key;
    f.dish.placeholder = c.eg;
    $('bringHeading').textContent = 'I’ll bring ' + c.one;
    say($('dishMsg'), '');
    if (!f.name.value.trim() && me.name) f.name.value = me.name;
    dishForm.hidden = false;
    renderTable();
    var target = f.name.value.trim() ? f.dish : f.name;
    target.focus({ preventScroll: true });
    dishForm.scrollIntoView({ behavior: wasOpen ? 'auto' : scrollMode(), block: 'nearest' });
  }

  function closeForm(focusPlate) {
    var was = picked;
    picked = null;
    dishForm.hidden = true;
    renderTable();
    if (focusPlate && was) {
      var b = document.querySelector('.plate.open button[data-course="' + was.course + '"][data-index="' + was.index + '"]');
      if (b) b.focus();
    }
  }

  // live picture on the chosen plate as you type
  dishForm.elements.dish.addEventListener('input', updateGhost);
  sel.addEventListener('change', updateGhost);
  function updateGhost() {
    if (!picked) return;
    var b = document.querySelector('.plate.open button[data-course="' + picked.course + '"][data-index="' + picked.index + '"]');
    if (!b) return;
    var typed = dishForm.elements.dish.value.trim();
    b.parentNode.classList.toggle('has-ghost', !!typed);
    var s = b.querySelector('.setting'), img = s.querySelector('img'), plus = s.querySelector('.plus');
    if (typed) {
      if (plus) plus.remove();
      if (!img) { img = el('img', 'dish ghost'); img.alt = ''; s.appendChild(img); }
      var src = picture(typed, sel.value);
      if (img.getAttribute('src') !== src) img.src = src;
    } else {
      if (img) img.remove();
      if (!plus) s.appendChild(el('span', 'plus', '+'));
    }
  }

  $('bringCancel').addEventListener('click', function () { closeForm(true); });
  dishForm.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeForm(true); });

  // ---------- who's coming ----------
  function renderGuests() {
    var coming = state.rsvps.filter(function (r) { return r.status === 'yes'; });
    var maybe = state.rsvps.filter(function (r) { return r.status === 'maybe'; });
    var tot = coming.reduce(function (s, r) { var p = party(r); s.adults += p.adults; s.kids += p.kids; return s; }, { adults: 0, kids: 0 });
    var line;
    if (tot.adults + tot.kids) line = partyText(tot) + ' coming' + (maybe.length ? ', and ' + maybe.length + ' maybe.' : '.');
    else line = maybe.length ? plural(maybe.length, 'maybe', 'maybes') + ' so far.' : 'No RSVPs yet.';
    $('guestSum').textContent = line;
    var ul = $('guestList'); ul.textContent = '';
    if (!C.showGuestNames) return;
    coming.concat(maybe).forEach(function (r) {
      var p = party(r), n = p.adults + p.kids;
      var li = el('li', r.status === 'maybe' ? 'maybe' : '', r.name + (n > 1 ? ' +' + (n - 1) : ''));
      ul.appendChild(li);
    });
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function refresh() {
    return api.list().then(function (d) { state = d; render(); wantArt(); }).catch(function (e) {
      $('tableSum').textContent = e.message;
    });
  }

  // ---------- RSVP form ----------
  var rsvpForm = $('rsvpForm');
  var people = { adults: 1, kids: 0 };
  var LIMITS = { adults: [1, 12], kids: [0, 12] };
  function setPeople(who, n) {
    people[who] = Math.max(LIMITS[who][0], Math.min(LIMITS[who][1], n));
    $(who + 'Out').textContent = people[who];
  }
  rsvpForm.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-step]');
    if (t) setPeople(t.dataset.who, people[t.dataset.who] + Number(t.dataset.step));
  });
  function syncParty() { $('partyField').hidden = rsvpForm.elements.status.value === 'no'; }
  rsvpForm.addEventListener('change', syncParty);
  if (me.name) { rsvpForm.elements.name.value = me.name; dishForm.elements.name.value = me.name; }

  $('rsvpEdit').addEventListener('click', function () {
    var mine = state.rsvps.find(function (r) { return r.guestId === me.guestId; });
    rsvpForm.dataset.editing = '1';
    if (mine) {
      rsvpForm.elements.name.value = mine.name;
      rsvpForm.elements.status.value = mine.status;
      var p = party(mine);
      setPeople('adults', p.adults || 1); setPeople('kids', p.kids);
      syncParty();
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
    var a = status === 'no' ? 0 : people.adults, k = status === 'no' ? 0 : people.kids;
    submit(rsvpForm, msg, {
      action: 'rsvp', guestId: me.guestId, name: name, status: status,
      adults: a, kids: k, count: a + k, website: f.website.value
    }, function () {
      delete rsvpForm.dataset.editing; say(msg, ''); render();
      $('rsvpHeading').focus({ preventScroll: true });
    });
  });
  $('rsvpHeading').tabIndex = -1;

  $('nudgeLink').addEventListener('click', function (e) {
    e.preventDefault();
    $('table').scrollIntoView({ behavior: scrollMode(), block: 'start' });
    var first = document.querySelector('.plate.open button');
    if (first) first.focus({ preventScroll: true });
  });

  // ---------- dish form ----------
  dishForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = dishForm.elements, msg = $('dishMsg');
    var name = f.name.value.trim(), dish = f.dish.value.trim();
    if (!name) return say(msg, 'Add your name so people know who’s bringing it.', true, f.name);
    if (!dish) return say(msg, 'Say what you’re bringing.', true, f.dish);
    remember(name);
    var id = 'd' + rand(), token = 't' + rand();
    me.dishes[id] = token; save(ME_KEY, me);
    submit(dishForm, msg, {
      action: 'dish', guestId: me.guestId, id: id, token: token, name: name, dish: dish,
      course: f.course.value, website: f.website.value
    }, function () {
      f.dish.value = '';
      picked = null; dishForm.hidden = true;
      justAdded = id; render(); justAdded = null;
      say($('tableMsg'), dish + ' is on the table. Thank you!', false);
      var li = document.querySelector('.plate[data-id="' + id + '"]');
      if (li) {
        li.tabIndex = -1; li.focus({ preventScroll: true });
        li.scrollIntoView({ behavior: scrollMode(), block: 'center' });
      }
    }, function () { delete me.dishes[id]; save(ME_KEY, me); });
  });

  function removeDish(d, btn) {
    btn.disabled = true; btn.textContent = 'Taking it back…';
    api.post({ action: 'removeDish', id: d.id, token: me.dishes[d.id] }).then(function (res) {
      delete me.dishes[d.id]; save(ME_KEY, me);
      state = res; render();
      say($('tableMsg'), d.dish + ' is off the table.', false);
    }).catch(function (e) {
      btn.disabled = false; btn.textContent = 'Take it back';
      say($('tableMsg'), e.message, true);
    });
  }

  function submit(form, msg, body, done, failed) {
    var btn = form.querySelector('button[type=submit]'), label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Saving…'; say(msg, '');
    api.post(body).then(function (res) {
      state = res; done(); wantArt();
    }).catch(function (e) {
      if (failed) failed();
      say(msg, e.message || 'That didn’t save. Check your connection and try again.', true);
    }).then(function () { btn.disabled = false; btn.textContent = label; });
  }

  function say(msg, text, isErr, focus) {
    msg.textContent = text; msg.className = msg.className.replace(/\s*\b(err|ok)\b/g, '') + (text ? (isErr ? ' err' : ' ok') : '');
    if (focus) focus.focus();
  }

  function remember(name) {
    me.name = name; save(ME_KEY, me);
    [rsvpForm, dishForm].forEach(function (f) { if (!f.elements.name.value.trim()) f.elements.name.value = name; });
  }

  // ---------- calendar ----------
  $('calBtn').addEventListener('click', function () {
    var stamp = function (s) { return s.replace(/[-:]/g, '').slice(0, 15); };   // floating local time
    var year = C.start.slice(0, 4);
    var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//friendsgiving//EN', 'BEGIN:VEVENT',
      'UID:friendsgiving-' + year + '@casland.github.io',
      'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
      'DTSTART:' + stamp(C.start), 'DTEND:' + stamp(C.end),
      'SUMMARY:' + C.title + ' at ' + C.place,
      'LOCATION:' + C.place.charAt(0).toUpperCase() + C.place.slice(1),
      'DESCRIPTION:RSVP and dishes: ' + location.origin + location.pathname,
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    a.download = 'friendsgiving-' + year + '.ics';
    a.click();
  });

  picsReady.then(refresh);
  setInterval(function () { if (!document.hidden) refresh(); }, 45000);
})();
