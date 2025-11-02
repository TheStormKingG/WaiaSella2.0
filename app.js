// WaiaSella POS - static SPA

const TAX_RATE = 0.0; // set to 0.07 for 7% tax if desired
const LOW_STOCK_THRESHOLD = 5;
const STORAGE_KEYS = {
  inventory: 'ws.inventory',
  transactions: 'ws.transactions',
  soldTally: 'ws.soldTally',
};

const seedItems = [
  { id: id(), name: 'Redbull', price: 2.5, cost: 1.2, stock: 15, category: 'Drinks', image: pic(1010) },
  { id: id(), name: 'Shampoo', price: 5.0, cost: 2.5, stock: 25, category: 'Personal Care', image: pic(1020) },
  { id: id(), name: 'Powder Milk', price: 8.75, cost: 5.2, stock: 8, category: 'Groceries', image: pic(1030) },
  { id: id(), name: 'Doritos', price: 1.25, cost: 0.6, stock: 50, category: 'Snacks', image: pic(1040) },
  { id: id(), name: 'Olive Oil', price: 12.0, cost: 8.5, stock: 12, category: 'Groceries', image: pic(1050) },
  { id: id(), name: 'Water Bottle', price: 1.0, cost: 0.2, stock: 100, category: 'Drinks', image: pic(1060) },
  { id: id(), name: 'Green Tea', price: 3.5, cost: 1.0, stock: 30, category: 'Drinks', image: pic(1070) },
  { id: id(), name: 'Apples', price: 0.75, cost: 0.2, stock: 40, category: 'Produce', image: pic(1080) },
];

// App State
let inventory = load(STORAGE_KEYS.inventory) || seed(seedItems);
let transactions = load(STORAGE_KEYS.transactions) || [];
let soldTally = load(STORAGE_KEYS.soldTally) || {}; // { itemId: qty }
let cart = {}; // { itemId: qty }
let activeCategory = 'All';

// Elements
const tabs = qsa('.tab');
const views = qsa('.view');
const headerTitle = qs('.app-header h1');

// Sales
const categoryChips = qs('#categoryChips');
const productGrid = qs('#productGrid');
const salesSearch = qs('#salesSearch');
const cartItemsEl = qs('#cartItems');
const cartTaxEl = qs('#cartTax');
const completeSaleBtn = qs('#completeSaleBtn');

// Inventory
const inventoryList = qs('#inventoryList');
const inventorySearch = qs('#inventorySearch');
const addItemFab = qs('#addItemFab');
const itemDialog = qs('#itemDialog');
const itemForm = qs('#itemForm');
const itemDialogTitle = qs('#itemDialogTitle');
const categoryList = qs('#categoryList');

// Reports
const totalSalesEl = qs('#totalSales');
const totalProfitEl = qs('#totalProfit');
const totalTransactionsEl = qs('#totalTransactions');
const lowStockCountEl = qs('#lowStockCount');
const topSellingEl = qs('#topSelling');

// Reorder
const reorderContainer = qs('#reorderContainer');

// Init
renderTabs();
renderCategoryChips();
renderProducts();
renderCart();
renderInventory();
renderReports();
renderReorder();
populateCategoryDatalist();

// Tab switching
tabs.forEach((t) =>
  t.addEventListener('click', () => {
    tabs.forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    const id = t.dataset.target;
    views.forEach((v) => v.classList.remove('active'));
    qs('#' + id).classList.add('active');
    headerTitle.textContent = t.textContent.trim();
    if (id === 'reportsView') renderReports();
    if (id === 'reorderView') renderReorder();
    if (id === 'inventoryView') renderInventory();
  })
);

// Sales interactions
salesSearch.addEventListener('input', renderProducts);
completeSaleBtn.addEventListener('click', completeSale);

// Inventory interactions
inventorySearch.addEventListener('input', renderInventory);
addItemFab.addEventListener('click', () => openItemDialog());
itemForm.addEventListener('submit', saveItemFromDialog);

// Functions
function renderTabs() {}

function renderCategoryChips() {
  const categories = ['All', ...unique(inventory.map((i) => i.category))];
  categoryChips.innerHTML = '';
  categories.forEach((c) => {
    const el = h('button', { class: 'chip' + (c === activeCategory ? ' active' : '') }, c);
    el.addEventListener('click', () => {
      activeCategory = c;
      qsa('.chip', categoryChips).forEach((x) => x.classList.remove('active'));
      el.classList.add('active');
      renderProducts();
    });
    categoryChips.appendChild(el);
  });
}

function renderProducts() {
  const term = salesSearch.value.toLowerCase();
  const filtered = inventory.filter((i) =>
    (activeCategory === 'All' || i.category === activeCategory) &&
    (i.name.toLowerCase().includes(term) || i.category.toLowerCase().includes(term))
  );
  productGrid.innerHTML = '';
  filtered.forEach((item) => {
    const card = h('div', { class: 'product' });
    const img = h('img', { class: 'thumb', alt: item.name, src: item.image || pic(item.id.slice(-3)) });
    const body = h('div', { class: 'body' });
    body.append(
      h('div', { class: 'title' }, item.name),
      h('div', { class: 'muted' }, `${item.stock} in stock`),
      row(
        h('div', { class: 'price' }, fmt(item.price)),
        btn('+', 'icon-btn', () => addToCart(item.id))
      )
    );
    card.append(img, body);
    productGrid.appendChild(card);
  });
}

function renderCart() {
  const entries = Object.entries(cart);
  cartItemsEl.classList.toggle('empty', entries.length === 0);
  cartItemsEl.innerHTML = '';
  let subtotal = 0;
  entries.forEach(([id, qty]) => {
    const item = inventory.find((i) => i.id === id);
    const price = item.price * qty;
    subtotal += price;
    const el = h('div', { class: 'cart-item' });
    const left = h('div');
    left.append(
      h('div', { class: 'title' }, item.name),
      h('div', { class: 'sub' }, `${qty} × ${fmt(item.price)} = ${fmt(price)}`)
    );
    const right = h('div', { class: 'qty' });
    right.append(
      btn('-', '', () => changeQty(id, -1)),
      h('div', null, String(qty)),
      btn('+', '', () => changeQty(id, 1))
    );
    el.append(left, right);
    cartItemsEl.appendChild(el);
  });
  const tax = subtotal * TAX_RATE;
  cartTaxEl.textContent = fmt(tax);
  completeSaleBtn.disabled = entries.length === 0;
}

function changeQty(id, delta) {
  const cur = cart[id] || 0;
  const newQty = cur + delta;
  if (newQty <= 0) delete cart[id];
  else {
    const item = inventory.find((i) => i.id === id);
    cart[id] = Math.min(newQty, item.stock);
  }
  renderCart();
}

function addToCart(id) {
  const item = inventory.find((i) => i.id === id);
  if (!item || item.stock <= 0) return;
  cart[id] = Math.min((cart[id] || 0) + 1, item.stock);
  renderCart();
}

function completeSale() {
  const entries = Object.entries(cart);
  if (!entries.length) return;
  let subtotal = 0;
  let profit = 0;
  const items = entries.map(([id, qty]) => {
    const it = inventory.find((x) => x.id === id);
    subtotal += it.price * qty;
    profit += (it.price - it.cost) * qty;
    it.stock -= qty;
    soldTally[id] = (soldTally[id] || 0) + qty;
    return { itemId: id, name: it.name, qty, price: it.price, cost: it.cost };
  });
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;
  const tx = { id: id(), date: new Date().toISOString(), items, subtotal, tax, total, profit };
  transactions.unshift(tx);
  cart = {};
  persist();
  renderProducts();
  renderCart();
  renderReports();
  renderInventory();
  renderReorder();
}

// Inventory
function renderInventory() {
  const term = inventorySearch.value?.toLowerCase?.() || '';
  const list = inventory.filter((i) => i.name.toLowerCase().includes(term));
  inventoryList.innerHTML = '';
  list.forEach((item) => {
    const li = h('li', { class: 'inventory-item' });
    li.append(
      h('img', { class: 'avatar', src: item.image || pic(item.id.slice(-3)), alt: item.name }),
      (function () {
        const box = h('div');
        box.append(h('div', { class: 'title' }, item.name), h('div', { class: 'muted' }, fmt(item.price)));
        return box;
      })(),
      (function () {
        const dot = h('div', { class: 'status-dot ' + stockClass(item.stock) });
        return dot;
      })()
    );
    li.addEventListener('click', () => openItemDialog(item));
    inventoryList.appendChild(li);
  });
}

function stockClass(stock) {
  if (stock <= 0) return 'status-bad';
  if (stock <= 10) return 'status-warn';
  return 'status-ok';
}

function openItemDialog(item) {
  itemDialogTitle.textContent = item ? 'Edit Item' : 'Add Item';
  itemForm.name.value = item?.name || '';
  itemForm.category.value = item?.category || '';
  itemForm.price.value = item?.price ?? '';
  itemForm.cost.value = item?.cost ?? '';
  itemForm.stock.value = item?.stock ?? '';
  itemForm.image.value = item?.image || '';
  itemForm.id.value = item?.id || '';
  itemDialog.showModal();
}

function saveItemFromDialog(ev) {
  ev.preventDefault();
  const data = Object.fromEntries(new FormData(itemForm));
  const payload = {
    id: data.id || id(),
    name: data.name.trim(),
    category: data.category.trim() || 'Other',
    price: Number(data.price),
    cost: Number(data.cost) || 0,
    stock: Number(data.stock) || 0,
    image: data.image?.trim() || '',
  };
  const idx = inventory.findIndex((i) => i.id === payload.id);
  if (idx >= 0) inventory[idx] = payload; else inventory.unshift(payload);
  persist();
  itemDialog.close();
  renderInventory();
  renderCategoryChips();
  renderProducts();
}

function populateCategoryDatalist() {
  categoryList.innerHTML = '';
  unique(inventory.map((i) => i.category)).forEach((c) => {
    categoryList.appendChild(h('option', { value: c }));
  });
}

// Reports
function renderReports() {
  const totalSales = transactions.reduce((s, t) => s + t.total, 0);
  const totalProfit = transactions.reduce((s, t) => s + t.profit, 0);
  const lowStock = inventory.filter((i) => i.stock <= LOW_STOCK_THRESHOLD).length;
  totalSalesEl.textContent = fmt(totalSales);
  totalProfitEl.textContent = fmt(totalProfit);
  totalTransactionsEl.textContent = String(transactions.length);
  lowStockCountEl.textContent = String(lowStock);

  // Top Selling
  const tally = { ...soldTally };
  const arr = Object.entries(tally)
    .map(([id, qty]) => ({ id, qty, item: inventory.find((i) => i.id === id) }))
    .filter((x) => x.item)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8);
  topSellingEl.innerHTML = '';
  arr.forEach(({ item, qty }) => {
    const li = h('li');
    const left = h('div', { class: 'item' });
    left.append(h('img', { class: 'avatar', src: item.image || pic(item.id.slice(-3)), alt: item.name }), h('div', null, item.name));
    const right = h('a', { href: '#', onclick: (e) => e.preventDefault() }, `${qty} sold`);
    li.append(left, right);
    topSellingEl.appendChild(li);
  });
}

// Reorder
function renderReorder() {
  const list = inventory.filter((i) => i.stock <= LOW_STOCK_THRESHOLD);
  reorderContainer.innerHTML = '';
  if (!list.length) {
    const box = h('div', { class: 'reorder-empty' });
    box.append(h('div', { style: 'font-size:40px' }, '✅'), h('div', { style: 'font-weight:800' }, 'All Stocked Up!'), h('div', { class: 'muted' }, 'No items need reordering at this time.'));
    reorderContainer.appendChild(box);
    return;
  }
  const wrapper = h('div', { class: 'reorder-list' });
  list.forEach((i) => {
    const rowEl = h('div', { class: 'reorder-item' });
    rowEl.append(h('div', null, i.name), h('div', { class: 'muted' }, `Stock: ${i.stock}`));
    wrapper.appendChild(rowEl);
  });
  reorderContainer.appendChild(wrapper);
}

// Utils
function fmt(n) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n || 0);
}
function unique(arr) { return Array.from(new Set(arr)).filter(Boolean); }
function id() { return Math.random().toString(36).slice(2, 10); }
function pic(seed) { return `https://picsum.photos/seed/${seed}/600/400`; }
function qs(sel, el = document) { return el.querySelector(sel); }
function qsa(sel, el = document) { return Array.from(el.querySelectorAll(sel)); }
function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') el.className = v;
      else if (k === 'style') el.setAttribute('style', v);
      else if (k === 'onclick') el.addEventListener('click', v);
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined) el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const ch of children.flat()) {
    if (ch == null) continue;
    el.append(ch.nodeType ? ch : document.createTextNode(ch));
  }
  return el;
}
function btn(label, cls = '', onclick) { return h('button', { class: cls ? cls : 'btn', onclick }, label); }
function row(a, b) { const r = h('div', { class: 'row' }); r.append(a, b); return r; }

function load(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function save(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}
function persist() {
  save(STORAGE_KEYS.inventory, inventory);
  save(STORAGE_KEYS.transactions, transactions);
  save(STORAGE_KEYS.soldTally, soldTally);
}
function seed(items) {
  save(STORAGE_KEYS.inventory, items);
  return items;
}

