/* ------------------------------------------------------------------
   OLD TOM — demo συστήματος παραγγελιών

   Είναι ΠΑΡΟΥΣΙΑΣΗ, όχι πραγματικό σύστημα:
   όλα τα δεδομένα μένουν στο localStorage του browser, δεν υπάρχει server.
   Σε πραγματική υλοποίηση, οι έλεγχοι και οι τιμές ζουν στον server —
   ποτέ σε JavaScript που μπορεί ο καθένας να διαβάσει και να αλλάξει.
------------------------------------------------------------------- */
'use strict';

/* ---------- αρχικά δεδομένα (εικονικά) ---------- */
const SEED_STOCK = [
  { name: 'Aperol 700ml',                    stock: 9,  price: 15.00, vat: 24 },
  { name: 'Johnnie Walker Red Label 700ml',  stock: 15, price: 10.00, vat: 24 },
  { name: 'Coca-Cola 250ml',                 stock: 50, price: 0.80,  vat: 13 },
  { name: 'Bombay Sapphire Gin 700ml',       stock: 6,  price: 12.00, vat: 24 },
  { name: 'Martini Bianco 1L',               stock: 4,  price: 9.00,  vat: 24 }
];

const USERS = {
  client: { pass: 'client123', role: 'client', label: 'PKK Jazz Burger Bar' },
  boss:   { pass: 'boss123',   role: 'boss',   label: 'OLD TOM — Κάβα' }
};

const KEY = 'oldtom-demo-v1';

/* ---------- state ---------- */
let state = load();
let cart = [];   // [{name, qty}] — ζει μόνο όσο γράφεις την παραγγελία

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ο browser μπορεί να μπλοκάρει το localStorage */ }
  return fresh();
}

function fresh() {
  return {
    session: null,
    orders: [],
    nextId: 1,
    stock: SEED_STOCK.map(p => ({ ...p }))
  };
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
}

/* ---------- helpers ---------- */
const $ = sel => document.querySelector(sel);

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function eur(n) {
  return n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function product(name) {
  return state.stock.find(p => p.name === name);
}

/* Σύνολα γραμμής. Πολλαπλασιάζουμε ΠΡΩΤΑ, στρογγυλοποιούμε ΜΕΤΑ — αλλιώς
   τα σύνολα των γραμμών δεν συμφωνούν με το τελικό σύνολο. */
function lineTotals(price, vatRate, qty) {
  const net = Math.round(price * qty * 100) / 100;
  const vat = Math.round(net * vatRate) / 100;
  return { net, vat, gross: Math.round((net + vat) * 100) / 100 };
}

function orderTotals(items) {
  let net = 0, vat = 0;
  items.forEach(it => {
    const p = product(it.name);
    if (!p) return;
    const t = lineTotals(p.price, p.vat, it.qty);
    net += t.net; vat += t.vat;
  });
  net = Math.round(net * 100) / 100;
  vat = Math.round(vat * 100) / 100;
  return { net, vat, gross: Math.round((net + vat) * 100) / 100 };
}

const STATUS = { pending: 'Σε αναμονή', approved: 'Εγκρίθηκε', rejected: 'Απορρίφθηκε' };

/* ---------- modal ---------- */
function openModal(title, bodyHtml, actions) {
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = bodyHtml;
  const box = $('#modal-actions');
  box.innerHTML = '';
  actions.forEach(a => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = a.primary ? 'gold-btn' : 'ghost-btn';
    b.textContent = a.label;
    if (a.id) b.id = a.id;
    if (a.disabled) b.disabled = true;
    b.addEventListener('click', a.onClick);
    box.appendChild(b);
  });
  $('#modal').hidden = false;
}

function closeModal() { $('#modal').hidden = true; }

/* ---------- views ---------- */
function render() {
  const s = state.session;
  $('#view-login').hidden  = !!s;
  $('#view-client').hidden = !(s && s.role === 'client');
  $('#view-boss').hidden   = !(s && s.role === 'boss');

  $('#btn-logout').hidden = !s;
  const who = $('#who');
  who.hidden = !s;
  if (s) who.innerHTML = 'Συνδεδεμένος: <b>' + esc(s.label) + '</b>';

  if (s && s.role === 'client') renderClient();
  if (s && s.role === 'boss') renderBoss();
}

/* ============ CLIENT ============ */
function renderClient() {
  renderProducts();
  renderCart();
  renderClientOrders();
}

/* Ο τιμοκατάλογος: ο πελάτης βλέπει τα προϊόντα και βάζει ποσότητα
   δίπλα σε αυτό που θέλει, αντί να το γράφει με το χέρι. */
function renderProducts() {
  const rows = state.stock.map((p, i) => {
    const inCart = cart.find(c => c.name === p.name);
    return '<tr>' +
      '<td><strong>' + esc(p.name) + '</strong>' +
      (inCart ? '<span class="sub-note">στο καλάθι: ' + inCart.qty + ' τεμ.</span>' : '') +
      '</td>' +
      '<td class="num">' + eur(p.price) + '</td>' +
      '<td class="num muted">' + p.vat + '%</td>' +
      '<td class="num"><b>' + eur(Math.round(p.price * (1 + p.vat / 100) * 100) / 100) + '</b></td>' +
      '<td class="add-cell">' +
      '<input type="number" value="1" min="1" max="999" data-qty="' + i + '" ' +
      'aria-label="Τεμάχια για ' + esc(p.name) + '">' +
      '<button type="button" class="add-btn" data-add="' + i + '">Προσθήκη</button>' +
      '</td></tr>';
  }).join('');

  $('#products-table').innerHTML =
    '<div class="tbl-wrap"><table class="data"><thead><tr>' +
    '<th>Προϊόν</th><th class="num">Καθαρή</th><th class="num">ΦΠΑ</th>' +
    '<th class="num">Τιμή με ΦΠΑ</th><th>Ποσότητα</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table></div>';

  $('#products-table').querySelectorAll('[data-add]').forEach(b => {
    b.addEventListener('click', () => {
      const i = Number(b.dataset.add);
      const input = $('#products-table').querySelector('[data-qty="' + i + '"]');
      addToCart(state.stock[i].name, parseInt(input.value, 10));
      input.value = 1;
    });
  });

  // Enter μέσα στο πεδίο ποσότητας προσθέτει κατευθείαν.
  $('#products-table').querySelectorAll('[data-qty]').forEach(inp => {
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        $('#products-table').querySelector('[data-add="' + inp.dataset.qty + '"]').click();
      }
    });
  });
}

function renderCart() {
  const wrap = $('#cart-wrap');

  if (!cart.length) {
    wrap.innerHTML = '<p class="empty">Δεν έχετε προσθέσει προϊόντα ακόμα.</p>';
    $('#btn-submit').disabled = true;
    return;
  }
  $('#btn-submit').disabled = false;

  const rows = cart.map((it, i) => {
    const p = product(it.name);
    const t = lineTotals(p.price, p.vat, it.qty);
    return '<tr>' +
      '<td>' + esc(it.name) + '</td>' +
      '<td><input type="number" value="' + it.qty + '" min="1" max="999" ' +
      'data-cqty="' + i + '" aria-label="Τεμάχια για ' + esc(it.name) + '"></td>' +
      '<td class="num">' + eur(p.price) + '</td>' +
      '<td class="num muted">' + p.vat + '%</td>' +
      '<td class="num"><b>' + eur(t.gross) + '</b></td>' +
      '<td><button type="button" class="x-btn" data-del="' + i + '">αφαίρεση</button></td>' +
      '</tr>';
  }).join('');

  const t = orderTotals(cart);
  wrap.innerHTML =
    '<div class="tbl-wrap"><table class="data"><thead><tr>' +
    '<th>Προϊόν</th><th>Τεμάχια</th><th class="num">Τιμή</th>' +
    '<th class="num">ΦΠΑ</th><th class="num">Σύνολο</th><th></th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '<div class="totals-row"><span>Καθαρή ' + eur(t.net) + '</span>' +
    '<span>ΦΠΑ ' + eur(t.vat) + '</span><b>Σύνολο ' + eur(t.gross) + '</b></div>';

  wrap.querySelectorAll('[data-del]').forEach(b => {
    b.addEventListener('click', () => {
      cart.splice(Number(b.dataset.del), 1);
      renderProducts();
      renderCart();
    });
  });

  // Αλλαγή ποσότητας μέσα στο καλάθι.
  wrap.querySelectorAll('[data-cqty]').forEach(inp => {
    inp.addEventListener('change', () => {
      const i = Number(inp.dataset.cqty);
      const q = parseInt(inp.value, 10);
      if (!Number.isFinite(q) || q < 1) cart.splice(i, 1);
      else cart[i].qty = Math.min(999, q);
      renderProducts();
      renderCart();
    });
  });
}

function renderClientOrders() {
  const mine = state.orders.filter(o => o.user === 'client');
  const box = $('#client-orders');

  if (!mine.length) {
    box.innerHTML = '<p class="empty">Δεν έχετε στείλει παραγγελία ακόμα.</p>';
    return;
  }

  box.innerHTML = mine.slice().reverse().map(o => {
    const t = orderTotals(o.items);
    const items = o.items.map(it =>
      '<li><span>' + esc(it.name) + '</span><b>' + it.qty + ' τεμ.</b></li>').join('');

    let changes = '';
    if (o.log && o.log.length) {
      changes = '<div class="changelog"><b>Προσαρμογές από την κάβα</b>' +
        o.log.map(l => '· ' + esc(l)).join('<br>') + '</div>';
    }

    return '<div class="ocard ' + o.status + '">' +
      '<div class="ocard-head"><div class="ocard-who">' +
      '<strong>Παραγγελία #' + o.id + '</strong>' +
      '<span>' + esc(o.date) + '</span></div>' +
      '<span class="badge ' + o.status + '">' + STATUS[o.status] + '</span></div>' +
      '<ul>' + items + '</ul>' +
      '<div class="totals-row"><span>Καθαρή ' + eur(t.net) + '</span>' +
      '<span>ΦΠΑ ' + eur(t.vat) + '</span><b>' + eur(t.gross) + '</b></div>' +
      (o.notes ? '<p class="notes-line">Σημείωση: ' + esc(o.notes) + '</p>' : '') +
      changes +
      '</div>';
  }).join('');
}

/* προσθήκη στο καλάθι */
function addToCart(name, qty) {
  const msg = $('#pick-msg');
  const p = product(name);

  if (!p) {
    msg.className = 'msg err';
    msg.textContent = 'Το προϊόν δεν βρέθηκε.';
    return;
  }
  if (!Number.isFinite(qty) || qty < 1) {
    msg.className = 'msg err';
    msg.textContent = 'Δώστε ποσότητα τουλάχιστον 1.';
    return;
  }

  const existing = cart.find(c => c.name === name);
  if (existing) existing.qty = Math.min(999, existing.qty + qty);
  else cart.push({ name, qty: Math.min(999, qty) });

  msg.className = 'msg ok';
  msg.textContent = 'Προστέθηκε: ' + name + ' × ' + qty;
  renderProducts();
  renderCart();
}

/* υποβολή — δείχνει πρώτα σύνοψη προς επιβεβαίωση */
function submitOrder() {
  if (!cart.length) return;

  const name = $('#f-name').value.trim();
  if (!name) {
    const m = $('#pick-msg');
    m.className = 'msg err';
    m.textContent = 'Συμπληρώστε την επωνυμία της επιχείρησης.';
    return;
  }

  const t = orderTotals(cart);
  const list = cart.map(it =>
    '<li><span>' + esc(it.name) + '</span><b>' + it.qty + ' τεμ.</b></li>').join('');

  openModal(
    'Ελέγξτε την παραγγελία σας',
    '<ul class="review-list">' + list + '</ul>' +
    '<div class="totals-row"><span>Καθαρή ' + eur(t.net) + '</span>' +
    '<span>ΦΠΑ ' + eur(t.vat) + '</span><b>Σύνολο ' + eur(t.gross) + '</b></div>' +
    '<p class="fineprint">Μετά την αποστολή δεν μπορείτε να την αλλάξετε.</p>' +
    '<label class="agree-box"><input type="checkbox" id="agree">' +
    '<span>Έλεγξα τα προϊόντα και τις ποσότητες και η παραγγελία είναι σωστή.</span></label>',
    [
      { label: 'Πίσω για αλλαγές', onClick: closeModal },
      { label: 'Αποστολή παραγγελίας', primary: true, id: 'btn-final', disabled: true, onClick: finalizeOrder }
    ]
  );

  // Το κουμπί ξεκλειδώνει μόνο όταν μπει το τικ.
  const agree = $('#agree');
  const finalBtn = $('#btn-final');
  agree.addEventListener('change', () => { finalBtn.disabled = !agree.checked; });
}

function finalizeOrder() {
  state.orders.push({
    id: state.nextId++,
    user: 'client',
    client: $('#f-name').value.trim(),
    phone: $('#f-phone').value.trim(),
    email: $('#f-email').value.trim(),
    notes: $('#f-notes').value.trim(),
    items: cart.map(it => ({ ...it })),
    status: 'pending',
    log: [],
    date: new Date().toLocaleString('el-GR')
  });
  cart = [];
  save();
  closeModal();
  render();

  openModal('Η παραγγελία στάλθηκε',
    '<p style="font-size:13px;line-height:1.8;color:var(--text-muted)">' +
    'Η κάβα θα την ελέγξει και θα τη δείτε ως «Εγκρίθηκε» ή «Απορρίφθηκε» στο ιστορικό σας.</p>',
    [{ label: 'Εντάξει', primary: true, onClick: closeModal }]);
}

/* ============ BOSS ============ */
function renderBoss() {
  const pending = state.orders.filter(o => o.status === 'pending').length;

  $('#boss-stats').innerHTML =
    '<div class="stat"><b>' + pending + '</b><span>Σε αναμονή</span></div>' +
    '<div class="stat"><b>' + state.orders.length + '</b><span>Σύνολο παραγγελιών</span></div>' +
    '<div class="stat"><b>' + state.stock.length + '</b><span>Προϊόντα</span></div>';

  renderBossOrders();
  renderStock();
}

function renderBossOrders() {
  const box = $('#boss-orders');

  if (!state.orders.length) {
    box.innerHTML = '<p class="empty">Καμία παραγγελία. Συνδεθείτε ως πελάτης για να στείλετε μία.</p>';
    return;
  }

  box.innerHTML = state.orders.slice().reverse().map(o => {
    const t = orderTotals(o.items);

    const items = o.items.map(it => {
      const p = product(it.name);
      const short = p && it.qty > p.stock && o.status === 'pending';
      return '<li><span>' + esc(it.name) +
        (short ? ' <span class="low">(απόθεμα: ' + p.stock + ')</span>' : '') +
        '</span><b>' + it.qty + ' τεμ.</b></li>';
    }).join('');

    const actions = '<div class="ocard-actions">' +
      (o.status === 'pending'
        ? '<button type="button" class="gold-btn" data-approve="' + o.id + '">Αποδοχή</button>' +
          '<button type="button" class="ghost-btn" data-edit="' + o.id + '">Επεξεργασία</button>' +
          '<button type="button" class="ghost-btn" data-reject="' + o.id + '">Απόρριψη</button>'
        : '') +
      '<button type="button" class="ghost-btn" data-print="' + o.id + '">Εκτύπωση</button>' +
      '</div>';

    let changes = '';
    if (o.log && o.log.length) {
      changes = '<div class="changelog"><b>Τι άλλαξε στην έγκριση</b>' +
        o.log.map(l => '· ' + esc(l)).join('<br>') + '</div>';
    }

    return '<div class="ocard ' + o.status + '">' +
      '<div class="ocard-head">' +
      '<div class="ocard-who"><strong>#' + o.id + ' — ' + esc(o.client) + '</strong>' +
      '<span>' + esc(o.date) + ' · ' + esc(o.phone || '—') + '</span></div>' +
      '<span class="badge ' + o.status + '">' + STATUS[o.status] + '</span>' +
      '</div>' +
      '<ul>' + items + '</ul>' +
      '<div class="totals-row"><span>Καθαρή ' + eur(t.net) + '</span>' +
      '<span>ΦΠΑ ' + eur(t.vat) + '</span><b>' + eur(t.gross) + '</b></div>' +
      (o.notes ? '<p class="notes-line">Σημείωση πελάτη: ' + esc(o.notes) + '</p>' : '') +
      changes + actions +
      '</div>';
  }).join('');

  box.querySelectorAll('[data-approve]').forEach(b =>
    b.addEventListener('click', () => tryApprove(Number(b.dataset.approve))));
  box.querySelectorAll('[data-reject]').forEach(b =>
    b.addEventListener('click', () => rejectOrder(Number(b.dataset.reject))));
  box.querySelectorAll('[data-edit]').forEach(b =>
    b.addEventListener('click', () => editOrder(Number(b.dataset.edit))));
  box.querySelectorAll('[data-print]').forEach(b =>
    b.addEventListener('click', () => printOrder(Number(b.dataset.print))));
}

/* ---- Επεξεργασία παραγγελίας από την κάβα ---- */
function editOrder(id) {
  const order = state.orders.find(o => o.id === id);
  if (!order || order.status !== 'pending') return;

  const rows = order.items.map((it, i) => {
    const p = product(it.name);
    return '<div class="edit-row">' +
      '<span class="edit-name">' + esc(it.name) +
      (p ? '<em>απόθεμα: ' + p.stock + '</em>' : '') + '</span>' +
      '<input type="number" value="' + it.qty + '" min="0" max="999" data-eq="' + i + '" ' +
      'aria-label="Τεμάχια για ' + esc(it.name) + '">' +
      '</div>';
  }).join('');

  openModal('Επεξεργασία παραγγελίας #' + order.id,
    '<p class="fineprint">Αλλάξτε τις ποσότητες όπως θέλετε. Βάλτε <b>0</b> για να αφαιρέσετε ένα προϊόν.</p>' +
    '<div class="edit-list">' + rows + '</div>',
    [
      { label: 'Άκυρο', onClick: closeModal },
      {
        label: 'Αποθήκευση', primary: true, onClick: () => {
          const log = [];
          // Από το τέλος προς την αρχή, ώστε οι δείκτες να μένουν σωστοί όταν αφαιρούμε.
          for (let i = order.items.length - 1; i >= 0; i--) {
            const inp = document.querySelector('[data-eq="' + i + '"]');
            const was = order.items[i].qty;
            let now = parseInt(inp.value, 10);
            if (!Number.isFinite(now) || now < 0) now = was;

            if (now === 0) {
              log.push(order.items[i].name + ': αφαιρέθηκε');
              order.items.splice(i, 1);
            } else if (now !== was) {
              log.push(order.items[i].name + ': από ' + was + ' σε ' + now + ' τεμ.');
              order.items[i].qty = now;
            }
          }

          if (!order.items.length) {
            order.status = 'rejected';
            log.push('Η παραγγελία απορρίφθηκε: δεν έμεινε προϊόν.');
          }
          // Οι νέες αλλαγές μπαίνουν πάνω από τις παλιές, χωρίς να τις σβήνουν.
          order.log = log.reverse().concat(order.log || []);
          save();
          closeModal();
          render();
        }
      }
    ]);
}

/* ---- Εκτύπωση φύλλου για την αποθήκη ---- */
function printOrder(id) {
  const o = state.orders.find(x => x.id === id);
  if (!o) return;

  const rows = o.items.map(it => {
    const p = product(it.name);
    const t = p ? lineTotals(p.price, p.vat, it.qty) : { gross: 0 };
    return '<tr><td>' + esc(it.name) + '</td>' +
      '<td class="num"><b>' + it.qty + '</b></td>' +
      '<td class="num">' + (p ? eur(p.price) : '—') + '</td>' +
      '<td class="num">' + eur(t.gross) + '</td></tr>';
  }).join('');

  const t = orderTotals(o.items);
  const totalUnits = o.items.reduce((s, it) => s + it.qty, 0);

  $('#print-area').innerHTML =
    '<div class="print-doc">' +
    '<h1>OLD TOM — Δελτίο Παραγγελίας</h1>' +
    '<table class="print-meta">' +
    '<tr><th>Παραγγελία</th><td>#' + o.id + '</td>' +
    '<th>Ημερομηνία</th><td>' + esc(o.date) + '</td></tr>' +
    '<tr><th>Πελάτης</th><td>' + esc(o.client) + '</td>' +
    '<th>Τηλέφωνο</th><td>' + esc(o.phone || '—') + '</td></tr>' +
    '<tr><th>Κατάσταση</th><td>' + STATUS[o.status] + '</td>' +
    '<th>Σύνολο τεμαχίων</th><td>' + totalUnits + '</td></tr>' +
    '</table>' +
    '<table class="print-items"><thead><tr>' +
    '<th>Προϊόν</th><th class="num">Τεμάχια</th><th class="num">Τιμή/τεμ.</th><th class="num">Σύνολο</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table>' +
    '<table class="print-totals">' +
    '<tr><th>Καθαρή αξία</th><td>' + eur(t.net) + '</td></tr>' +
    '<tr><th>ΦΠΑ</th><td>' + eur(t.vat) + '</td></tr>' +
    '<tr class="grand"><th>Σύνολο</th><td>' + eur(t.gross) + '</td></tr>' +
    '</table>' +
    (o.notes ? '<p class="print-notes"><b>Σημειώσεις:</b> ' + esc(o.notes) + '</p>' : '') +
    '</div>';

  document.body.classList.add('printing');
  window.print();
  // Καθάρισμα μετά, ώστε να μην μείνει κρυφό περιεχόμενο στη σελίδα.
  setTimeout(() => {
    document.body.classList.remove('printing');
    $('#print-area').innerHTML = '';
  }, 300);
}

function renderStock() {
  const rows = state.stock.map(p =>
    '<tr><td>' + esc(p.name) + '</td>' +
    '<td class="num ' + (p.stock <= 5 ? 'low' : '') + '">' + p.stock + '</td>' +
    '<td class="num">' + eur(p.price) + '</td>' +
    '<td class="num muted">' + p.vat + '%</td></tr>').join('');

  $('#stock-table').innerHTML =
    '<div class="tbl-wrap"><table class="data"><thead><tr>' +
    '<th>Προϊόν</th><th class="num">Διαθέσιμα</th><th class="num">Τιμή</th><th class="num">ΦΠΑ</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '<p class="fineprint">Το απόθεμα μειώνεται αυτόματα κάθε φορά που εγκρίνετε παραγγελία.</p>';
}

/* ---- ΤΟ ΒΑΣΙΚΟ: έλεγχος διαθεσιμότητας πριν την έγκριση ---- */
function tryApprove(id) {
  const order = state.orders.find(o => o.id === id);
  if (!order || order.status !== 'pending') return;

  // Ποια είδη δεν βγαίνουν από το απόθεμα;
  const shortages = order.items
    .map((it, idx) => {
      const p = product(it.name);
      return p && it.qty > p.stock
        ? { idx, name: it.name, want: it.qty, have: p.stock }
        : null;
    })
    .filter(Boolean);

  if (!shortages.length) {
    approve(order, []);
    return;
  }

  // Ένα μπλοκ ανά προβληματικό είδος, με επιλογή για το καθένα.
  const blocks = shortages.map(s =>
    '<div class="shortage">' +
    '<p>Το <b>' + esc(s.name) + '</b> ζητήθηκε σε <b>' + s.want +
    '</b> τεμάχια, αλλά διαθέτετε <b>' + s.have + '</b>.</p>' +
    '<div class="choices">' +
    '<label class="choice"><input type="radio" name="sh' + s.idx + '" value="reduce" checked>' +
    '<span>Προχώρα με τη διαθέσιμη ποσότητα (' + s.have + ' τεμ.)</span></label>' +
    '<label class="choice"><input type="radio" name="sh' + s.idx + '" value="custom">' +
    '<span>Άλλη ποσότητα: <input type="number" class="inline-qty" value="' + s.have +
    '" min="1" max="999" data-cq="' + s.idx + '" aria-label="Ποσότητα για ' + esc(s.name) + '"> τεμ.</span></label>' +
    '<label class="choice"><input type="radio" name="sh' + s.idx + '" value="drop">' +
    '<span>Αφαίρεσε το προϊόν από την παραγγελία</span></label>' +
    '</div></div>').join('');

  openModal(
    'Δεν επαρκεί το απόθεμα',
    blocks + '<p class="fineprint">Η υπόλοιπη παραγγελία εγκρίνεται κανονικά. ' +
    'Ο πελάτης βλέπει τι άλλαξε στο ιστορικό του.</p>',
    [
      { label: 'Άκυρο', onClick: closeModal },
      {
        label: 'Έγκριση με αυτές τις αλλαγές', primary: true, onClick: () => {
          const decisions = shortages.map(s => {
            const choice = document.querySelector('input[name="sh' + s.idx + '"]:checked').value;
            let qty = s.have;
            if (choice === 'custom') {
              const v = parseInt(document.querySelector('[data-cq="' + s.idx + '"]').value, 10);
              if (Number.isFinite(v) && v > 0) qty = Math.min(999, v);
            }
            return { ...s, choice: choice === 'drop' ? 'drop' : 'reduce', have: qty };
          });
          closeModal();
          approve(order, decisions);
        }
      }
    ]
  );
}

function approve(order, decisions) {
  const log = [];

  // Εφαρμόζουμε τις αποφάσεις. Πάμε από το τέλος προς την αρχή ώστε οι
  // δείκτες (idx) να μένουν σωστοί όταν αφαιρούμε γραμμές.
  decisions
    .slice()
    .sort((a, b) => b.idx - a.idx)
    .forEach(d => {
      if (d.choice === 'reduce') {
        order.items[d.idx].qty = d.have;
        if (d.have !== d.want) {
          log.push(d.name + ': από ' + d.want + ' σε ' + d.have + ' τεμ. (έλλειψη αποθέματος)');
        }
      } else {
        order.items.splice(d.idx, 1);
        log.push(d.name + ': αφαιρέθηκε (δεν υπήρχε επαρκές απόθεμα)');
      }
    });

  // Αν δεν έμεινε τίποτα, δεν έχει νόημα «εγκεκριμένη» άδεια παραγγελία.
  if (!order.items.length) {
    order.status = 'rejected';
    // Κρατάμε ό,τι είχε καταγραφεί από προηγούμενη επεξεργασία.
    order.log = log
      .concat('Η παραγγελία απορρίφθηκε: δεν έμεινε διαθέσιμο προϊόν.')
      .concat(order.log || []);
    save();
    render();
    openModal('Η παραγγελία απορρίφθηκε',
      '<p style="font-size:13px;color:var(--text-muted)">Αφαιρέθηκαν όλα τα είδη, οπότε δεν υπάρχει τι να ετοιμαστεί.</p>',
      [{ label: 'Εντάξει', primary: true, onClick: closeModal }]);
    return;
  }

  // Μείωση αποθέματος για ό,τι εγκρίθηκε.
  order.items.forEach(it => {
    const p = product(it.name);
    if (p) p.stock = Math.max(0, p.stock - it.qty);
  });

  order.status = 'approved';
  order.log = log.concat(order.log || []);
  save();
  render();

  const t = orderTotals(order.items);
  openModal('Η παραγγελία εγκρίθηκε',
    (log.length
      ? '<div class="changelog"><b>Προσαρμογές</b>' + log.map(l => '· ' + esc(l)).join('<br>') + '</div>'
      : '<p style="font-size:13px;color:var(--text-muted)">Όλα τα είδη ήταν διαθέσιμα.</p>') +
    '<div class="totals-row"><b>Σύνολο ' + eur(t.gross) + '</b></div>' +
    '<p class="fineprint">Το απόθεμα ενημερώθηκε.</p>',
    [{ label: 'Εντάξει', primary: true, onClick: closeModal }]);
}

function rejectOrder(id) {
  const order = state.orders.find(o => o.id === id);
  if (!order || order.status !== 'pending') return;

  openModal('Απόρριψη παραγγελίας',
    '<p style="font-size:13px;color:var(--text-muted)">Θέλετε να απορρίψετε την παραγγελία #' +
    order.id + ' από ' + esc(order.client) + ';</p>',
    [
      { label: 'Άκυρο', onClick: closeModal },
      {
        label: 'Απόρριψη', primary: true, onClick: () => {
          order.status = 'rejected';
          save();
          closeModal();
          render();
        }
      }
    ]);
}

/* ============ login / logout / reset ============ */
function tryLogin(e) {
  e.preventDefault();
  const u = $('#u').value.trim();
  const p = $('#p').value;
  const msg = $('#login-msg');

  const rec = USERS[u.toLowerCase()];
  // Ένα γενικό μήνυμα, χωρίς να λέμε αν λάθος ήταν ο χρήστης ή ο κωδικός.
  if (!rec || rec.pass !== p) {
    msg.className = 'msg err';
    msg.textContent = 'Λάθος στοιχεία σύνδεσης.';
    $('#p').value = '';
    return;
  }

  msg.textContent = '';
  msg.className = 'msg';
  $('#u').value = '';
  $('#p').value = '';

  state.session = { user: u.toLowerCase(), role: rec.role, label: rec.label };
  cart = [];
  save();
  render();
  window.scrollTo(0, 0);
}

function logout() {
  state.session = null;
  cart = [];
  save();
  render();
}

function resetDemo() {
  openModal('Καθαρισμός δεδομένων',
    '<p style="font-size:13px;color:var(--text-muted)">Θα σβηστούν όλες οι παραγγελίες και το απόθεμα θα επανέλθει στις αρχικές ποσότητες.</p>',
    [
      { label: 'Άκυρο', onClick: closeModal },
      {
        label: 'Επαναφορά', primary: true, onClick: () => {
          state = fresh();
          cart = [];
          save();
          closeModal();
          render();
        }
      }
    ]);
}

/* ============ wiring ============ */
$('#login-form').addEventListener('submit', tryLogin);
$('#btn-logout').addEventListener('click', logout);
$('#btn-reset').addEventListener('click', resetDemo);
$('#btn-submit').addEventListener('click', submitOrder);

document.querySelectorAll('.tab').forEach(t =>
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    $('#tab-orders').hidden = t.dataset.tab !== 'orders';
    $('#tab-stock').hidden  = t.dataset.tab !== 'stock';
  }));

// Κλείσιμο modal με Escape ή κλικ στο φόντο.
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

render();
