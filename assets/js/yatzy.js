// Yatzy score sheet (layouts/yatzy.html), Scandinavian rules.
// Players are columns; tapping a box opens a picker with only the scores that
// box can legally hold. Sum, bonus and total are derived, never stored.
// The game is kept in localStorage, so a reload mid-game loses nothing.
(function () {
  var root = document.querySelector('.yz');
  if (!root) return;
  var scroller = root.querySelector('.yz-scroll');
  var table = root.querySelector('.yz-sheet');
  var status = root.querySelector('.yz-status');
  var undoBtn = root.querySelector('[data-act="undo"]');
  var addBtn = root.querySelector('[data-act="add"]');

  var KEY = 'yatzy-sheet', MAX_PLAYERS = 8, BONUS_AT = 63, BONUS = 50;

  // ---------- Categories and the scores each can hold ----------
  function range(a, b, step) { var r = []; for (var x = a; x <= b; x += step) r.push(x); return r; }
  // f(a, b) over every pair of different faces, deduplicated and sorted.
  function twoFaces(f) {
    var r = [];
    for (var a = 1; a <= 6; a++) for (var b = 1; b <= 6; b++) if (a !== b && r.indexOf(f(a, b)) < 0) r.push(f(a, b));
    return r.sort(function (x, y) { return x - y; });
  }

  var upper = ['Ones', 'Twos', 'Threes', 'Fours', 'Fives', 'Sixes'].map(function (name, i) {
    var k = i + 1;
    return { id: 'n' + k, name: name, hint: 'sum of the ' + k + 's', values: range(0, 5 * k, k) };
  });
  var lower = [
    { id: 'pair', name: 'One pair', hint: 'two alike', values: range(0, 12, 2) },
    { id: 'twopair', name: 'Two pairs', hint: 'two different pairs', values: [0].concat(twoFaces(function (a, b) { return 2 * a + 2 * b; })) },
    { id: 'three', name: 'Three of a kind', hint: 'three alike', values: range(0, 18, 3) },
    { id: 'four', name: 'Four of a kind', hint: 'four alike', values: range(0, 24, 4) },
    { id: 'small', name: 'Small straight', hint: '1-2-3-4-5', values: [0, 15] },
    { id: 'large', name: 'Large straight', hint: '2-3-4-5-6', values: [0, 20] },
    { id: 'house', name: 'Full house', hint: 'three alike and a pair', values: [0].concat(twoFaces(function (a, b) { return 3 * a + 2 * b; })) },
    { id: 'chance', name: 'Chance', hint: 'any five dice', values: range(5, 30, 1) },
    { id: 'yatzy', name: 'Yatzy', hint: 'five alike', values: [0, 50] }
  ];
  var cats = upper.concat(lower), byId = {};
  cats.forEach(function (c) { byId[c.id] = c; });

  // ---------- State ----------
  function fresh(names) { return { players: names.map(function (n) { return { name: n, scores: {} }; }) }; }
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.players && s.players.length) return s;
    } catch (e) {}
    return null;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  var state = load() || fresh(['Player 1', 'Player 2']);
  var history = [];   // snapshots for Undo, this visit only

  function commit(change) {
    history.push(JSON.stringify(state));
    if (history.length > 100) history.shift();
    change();
    save();
    render();
  }
  function undo() {
    if (!history.length) return;
    var prev = JSON.parse(history.pop());
    // Renames aren't steps of their own; keep the current names.
    if (prev.players.length === state.players.length) {
      prev.players.forEach(function (p, i) { p.name = state.players[i].name; });
    }
    state = prev;
    save();
    render();
  }

  function totals(p) {
    var s = p.scores, sum = 0, par = 0, upperDone = true, filled = 0, total;
    upper.forEach(function (c, i) {
      if (c.id in s) { sum += s[c.id]; par += s[c.id] - 3 * (i + 1); } else upperDone = false;
    });
    var bonus = sum >= BONUS_AT ? BONUS : upperDone ? 0 : null;
    total = sum + (bonus || 0);
    lower.forEach(function (c) { if (c.id in s) total += s[c.id]; });
    cats.forEach(function (c) { if (c.id in s) filled++; });
    return { sum: sum, par: par, bonus: bonus, total: total, filled: filled };
  }

  // ---------- Drawing ----------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function nameOf(i) { return state.players[i].name.trim() || 'Player ' + (i + 1); }

  function scoreRow(c) {
    var r = '<tr><th scope="row" class="yz-cat" title="' + c.hint + '">' + c.name + '</th>';
    state.players.forEach(function (p, i) {
      var has = c.id in p.scores, v = p.scores[c.id];
      r += '<td><button type="button" class="yz-cell' + (has && v === 0 ? ' is-zero' : '') + '"' +
        ' data-p="' + i + '" data-c="' + c.id + '"' +
        ' aria-label="' + c.name + ', ' + esc(nameOf(i)) + ': ' + (has ? v : 'empty') + '">' +
        (has ? v : '') + '</button></td>';
    });
    return r + '</tr>';
  }

  function calcRow(label, cls, cells) {
    return '<tr class="' + cls + '"><th scope="row" class="yz-cat">' + label + '</th>' +
      cells.map(function (c) { return '<td' + (c.cls ? ' class="' + c.cls + '"' : '') + (c.title ? ' title="' + c.title + '"' : '') + '>' + c.text + '</td>'; }).join('') +
      '</tr>';
  }

  // Bonus box: 50 once reached, 0 once out of reach, otherwise how far the
  // top half is above or below three of each (which lands exactly on 63).
  function bonusCell(t, p) {
    if (t.bonus !== null) return { text: t.bonus, cls: t.bonus ? 'is-bonus' : 'is-zero' };
    if (!upper.some(function (c) { return c.id in p.scores; })) return { text: '' };
    return {
      text: t.par > 0 ? '+' + t.par : t.par < 0 ? '−' + -t.par : '±0',
      cls: 'yz-par', title: 'Against three of each, which makes ' + BONUS_AT
    };
  }

  function render() {
    closePicker(false);
    var n = state.players.length, t = state.players.map(totals);
    var done = t.every(function (x) { return x.filled === cats.length; });
    var started = t.some(function (x) { return x.filled; });
    var best = Math.max.apply(null, t.map(function (x) { return x.total; }));
    // Next to play: whoever has filled the fewest boxes, first in order on a tie.
    var turn = done || n < 2 ? -1 : t.reduce(function (m, x, i) { return x.filled < t[m].filled ? i : m; }, 0);

    var h = '<thead><tr><th scope="col" class="yz-cat"><span class="yz-sr">Category</span></th>';
    state.players.forEach(function (p, i) {
      h += '<th scope="col" class="yz-player' + (i === turn ? ' is-turn' : '') + '">' +
        '<input class="yz-name" data-p="' + i + '" value="' + esc(p.name) + '" maxlength="14" spellcheck="false" autocomplete="off"' +
        ' aria-label="Name of player ' + (i + 1) + '">' +
        (n > 1 ? '<button type="button" class="yz-remove" data-p="' + i + '" title="Remove player" aria-label="Remove ' + esc(nameOf(i)) + '">×</button>' : '') +
        '</th>';
    });
    h += '</tr></thead><tbody>';
    upper.forEach(function (c) { h += scoreRow(c); });
    h += calcRow('Sum', 'yz-calc yz-sum', t.map(function (x) { return { text: x.sum }; }));
    h += calcRow('Bonus', 'yz-calc', t.map(function (x, i) { return bonusCell(x, state.players[i]); }));
    h += '</tbody><tbody>';
    lower.forEach(function (c) { h += scoreRow(c); });
    h += '</tbody><tfoot>';
    h += calcRow('Total', 'yz-total', t.map(function (x) {
      return { text: x.total, cls: started && n > 1 && x.total === best ? 'is-best' : '' };
    }));
    h += '</tfoot>';
    table.innerHTML = h;

    markWide();
    undoBtn.disabled = !history.length;
    addBtn.disabled = n >= MAX_PLAYERS;
    renderStatus();
  }

  function markWide() { scroller.classList.toggle('is-wide', scroller.scrollWidth > scroller.clientWidth); }

  function renderStatus() {
    var t = state.players.map(totals);
    var done = t.every(function (x) { return x.filled === cats.length; });
    var best = Math.max.apply(null, t.map(function (x) { return x.total; }));
    var top = [];
    t.forEach(function (x, i) { if (x.total === best) top.push(nameOf(i)); });
    var text = '';
    if (done && t.length === 1) text = 'Done: ' + best + ' points.';
    else if (done && top.length === 1) text = top[0] + ' wins with ' + best + '.';
    else if (done) text = top.join(' and ') + ' tie on ' + best + '.';
    else if (t.length > 1 && t.some(function (x) { return x.filled; })) {
      var turn = t.reduce(function (m, x, i) { return x.filled < t[m].filled ? i : m; }, 0);
      text = 'Next up: ' + nameOf(turn) + '.';
    }
    status.textContent = text;
  }

  // ---------- Score picker ----------
  var picker = document.createElement('div');
  picker.className = 'yz-picker';
  picker.setAttribute('role', 'dialog');
  picker.hidden = true;
  document.body.appendChild(picker);
  var open = null;   // { p, c, anchor }
  var sheetMQ = window.matchMedia('(max-width: 600px)');

  function openPicker(btn) {
    var c = byId[btn.dataset.c], pi = +btn.dataset.p, s = state.players[pi].scores, has = c.id in s;
    picker.innerHTML =
      '<div class="yz-pk-head"><strong>' + c.name + '</strong><span>' + esc(nameOf(pi)) + ' · ' + c.hint + '</span></div>' +
      '<div class="yz-pk-vals">' + c.values.map(function (v) {
        return '<button type="button" data-v="' + v + '"' + (has && s[c.id] === v ? ' aria-pressed="true"' : '') + '>' + v + '</button>';
      }).join('') + '</div>' +
      (has ? '<button type="button" class="yz-pk-clear" data-v="">Clear box</button>' : '');
    picker.setAttribute('aria-label', c.name + ' for ' + nameOf(pi));
    picker.hidden = false;
    open = { p: pi, c: c.id, anchor: btn };
    btn.classList.add('is-open');
    place();
    (picker.querySelector('[aria-pressed="true"]') || picker.querySelector('[data-v]')).focus({ preventScroll: true });
  }

  function closePicker(refocus) {
    if (!open) return;
    var o = open;
    open = null;
    picker.hidden = true;
    o.anchor.classList.remove('is-open');
    if (refocus) focusCell(o.p, o.c);
  }

  function focusCell(p, c) {
    var b = table.querySelector('.yz-cell[data-p="' + p + '"][data-c="' + c + '"]');
    if (b) b.focus({ preventScroll: true });
  }

  // Under the box on wide screens (above it if there's no room); a sheet
  // along the bottom edge on phones.
  function place() {
    if (!open) return;
    picker.classList.toggle('is-sheet', sheetMQ.matches);
    if (sheetMQ.matches) { picker.style.left = picker.style.top = ''; return; }
    var r = open.anchor.getBoundingClientRect(), w = picker.offsetWidth, h = picker.offsetHeight;
    var left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
    var top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
    picker.style.left = left + 'px';
    picker.style.top = top + 'px';
  }

  picker.addEventListener('click', function (e) {
    var b = e.target.closest('[data-v]');
    if (!b || !open) return;
    var p = open.p, c = open.c, v = b.dataset.v;
    commit(function () {
      if (v === '') delete state.players[p].scores[c];
      else state.players[p].scores[c] = +v;
    });
    focusCell(p, c);
  });

  picker.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.preventDefault(); closePicker(true); }
  });

  picker.addEventListener('focusout', function (e) {
    if (open && !picker.contains(e.relatedTarget) && e.relatedTarget !== open.anchor) closePicker(false);
  });

  document.addEventListener('pointerdown', function (e) {
    if (open && !picker.contains(e.target) && !e.target.closest('.yz-cell')) closePicker(false);
  });
  window.addEventListener('resize', function () { markWide(); place(); });
  window.addEventListener('scroll', place, { passive: true });
  scroller.addEventListener('scroll', place, { passive: true });

  // ---------- Sheet interactions ----------
  root.addEventListener('click', function (e) {
    var cell = e.target.closest('.yz-cell');
    if (cell) {
      var same = open && open.anchor === cell;
      closePicker(false);
      if (!same) openPicker(cell);
      return;
    }
    var rm = e.target.closest('.yz-remove');
    if (rm) {
      commit(function () { state.players.splice(+rm.dataset.p, 1); });
      return;
    }
    var act = e.target.closest('[data-act]');
    if (!act) return;
    if (act.dataset.act === 'add' && state.players.length < MAX_PLAYERS) {
      commit(function () { state.players.push({ name: 'Player ' + (state.players.length + 1), scores: {} }); });
      var names = table.querySelectorAll('.yz-name');
      names[names.length - 1].select();
    } else if (act.dataset.act === 'undo') {
      undo();
    } else if (act.dataset.act === 'new') {
      // Undo brings the old sheet back, so no confirmation.
      commit(function () { state.players.forEach(function (p) { p.scores = {}; }); });
    }
  });

  root.addEventListener('input', function (e) {
    if (!e.target.classList.contains('yz-name')) return;
    state.players[+e.target.dataset.p].name = e.target.value;
    save();
    renderStatus();
  });

  // Enter in a name field moves on to the next one.
  root.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || !e.target.classList.contains('yz-name')) return;
    e.preventDefault();
    var next = table.querySelector('.yz-name[data-p="' + (+e.target.dataset.p + 1) + '"]');
    if (next) next.select(); else e.target.blur();
  });

  render();
})();
