import '../styles.css'

// WaiaSella POS - Vite + TypeScript SPA

const TAX_RATE = 0.0 // set to 0.07 for 7% tax if desired
const LOW_STOCK_THRESHOLD = 5
const STORAGE_KEYS = {
  inventory: 'ws.inventory',
  transactions: 'ws.transactions',
  soldTally: 'ws.soldTally',
} as const

type Item = {
  id: string
  name: string
  price: number
  cost: number
  stock: number
  category: string
  image?: string
}

type TransactionItem = {
  itemId: string
  name: string
  qty: number
  price: number
  cost: number
}

type Transaction = {
  id: string
  date: string
  items: TransactionItem[]
  subtotal: number
  tax: number
  total: number
  profit: number
}

const seedItems: Item[] = [
  { id: id(), name: 'Redbull', price: 2.5, cost: 1.2, stock: 15, category: 'Drinks', image: pic(1010) },
  { id: id(), name: 'Shampoo', price: 5.0, cost: 2.5, stock: 25, category: 'Personal Care', image: pic(1020) },
  { id: id(), name: 'Powder Milk', price: 8.75, cost: 5.2, stock: 8, category: 'Groceries', image: pic(1030) },
  { id: id(), name: 'Doritos', price: 1.25, cost: 0.6, stock: 50, category: 'Snacks', image: pic(1040) },
  { id: id(), name: 'Olive Oil', price: 12.0, cost: 8.5, stock: 12, category: 'Groceries', image: pic(1050) },
  { id: id(), name: 'Water Bottle', price: 1.0, cost: 0.2, stock: 100, category: 'Drinks', image: pic(1060) },
  { id: id(), name: 'Green Tea', price: 3.5, cost: 1.0, stock: 30, category: 'Drinks', image: pic(1070) },
  { id: id(), name: 'Apples', price: 0.75, cost: 0.2, stock: 40, category: 'Produce', image: pic(1080) },
]

// App State
let inventory: Item[] = load<Item[]>(STORAGE_KEYS.inventory) ?? seed(seedItems)
let transactions: Transaction[] = load<Transaction[]>(STORAGE_KEYS.transactions) ?? []
let soldTally: Record<string, number> = load<Record<string, number>>(STORAGE_KEYS.soldTally) ?? {}
let cart: Record<string, number> = {}
let activeCategory = 'All'

// Elements
const tabs = qsa<HTMLButtonElement>('.tab')
const views = qsa<HTMLElement>('.view')
const headerTitle = qs<HTMLHeadingElement>('.app-header h1')

// Sales
const categoryChips = qs<HTMLDivElement>('#categoryChips')
const productGrid = qs<HTMLDivElement>('#productGrid')
const salesSearch = qs<HTMLInputElement>('#salesSearch')
const cartItemsEl = qs<HTMLDivElement>('#cartItems')
const cartTaxEl = qs<HTMLSpanElement>('#cartTax')
const completeSaleBtn = qs<HTMLButtonElement>('#completeSaleBtn')

// Inventory
const inventoryList = qs<HTMLUListElement>('#inventoryList')
const inventorySearch = qs<HTMLInputElement>('#inventorySearch')
const addItemFab = qs<HTMLButtonElement>('#addItemFab')
const itemDialog = qs<HTMLDialogElement>('#itemDialog')
const itemForm = qs<HTMLFormElement>('#itemForm')
const itemDialogTitle = qs<HTMLHeadingElement>('#itemDialogTitle')
const categoryList = qs<HTMLDataListElement>('#categoryList')

// Reports
const totalSalesEl = qs<HTMLDivElement>('#totalSales')
const totalProfitEl = qs<HTMLDivElement>('#totalProfit')
const totalTransactionsEl = qs<HTMLDivElement>('#totalTransactions')
const lowStockCountEl = qs<HTMLDivElement>('#lowStockCount')
const topSellingEl = qs<HTMLUListElement>('#topSelling')

// Reorder
const reorderContainer = qs<HTMLDivElement>('#reorderContainer')

// Init
renderCategoryChips()
renderProducts()
renderCart()
renderInventory()
renderReports()
renderReorder()
populateCategoryDatalist()

// Tab switching
tabs.forEach((t) =>
  t.addEventListener('click', () => {
    tabs.forEach((x) => x.classList.remove('active'))
    t.classList.add('active')
    const id = t.dataset.target!
    views.forEach((v) => v.classList.remove('active'))
    qs<HTMLElement>('#' + id).classList.add('active')
    headerTitle.textContent = t.textContent?.trim() ?? ''
    if (id === 'reportsView') renderReports()
    if (id === 'reorderView') renderReorder()
    if (id === 'inventoryView') renderInventory()
  })
)

// Sales interactions
salesSearch.addEventListener('input', renderProducts)
completeSaleBtn.addEventListener('click', completeSale)

// Inventory interactions
inventorySearch.addEventListener('input', renderInventory)
addItemFab.addEventListener('click', () => openItemDialog())
itemForm.addEventListener('submit', saveItemFromDialog)

function renderCategoryChips() {
  const categories = ['All', ...unique(inventory.map((i) => i.category))]
  categoryChips.innerHTML = ''
  categories.forEach((c) => {
    const el = h('button', { class: 'chip' + (c === activeCategory ? ' active' : '') }, c)
    el.addEventListener('click', () => {
      activeCategory = c
      qsa<HTMLButtonElement>('.chip', categoryChips).forEach((x) => x.classList.remove('active'))
      el.classList.add('active')
      renderProducts()
    })
    categoryChips.appendChild(el)
  })
}

function renderProducts() {
  const term = salesSearch.value.toLowerCase()
  const filtered = inventory.filter(
    (i) => (activeCategory === 'All' || i.category === activeCategory) && (i.name.toLowerCase().includes(term) || i.category.toLowerCase().includes(term))
  )
  productGrid.innerHTML = ''
  filtered.forEach((item) => {
    const card = h('div', { class: 'product' })
    const img = h('img', { class: 'thumb', alt: item.name, src: item.image || pic(Number(item.id.slice(-3))) })
    const body = h('div', { class: 'body' })
    body.append(
      h('div', { class: 'title' }, item.name),
      h('div', { class: 'muted' }, `${item.stock} in stock`),
      row(h('div', { class: 'price' }, fmt(item.price)), btn('+', 'icon-btn', () => addToCart(item.id)))
    )
    card.append(img, body)
    productGrid.appendChild(card)
  })
}

function renderCart() {
  const entries = Object.entries(cart)
  cartItemsEl.classList.toggle('empty', entries.length === 0)
  cartItemsEl.innerHTML = ''
  let subtotal = 0
  entries.forEach(([id, qty]) => {
    const item = inventory.find((i) => i.id === id)!
    const price = item.price * qty
    subtotal += price
    const el = h('div', { class: 'cart-item' })
    const left = h('div')
    left.append(h('div', { class: 'title' }, item.name), h('div', { class: 'sub' }, `${qty} × ${fmt(item.price)} = ${fmt(price)}`))
    const right = h('div', { class: 'qty' })
    right.append(btn('-', '', () => changeQty(id, -1)), h('div', null, String(qty)), btn('+', '', () => changeQty(id, 1)))
    el.append(left, right)
    cartItemsEl.appendChild(el)
  })
  const tax = subtotal * TAX_RATE
  cartTaxEl.textContent = fmt(tax)
  completeSaleBtn.disabled = entries.length === 0
}

function changeQty(id: string, delta: number) {
  const cur = cart[id] || 0
  const newQty = cur + delta
  if (newQty <= 0) delete cart[id]
  else {
    const item = inventory.find((i) => i.id === id)!
    cart[id] = Math.min(newQty, item.stock)
  }
  renderCart()
}

function addToCart(id: string) {
  const item = inventory.find((i) => i.id === id)
  if (!item || item.stock <= 0) return
  cart[id] = Math.min((cart[id] || 0) + 1, item.stock)
  renderCart()
}

function completeSale() {
  const entries = Object.entries(cart)
  if (!entries.length) return
  let subtotal = 0
  let profit = 0
  const items: TransactionItem[] = entries.map(([id, qty]) => {
    const it = inventory.find((x) => x.id === id)!
    subtotal += it.price * qty
    profit += (it.price - it.cost) * qty
    it.stock -= qty
    soldTally[id] = (soldTally[id] || 0) + qty
    return { itemId: id, name: it.name, qty, price: it.price, cost: it.cost }
  })
  const tax = subtotal * TAX_RATE
  const total = subtotal + tax
  const tx: Transaction = { id: id(), date: new Date().toISOString(), items, subtotal, tax, total, profit }
  transactions.unshift(tx)
  cart = {}
  persist()
  renderProducts()
  renderCart()
  renderReports()
  renderInventory()
  renderReorder()
}

// Inventory
function renderInventory() {
  const term = inventorySearch.value?.toLowerCase?.() || ''
  const list = inventory.filter((i) => i.name.toLowerCase().includes(term))
  inventoryList.innerHTML = ''
  list.forEach((item) => {
    const li = h('li', { class: 'inventory-item' })
    li.append(
      h('img', { class: 'avatar', src: item.image || pic(Number(item.id.slice(-3))), alt: item.name }),
      (() => {
        const box = h('div')
        box.append(h('div', { class: 'title' }, item.name), h('div', { class: 'muted' }, fmt(item.price)))
        return box
      })(),
      (() => h('div', { class: 'status-dot ' + stockClass(item.stock) }))()
    )
    li.addEventListener('click', () => openItemDialog(item))
    inventoryList.appendChild(li)
  })
}

function stockClass(stock: number) {
  if (stock <= 0) return 'status-bad'
  if (stock <= 10) return 'status-warn'
  return 'status-ok'
}

function openItemDialog(item?: Item) {
  itemDialogTitle.textContent = item ? 'Edit Item' : 'Add Item'
  ;(itemForm.elements.namedItem('name') as HTMLInputElement).value = item?.name || ''
  ;(itemForm.elements.namedItem('category') as HTMLInputElement).value = item?.category || ''
  ;(itemForm.elements.namedItem('price') as HTMLInputElement).value = item?.price?.toString() ?? ''
  ;(itemForm.elements.namedItem('cost') as HTMLInputElement).value = item?.cost?.toString() ?? ''
  ;(itemForm.elements.namedItem('stock') as HTMLInputElement).value = item?.stock?.toString() ?? ''
  ;(itemForm.elements.namedItem('image') as HTMLInputElement).value = item?.image || ''
  ;(itemForm.elements.namedItem('id') as HTMLInputElement).value = item?.id || ''
  itemDialog.showModal()
}

function saveItemFromDialog(ev: SubmitEvent) {
  ev.preventDefault()
  const data = Object.fromEntries(new FormData(itemForm) as any) as Record<string, string>
  const payload: Item = {
    id: data.id || id(),
    name: data.name.trim(),
    category: data.category.trim() || 'Other',
    price: Number(data.price),
    cost: Number(data.cost) || 0,
    stock: Number(data.stock) || 0,
    image: data.image?.trim() || '',
  }
  const idx = inventory.findIndex((i) => i.id === payload.id)
  if (idx >= 0) inventory[idx] = payload
  else inventory.unshift(payload)
  persist()
  itemDialog.close()
  renderInventory()
  renderCategoryChips()
  renderProducts()
}

function populateCategoryDatalist() {
  categoryList.innerHTML = ''
  unique(inventory.map((i) => i.category)).forEach((c) => {
    categoryList.appendChild(h('option', { value: c }))
  })
}

// Reports
function renderReports() {
  const totalSales = transactions.reduce((s, t) => s + t.total, 0)
  const totalProfit = transactions.reduce((s, t) => s + t.profit, 0)
  const lowStock = inventory.filter((i) => i.stock <= LOW_STOCK_THRESHOLD).length
  totalSalesEl.textContent = fmt(totalSales)
  totalProfitEl.textContent = fmt(totalProfit)
  totalTransactionsEl.textContent = String(transactions.length)
  lowStockCountEl.textContent = String(lowStock)

  const arr = Object.entries(soldTally)
    .map(([id, qty]) => ({ id, qty, item: inventory.find((i) => i.id === id) }))
    .filter((x): x is { id: string; qty: number; item: Item } => Boolean(x.item))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8)
  topSellingEl.innerHTML = ''
  arr.forEach(({ item, qty }) => {
    const li = h('li')
    const left = h('div', { class: 'item' })
    left.append(h('img', { class: 'avatar', src: item.image || pic(Number(item.id.slice(-3))), alt: item.name }), h('div', null, item.name))
    const right = h('a', { href: '#', onclick: (e: Event) => e.preventDefault() }, `${qty} sold`)
    li.append(left, right)
    topSellingEl.appendChild(li)
  })
}

// Reorder
function renderReorder() {
  const list = inventory.filter((i) => i.stock <= LOW_STOCK_THRESHOLD)
  reorderContainer.innerHTML = ''
  if (!list.length) {
    const box = h('div', { class: 'reorder-empty' })
    box.append(
      h('div', { style: 'font-size:40px' }, '✅'),
      h('div', { style: 'font-weight:800' }, 'All Stocked Up!'),
      h('div', { class: 'muted' }, 'No items need reordering at this time.'),
    )
    reorderContainer.appendChild(box)
    return
  }
  const wrapper = h('div', { class: 'reorder-list' })
  list.forEach((i) => {
    const rowEl = h('div', { class: 'reorder-item' })
    rowEl.append(h('div', null, i.name), h('div', { class: 'muted' }, `Stock: ${i.stock}`))
    wrapper.appendChild(rowEl)
  })
  reorderContainer.appendChild(wrapper)
}

// Utils
function fmt(n: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n || 0)
}
function unique<T>(arr: T[]) { return Array.from(new Set(arr)).filter(Boolean) as T[] }
function id() { return Math.random().toString(36).slice(2, 10) }
function pic(seed: number) { return `https://picsum.photos/seed/${seed}/600/400` }
function qs<T extends Element>(sel: string, el: Document | Element = document) { return el.querySelector(sel) as T }
function qsa<T extends Element>(sel: string, el: Document | Element = document) { return Array.from(el.querySelectorAll(sel)) as T[] }
function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Record<string, any> | null, ...children: (Node | string | null | undefined)[]) {
  const el = document.createElement(tag)
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') (el as HTMLElement).className = v
      else if (k === 'style') el.setAttribute('style', v)
      else if (k === 'onclick') (el as HTMLElement).addEventListener('click', v)
      else if (k.startsWith('on')) (el as HTMLElement).addEventListener(k.slice(2), v)
      else if (v !== null && v !== undefined) el.setAttribute(k, v === true ? '' : String(v))
    }
  }
  for (const ch of children.flat()) {
    if (ch == null) continue
    el.append(ch as any instanceof Node ? (ch as Node) : document.createTextNode(String(ch)))
  }
  return el
}
function btn(label: string, cls = '', onclick?: () => void) { return h('button', { class: cls ? cls : 'btn', onclick }, label) }
function row(a: Element, b: Element) { const r = h('div', { class: 'row' }); r.append(a, b); return r }

function load<T>(key: string): T | null {
  try { return JSON.parse(localStorage.getItem(key) || 'null') as T | null } catch { return null }
}
function save(key: string, val: unknown) { localStorage.setItem(key, JSON.stringify(val)) }
function persist() {
  save(STORAGE_KEYS.inventory, inventory)
  save(STORAGE_KEYS.transactions, transactions)
  save(STORAGE_KEYS.soldTally, soldTally)
}
function seed(items: Item[]) { save(STORAGE_KEYS.inventory, items); return items }

