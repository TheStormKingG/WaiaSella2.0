import '../styles.css'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_CONFIG } from './config'
import jsPDF from 'jspdf'

// WaiaSella POS - Vite + TypeScript SPA

// Helper functions (must be defined before use - using function declarations for hoisting)
function pic(seed: number) { return `https://picsum.photos/seed/${seed}/600/400` }
function id() { return Math.random().toString(36).slice(2, 10) }
function unique<T>(arr: T[]) { return Array.from(new Set(arr)).filter(Boolean) as T[] }
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
function load<T>(key: string): T | null {
  try { return JSON.parse(localStorage.getItem(key) || 'null') as T | null } catch { return null }
}
function save(key: string, val: unknown) { localStorage.setItem(key, JSON.stringify(val)) }
function fmt(n: number) {
  // Custom formatter for Guyana Dollars (GY$)
  const formatted = new Intl.NumberFormat('en-GY', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }).format(n || 0)
  return `GY$${formatted}`
}
function seed(items: Item[]) { 
  save('ws.inventory', items)
  return items 
}

const TAX_RATE = 0.16 // 16% VAT
const LOW_STOCK_THRESHOLD = 5

// Get next order number (resets daily at midnight, starts at 0001)
function getNextOrderNumber(): string {
  const now = new Date()
  const today = now.toDateString() // e.g., "Mon Jan 01 2024"
  const storedDate = load<string>(STORAGE_KEYS.orderCounterDate)
  
  let counter = load<number>(STORAGE_KEYS.orderCounter) ?? 0
  
  // Reset counter if it's a new day
  if (storedDate !== today) {
    counter = 0
    save(STORAGE_KEYS.orderCounterDate, today)
  }
  
  // Increment counter
  counter++
  save(STORAGE_KEYS.orderCounter, counter)
  
  // Format as 4-digit number with leading zeros (e.g., 0001, 0002, etc.)
  return counter.toString().padStart(4, '0')
}
const STORAGE_KEYS = {
  inventory: 'ws.inventory',
  transactions: 'ws.transactions',
  soldTally: 'ws.soldTally',
  transactionCounter: 'ws.transactionCounter',
  cart: 'ws.cart',
  cartMode: 'ws.cartMode',
  currentView: 'ws.currentView',
  expenseView: 'ws.expenseView',
  expenseTab: 'ws.expenseTab',
  reportTab: 'ws.reportTab',
  settingsTab: 'ws.settingsTab',
  selectedInventoryCategory: 'ws.selectedInventoryCategory',
  customCategories: 'ws.customCategories',
  expenses: 'ws.expenses',
  isAuthenticated: 'ws.isAuthenticated',
  userType: 'ws.userType',
  currentUser: 'ws.currentUser',
  currentUserRole: 'ws.currentUserRole',
  orderCounter: 'ws.orderCounter',
  orderCounterDate: 'ws.orderCounterDate',
} as const

type Expense = {
  id: string
  date: string
  description: string
  category?: string
  amount: number
  notes?: string
}

type Item = {
  id: string
  name: string
  price: number
  cost: number
  stock: number
  category: string
  image?: string
  lowPoint?: number
  maxStock?: number
  unit?: string
  expiryDate?: string
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
  mode: 'sale' | 'order'
  customerName?: string
  cashierName?: string
}

// Lazy initialization function to avoid temporal dead zone issues
function getSeedItems(): Item[] {
  return [
  { id: id(), name: 'Redbull', price: 2.5, cost: 1.2, stock: 15, category: 'Drinks', image: pic(1010) },
  { id: id(), name: 'Shampoo', price: 5.0, cost: 2.5, stock: 25, category: 'Personal Care', image: pic(1020) },
  { id: id(), name: 'Powder Milk', price: 8.75, cost: 5.2, stock: 8, category: 'Groceries', image: pic(1030) },
  { id: id(), name: 'Doritos', price: 1.25, cost: 0.6, stock: 50, category: 'Snacks', image: pic(1040) },
  { id: id(), name: 'Olive Oil', price: 12.0, cost: 8.5, stock: 12, category: 'Groceries', image: pic(1050) },
  { id: id(), name: 'Water Bottle', price: 1.0, cost: 0.2, stock: 100, category: 'Drinks', image: pic(1060) },
  { id: id(), name: 'Green Tea', price: 3.5, cost: 1.0, stock: 30, category: 'Drinks', image: pic(1070) },
  { id: id(), name: 'Apples', price: 0.75, cost: 0.2, stock: 40, category: 'Produce', image: pic(1080) },
]
}

// Initialize Supabase client
const supabase = SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey
  ? createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey)
  : null

// Log connection status
if (supabase) {
  console.log('✓ Supabase connected:', SUPABASE_CONFIG.url)
} else {
  console.warn('⚠ Supabase not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env file')
}

// App State - Initialize after all functions are defined
let inventory: Item[] = (() => {
  const loaded = load<Item[]>(STORAGE_KEYS.inventory)
  return loaded ?? seed(getSeedItems())
})()
let transactions: Transaction[] = (load<Transaction[]>(STORAGE_KEYS.transactions) ?? []).map((tx) => ({
  ...tx,
  mode: (tx as Transaction).mode ?? 'sale',
}))
let soldTally: Record<string, number> = load<Record<string, number>>(STORAGE_KEYS.soldTally) ?? {}
let cart: Record<string, number> = load<Record<string, number>>(STORAGE_KEYS.cart) ?? {}
let selectedCategory = 'All'
let cartMode: 'sale' | 'order' = (load<string>(STORAGE_KEYS.cartMode) === 'order') ? 'order' : 'sale'
let customCategories: string[] = load<string[]>(STORAGE_KEYS.customCategories) ?? []
customCategories = unique([...customCategories, 'Other'])
save(STORAGE_KEYS.customCategories, customCategories)

// Operational Expenses
let expenses: Expense[] = load<Expense[]>(STORAGE_KEYS.expenses) ?? []

// Authentication
let isAuthenticated = load<boolean>(STORAGE_KEYS.isAuthenticated) ?? false
let userType: 'business' | 'individual' = (load<string>(STORAGE_KEYS.userType) as 'business' | 'individual') || 'business'
let currentUser = load<string>(STORAGE_KEYS.currentUser) || ''
let currentUserRole: 'admin' | 'cashier' | 'observer' | null = (load<string>(STORAGE_KEYS.currentUserRole) as 'admin' | 'cashier' | 'observer' | null) || null

// Elements
const tabs = qsa<HTMLButtonElement>('.tab')
const views = qsa<HTMLElement>('.view')
const headerTitle = qs<HTMLHeadingElement>('.app-header h1')

// Cashier
const categoryFilter = qs<HTMLSelectElement>('#categoryFilter')
const productGrid = qs<HTMLDivElement>('#productGrid')
const cashierSearch = qs<HTMLInputElement>('#cashierSearch') // Now in header
const cartItemsEl = qs<HTMLDivElement>('#cartItems')
const cartTaxEl = qs<HTMLSpanElement>('#cartTax')
const cartTotalEl = qs<HTMLSpanElement>('#cartTotal')
const completeSaleBtn = qs<HTMLButtonElement>('#completeSaleBtn')
const cartPanel = qs<HTMLElement>('#cartPanel')
const cartToggle = qs<HTMLButtonElement>('#cartToggle')
const cartHeaderCount = qs<HTMLSpanElement>('#cartHeaderCount')
const cartHeaderTotal = qs<HTMLSpanElement>('#cartHeaderTotal')
const cartModeLabel = qs<HTMLSpanElement>('#cartModeLabel')
const cartModeToggle = qs<HTMLButtonElement>('#cartModeToggle')

// Receipt
const receiptDialog = qs<HTMLDialogElement>('#receiptDialog')
const receiptTransactionId = qs<HTMLSpanElement>('#receiptTransactionId')
const receiptDate = qs<HTMLDivElement>('#receiptDate')
const receiptItems = qs<HTMLDivElement>('#receiptItems')
const receiptTotals = qs<HTMLDivElement>('#receiptTotals')
const closeReceiptBtn = qs<HTMLButtonElement>('#closeReceiptBtn')
const whatsappReceiptBtn = qs<HTMLButtonElement>('#whatsappReceiptBtn')
const emailReceiptBtn = qs<HTMLButtonElement>('#emailReceiptBtn')
const downloadReceiptBtn = qs<HTMLButtonElement>('#downloadReceiptBtn')
const toast = qs<HTMLDivElement>('#toast')

// Store current receipt for sharing
let currentReceipt: Transaction | null = null

// Inventory
const inventoryCategories = qs<HTMLDivElement>('#inventoryCategories')
const inventoryItemsView = qs<HTMLDivElement>('#inventoryItemsView')
const inventoryList = qs<HTMLUListElement>('#inventoryList')
const inventorySearch = qs<HTMLInputElement>('#inventorySearch')
const addItemFab = qs<HTMLButtonElement>('#addItemFab')
addItemFab.style.display = 'none'
const headerSearch = inventorySearch // Using the same element now in header
const manageCategoriesView = qs<HTMLDivElement>('#manageCategoriesView')
const categoryManageList = qs<HTMLUListElement>('#categoryManageList')
const addCategoryBtn = qs<HTMLButtonElement>('#addCategoryBtn')
const addCategoryDialog = qs<HTMLDialogElement>('#addCategoryDialog')
const addCategoryForm = qs<HTMLFormElement>('#addCategoryForm')
const addCategoryInput = qs<HTMLInputElement>('#addCategoryInput')
const cancelAddCategoryBtn = qs<HTMLButtonElement>('#cancelAddCategoryBtn')
const headerBackBtn = qs<HTMLButtonElement>('#headerBackBtn')
headerBackBtn.dataset.reorder = 'false'
const itemDialog = qs<HTMLDialogElement>('#itemDialog')
const itemForm = qs<HTMLFormElement>('#itemForm')
const itemDialogTitle = qs<HTMLHeadingElement>('#itemDialogTitle')
const categoryList = qs<HTMLDataListElement>('#categoryList')
const cancelItemBtn = qs<HTMLButtonElement>('#cancelItemBtn')
const deleteItemBtn = qs<HTMLButtonElement>('#deleteItemBtn')
const itemImagePreview = qs<HTMLImageElement>('#itemImagePreview')
const itemImageUpload = qs<HTMLInputElement>('#itemImageUpload')
const itemImageCapture = qs<HTMLInputElement>('#itemImageCapture')
const uploadImageBtn = qs<HTMLButtonElement>('#uploadImageBtn')
const captureImageBtn = qs<HTMLButtonElement>('#captureImageBtn')
const itemImageData = qs<HTMLInputElement>('#itemImageData')

// Orders & Settings
const ordersContainer = qs<HTMLDivElement>('#ordersContainer')
const orderDetailsDialog = qs<HTMLDialogElement>('#orderDetailsDialog')
const orderDetailsTitle = qs<HTMLHeadingElement>('#orderDetailsTitle')
const orderDetailsContent = qs<HTMLDivElement>('#orderDetailsContent')
const closeOrderDetailsXBtn = qs<HTMLButtonElement>('#closeOrderDetailsXBtn')
const cancelOrderBtn = qs<HTMLButtonElement>('#cancelOrderBtn')
const deliveredOrderBtn = qs<HTMLButtonElement>('#deliveredOrderBtn')
const cancelOrderDialog = qs<HTMLDialogElement>('#cancelOrderDialog')
const cancelOrderMessage = qs<HTMLParagraphElement>('#cancelOrderMessage')
const cancelOrderId = qs<HTMLInputElement>('#cancelOrderId')
const closeCancelOrderDialog = qs<HTMLButtonElement>('#closeCancelOrderDialog')
const closeCancelOrderConfirmBtn = qs<HTMLButtonElement>('#closeCancelOrderConfirmBtn')
const confirmCancelOrderBtn = qs<HTMLButtonElement>('#confirmCancelOrderBtn')
const deliverOrderDialog = qs<HTMLDialogElement>('#deliverOrderDialog')
const deliverOrderMessage = qs<HTMLParagraphElement>('#deliverOrderMessage')
const deliverOrderId = qs<HTMLInputElement>('#deliverOrderId')
const closeDeliverOrderDialog = qs<HTMLButtonElement>('#closeDeliverOrderDialog')
const closeDeliverOrderConfirmBtn = qs<HTMLButtonElement>('#closeDeliverOrderConfirmBtn')
const confirmDeliverOrderBtn = qs<HTMLButtonElement>('#confirmDeliverOrderBtn')

// Store current order for button handlers
let currentOrderView: Transaction | null = null
const customerNameDialog = qs<HTMLDialogElement>('#customerNameDialog')
const customerNameForm = qs<HTMLFormElement>('#customerNameForm')
const customerNameInput = qs<HTMLInputElement>('#customerNameInput')
const cancelCustomerNameBtn = qs<HTMLButtonElement>('#cancelCustomerNameBtn')

// User Dialog
const userDialog = qs<HTMLDialogElement>('#userDialog')
const userForm = qs<HTMLFormElement>('#userForm')
const userDialogTitle = qs<HTMLHeadingElement>('#userDialogTitle')
const closeUserDialogBtn = qs<HTMLButtonElement>('#closeUserDialog')
const cancelUserBtn = qs<HTMLButtonElement>('#cancelUserBtn')

// Individual User Views
const storesContainer = qs<HTMLDivElement>('#storesContainer')
const individualOrdersContainer = qs<HTMLDivElement>('#individualOrdersContainer')
const historyContainer = qs<HTMLDivElement>('#historyContainer')
const individualReportsContainer = qs<HTMLDivElement>('#individualReportsContainer')

// Expense tabs
const expenseTabs = qsa<HTMLButtonElement>('.expense-tab')
const sellableView = qs<HTMLDivElement>('#sellableView')
const operationalView = qs<HTMLDivElement>('#operationalView')
const expenseTabContents = qsa<HTMLDivElement>('.expense-tab-content')

// Sellable table
const sellableTableView = qs<HTMLDivElement>('#sellableTableView')
const addItemBtn = qs<HTMLButtonElement>('#addItemBtn')
const sellableSearch = qs<HTMLInputElement>('#sellableSearch')
const sellableCategoryFilter = qs<HTMLSelectElement>('#sellableCategoryFilter')
const clearSellableFiltersBtn = qs<HTMLButtonElement>('#clearSellableFilters')
const sellableTableBody = qs<HTMLTableSectionElement>('#sellableTableBody')
const sellableEmpty = qs<HTMLDivElement>('#sellableEmpty')

// Report tabs
const reportTabs = qsa<HTMLButtonElement>('.expense-tab[data-report-tab]')
const generalReportView = qs<HTMLDivElement>('#generalReportView')
const incomeReportView = qs<HTMLDivElement>('#incomeReportView')
const balanceReportView = qs<HTMLDivElement>('#balanceReportView')
const cashflowReportView = qs<HTMLDivElement>('#cashflowReportView')
const reportTabContents = qsa<HTMLDivElement>('#generalReportView, #incomeReportView, #balanceReportView, #cashflowReportView')

// Operational Expenses
const addExpenseBtn = qs<HTMLButtonElement>('#addExpenseBtn')
const expenseDialog = qs<HTMLDialogElement>('#expenseDialog')
const expenseForm = qs<HTMLFormElement>('#expenseForm')
const expenseDialogTitle = qs<HTMLHeadingElement>('#expenseDialogTitle')
const expenseSearch = qs<HTMLInputElement>('#expenseSearch')
const expenseStartDate = qs<HTMLInputElement>('#expenseStartDate')
const expenseEndDate = qs<HTMLInputElement>('#expenseEndDate')
const clearExpenseFiltersBtn = qs<HTMLButtonElement>('#clearExpenseFilters')
const expensesTableBody = qs<HTMLTableSectionElement>('#expensesTableBody')
const expensesTableFooter = qs<HTMLTableSectionElement>('#expensesTableFooter')
const expensesTotal = qs<HTMLTableCellElement>('#expensesTotal')
const expensesEmpty = qs<HTMLDivElement>('#expensesEmpty')
const closeExpenseDialogBtn = qs<HTMLButtonElement>('#closeExpenseDialog')
const cancelExpenseBtn = qs<HTMLButtonElement>('#cancelExpenseBtn')

// Category modals
const renameCategoryDialog = qs<HTMLDialogElement>('#renameCategoryDialog')
const renameCategoryForm = qs<HTMLFormElement>('#renameCategoryForm')
const renameCategoryInput = qs<HTMLInputElement>('#renameCategoryInput')
const oldCategoryName = qs<HTMLInputElement>('#oldCategoryName')
const cancelRenameBtn = qs<HTMLButtonElement>('#cancelRenameBtn')
const deleteCategoryDialog = qs<HTMLDialogElement>('#deleteCategoryDialog')
const deleteCategoryMessage = qs<HTMLParagraphElement>('#deleteCategoryMessage')
const categoryToDelete = qs<HTMLInputElement>('#categoryToDelete')
const cancelDeleteBtn = qs<HTMLButtonElement>('#cancelDeleteBtn')
const confirmDeleteBtn = qs<HTMLButtonElement>('#confirmDeleteBtn')

// Inventory state
let selectedInventoryCategory: string | null = null

// Reports
const totalSalesEl = qs<HTMLDivElement>('#totalSales')
const totalProfitEl = qs<HTMLDivElement>('#totalProfit')
const totalTransactionsEl = qs<HTMLDivElement>('#totalTransactions')
const lowStockCountEl = qs<HTMLDivElement>('#lowStockCount')
const topSellingEl = qs<HTMLUListElement>('#topSelling')

// Reorder
const reorderContainer = qs<HTMLDivElement>('#reorderContainer')

// Authentication Elements
const authView = qs<HTMLElement>('#authView')
const loginTabBtn = qs<HTMLButtonElement>('#loginTabBtn')
const signupTabBtn = qs<HTMLButtonElement>('#signupTabBtn')
const loginForm = qs<HTMLDivElement>('#loginForm')
const signupForm = qs<HTMLDivElement>('#signupForm')
const loginFormElement = qs<HTMLFormElement>('#loginFormElement')
const signupFormElement = qs<HTMLFormElement>('#signupFormElement')
const businessTypeBtn = qs<HTMLButtonElement>('#businessTypeBtn')
const individualTypeBtn = qs<HTMLButtonElement>('#individualTypeBtn')
const userTypeInput = qs<HTMLInputElement>('#userType')
const authError = qs<HTMLDivElement>('#authError')
const appHeader = qs<HTMLElement>('.app-header')
const appMain = qs<HTMLElement>('#app')
const appTabbar = qs<HTMLElement>('.tabbar')
const userName = qs<HTMLSpanElement>('#userName')
const userTypeBadge = qs<HTMLSpanElement>('#userTypeBadge')
const headerSettingsBtn = qs<HTMLButtonElement>('#headerSettingsBtn')
const logoutBtnHeader = qs<HTMLButtonElement>('#logoutBtn')

// Settings tabs - MUST be declared BEFORE renderSettings() is called at module init (line 694)
// These are declared with let and initialized to empty arrays/null to avoid TDZ
let settingsTabs: NodeListOf<HTMLButtonElement> | HTMLButtonElement[] = [] as any
let storeProfileView: HTMLDivElement | null = null
let usersView: HTMLDivElement | null = null
let settingsTabContents: HTMLDivElement[] = [] as any
let storeProfileContainer: HTMLDivElement | null = null
let usersContainer: HTMLDivElement | null = null
let addUserBtn: HTMLButtonElement | null = null
let usersList: HTMLDivElement | null = null

// App icon color schemes - matching modern app icon style (defined early to avoid TDZ)
const categoryColors = [
  { bg: '#FFFFFF', icon: '#1976D2', shadow: 'rgba(0,0,0,0.1)' },
  { bg: '#E8F5E9', icon: '#388E3C', shadow: 'rgba(0,0,0,0.08)' },
  { bg: '#E3F2FD', icon: '#1976D2', shadow: 'rgba(0,0,0,0.08)' },
  { bg: '#FFF3E0', icon: '#F57C00', shadow: 'rgba(0,0,0,0.08)' },
  { bg: '#F3E5F5', icon: '#7B1FA2', shadow: 'rgba(0,0,0,0.08)' },
  { bg: '#E0F2F1', icon: '#00796B', shadow: 'rgba(0,0,0,0.08)' },
  { bg: '#FCE4EC', icon: '#C2185B', shadow: 'rgba(0,0,0,0.08)' },
  { bg: '#EDE7F6', icon: '#512DA8', shadow: 'rgba(0,0,0,0.08)' },
  { bg: '#E1F5FE', icon: '#0288D1', shadow: 'rgba(0,0,0,0.08)' },
  { bg: '#FFF9C4', icon: '#F9A825', shadow: 'rgba(0,0,0,0.08)' },
  { bg: '#F1F8E9', icon: '#689F38', shadow: 'rgba(0,0,0,0.08)' },
  { bg: '#F5F5F5', icon: '#424242', shadow: 'rgba(0,0,0,0.1)' },
]

function getCategoryColor(index: number) {
  return categoryColors[index % categoryColors.length]
}

// Generate a simple icon SVG for the category (letter-based design)
function getCategoryIcon(category: string, color: string): string {
  const letter = category.charAt(0).toUpperCase()
  // Create a simple geometric icon using SVG
  return `
    <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="20" fill="${color}" opacity="0.2"/>
      <text x="24" y="32" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="700" fill="${color}" text-anchor="middle" dominant-baseline="central">${letter}</text>
    </svg>
  `
}

// Category-specific image mappings
function getCategoryImage(category: string): string {
  const categoryMap: Record<string, string> = {
    'Drinks': 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&h=300&fit=crop', // Beverages
    'Personal Care': 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400&h=300&fit=crop', // Cosmetics
    'Groceries': 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&h=300&fit=crop', // Grocery items
    'Snacks': 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400&h=300&fit=crop', // Snacks
    'Produce': 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=400&h=300&fit=crop', // Fruits/vegetables
  }
  
  return categoryMap[category] || pic(Number(category.charCodeAt(0) * 100))
}

// Gear/settings icon for manage categories
function getSettingsImage(): string {
  return 'data:image/svg+xml,' + encodeURIComponent(`
    <svg width="400" height="300" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#grad)"/>
      <path d="M200 80 L220 100 L220 200 L200 220 L180 200 L180 100 Z" fill="white" opacity="0.3"/>
      <circle cx="200" cy="150" r="40" fill="white" opacity="0.9"/>
      <circle cx="200" cy="150" r="20" fill="url(#grad)"/>
      <circle cx="180" cy="80" r="8" fill="white"/>
      <circle cx="220" cy="80" r="8" fill="white"/>
      <circle cx="240" cy="120" r="8" fill="white"/>
      <circle cx="240" cy="180" r="8" fill="white"/>
      <circle cx="220" cy="220" r="8" fill="white"/>
      <circle cx="180" cy="220" r="8" fill="white"/>
      <circle cx="160" cy="180" r="8" fill="white"/>
      <circle cx="160" cy="120" r="8" fill="white"/>
    </svg>
  `)
}

function getReorderImage(): string {
  return 'data:image/svg+xml,' + encodeURIComponent(`
    <svg width="400" height="300" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="reorderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#2563eb;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#60a5fa;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" rx="24" fill="#f3f6ff"/>
      <path d="M140 150c0-44.18 35.82-80 80-80" stroke="url(#reorderGradient)" stroke-width="16" stroke-linecap="round" fill="none"/>
      <path d="M220 70l20 20-20 20" fill="none" stroke="url(#reorderGradient)" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M260 150c0 44.18-35.82 80-80 80" stroke="#93c5fd" stroke-width="16" stroke-linecap="round" fill="none"/>
      <path d="M180 230l-20-20 20-20" fill="none" stroke="#93c5fd" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="200" cy="150" r="38" fill="white" stroke="url(#reorderGradient)" stroke-width="10"/>
      <circle cx="200" cy="150" r="18" fill="url(#reorderGradient)"/>
    </svg>
  `)
}

// Format currency without cents
function fmtNoCents(n: number): string {
  return `GY$${Math.round(n || 0).toLocaleString()}`
}

// Initialize default admin accounts
function initializeAdminAccounts() {
  const users = load<Record<string, { password: string; userType: 'business' | 'individual'; name?: string; role?: 'admin' | 'cashier' | 'observer' }>>('ws.users') ?? {}
  
  // Create adminb (Business admin) if it doesn't exist
  if (!users['adminb']) {
    users['adminb'] = { password: '123456', userType: 'business', name: 'Admin Business', role: 'admin' }
  }
  
  // Create admini (Individual admin) if it doesn't exist
  if (!users['admini']) {
    users['admini'] = { password: '123456', userType: 'individual', name: 'Admin Individual' }
  }
  
  // Save the updated users
  save('ws.users', users)
}

// Initialize admin accounts on load
initializeAdminAccounts()

// Auth handlers
function showAuthError(message: string) {
  if (authError) {
    authError.textContent = message
    authError.style.display = 'block'
    setTimeout(() => {
      authError.style.display = 'none'
    }, 5000)
  }
}

function switchAuthMode(mode: 'login' | 'signup') {
  if (mode === 'login') {
    loginTabBtn?.classList.add('active')
    signupTabBtn?.classList.remove('active')
    loginForm?.classList.add('active')
    signupForm?.classList.remove('active')
  } else {
    loginTabBtn?.classList.remove('active')
    signupTabBtn?.classList.add('active')
    loginForm?.classList.remove('active')
    signupForm?.classList.add('active')
  }
  if (authError) authError.style.display = 'none'
}

function switchUserType(type: 'business' | 'individual') {
  userType = type
  if (userTypeInput) userTypeInput.value = type
  if (type === 'business') {
    businessTypeBtn?.classList.add('active')
    individualTypeBtn?.classList.remove('active')
  } else {
    businessTypeBtn?.classList.remove('active')
    individualTypeBtn?.classList.add('active')
  }
}

function handleLogin(identifier: string, password: string) {
  // Simple authentication (in production, this would connect to a backend)
  // For now, just check if credentials exist in localStorage
  // Identifier can be either email or username (name)
  const users = load<Record<string, { password: string; userType: 'business' | 'individual'; name?: string; role?: 'admin' | 'cashier' | 'observer' }>>('ws.users') ?? {}
  
  const trimmedIdentifier = identifier.trim().toLowerCase()
  
  // Try to find user by email first (exact match, case-insensitive)
  let userEmail: string | null = null
  let user: { password: string; userType: 'business' | 'individual'; name?: string; role?: 'admin' | 'cashier' | 'observer' } | null = null
  
  if (users[trimmedIdentifier]) {
    // Direct email match
    userEmail = trimmedIdentifier
    user = users[trimmedIdentifier]
  } else {
    // Search by name (username) - case-insensitive partial match
    const foundEntry = Object.entries(users).find(([email, userData]) => {
      const userName = userData.name?.trim().toLowerCase() || ''
      return userName === trimmedIdentifier || userName.includes(trimmedIdentifier)
    })
    
    if (foundEntry) {
      userEmail = foundEntry[0]
      user = foundEntry[1]
    }
  }
  
  // Authenticate if user found and password matches
  if (userEmail && user && user.password === password) {
    isAuthenticated = true
    currentUser = userEmail
    userType = user.userType
    // Get role if user is a business user
    currentUserRole = user.userType === 'business' ? (user.role || 'cashier') : null
    save(STORAGE_KEYS.isAuthenticated, true)
    save(STORAGE_KEYS.currentUser, userEmail)
    save(STORAGE_KEYS.userType, userType)
    save(STORAGE_KEYS.currentUserRole, currentUserRole || '')
    showApp()
    return true
  }
  
  showAuthError('Invalid username/email or password')
  return false
}

function handleSignup(email: string, password: string, confirmPassword: string, accountType: 'business' | 'individual') {
  if (password !== confirmPassword) {
    showAuthError('Passwords do not match')
    return false
  }
  
  if (password.length < 6) {
    showAuthError('Password must be at least 6 characters')
    return false
  }
  
  const users = load<Record<string, { password: string; userType: 'business' | 'individual' }>>('ws.users') ?? {}
  
  if (users[email]) {
    showAuthError('User already exists. Please login instead.')
    return false
  }
  
  users[email] = { password, userType: accountType }
  save('ws.users', users)
  
  isAuthenticated = true
  currentUser = email
  userType = accountType
  save(STORAGE_KEYS.isAuthenticated, true)
  save(STORAGE_KEYS.currentUser, email)
  save(STORAGE_KEYS.userType, userType)
  showApp()
  return true
}

function updateTabsForUserType() {
  const businessTabs = qsa<HTMLButtonElement>('.business-tab')
  const individualTabs = qsa<HTMLButtonElement>('.individual-tab')
  
  if (userType === 'business') {
    // Show business tabs, hide individual tabs
    businessTabs.forEach(tab => tab.style.display = 'flex')
    individualTabs.forEach(tab => tab.style.display = 'none')
    
    // Apply role-based access control for business users
    if (currentUserRole) {
      businessTabs.forEach(tab => {
        const targetView = tab.dataset.target
        if (currentUserRole === 'admin') {
          // Admin can see all tabs
          tab.style.display = 'flex'
        } else if (currentUserRole === 'cashier') {
          // Cashier can see only Cashier and Orders
          if (targetView === 'cashierView' || targetView === 'ordersView') {
            tab.style.display = 'flex'
          } else {
            tab.style.display = 'none'
          }
        } else if (currentUserRole === 'observer') {
          // Observer can see only Orders
          if (targetView === 'ordersView') {
            tab.style.display = 'flex'
          } else {
            tab.style.display = 'none'
          }
        } else {
          // Default: show all if role is not set
          tab.style.display = 'flex'
        }
      })
    }
    
    // Set first visible business tab as active if no active tab
    const visibleTabs = Array.from(businessTabs).filter(t => window.getComputedStyle(t).display !== 'none')
    const activeTab = visibleTabs.find(t => t.classList.contains('active'))
    if (!activeTab && visibleTabs.length > 0) {
      visibleTabs[0].classList.add('active')
      const target = visibleTabs[0].dataset.target
      if (target) {
        views.forEach(v => v.classList.remove('active'))
        const targetView = qs<HTMLElement>('#' + target)
        if (targetView) {
          targetView.classList.add('active')
          headerTitle.textContent = visibleTabs[0].textContent?.trim() ?? ''
        }
      }
    }
  } else {
    // Show individual tabs, hide business tabs
    businessTabs.forEach(tab => tab.style.display = 'none')
    individualTabs.forEach(tab => tab.style.display = 'flex')
    
    // Set first individual tab as active if no active tab
    const activeTab = Array.from(individualTabs).find(t => t.classList.contains('active'))
    if (!activeTab && individualTabs.length > 0) {
      individualTabs[0].classList.add('active')
      const target = individualTabs[0].dataset.target
      if (target) {
        views.forEach(v => v.classList.remove('active'))
        const targetView = qs<HTMLElement>('#' + target)
        if (targetView) {
          targetView.classList.add('active')
          headerTitle.textContent = individualTabs[0].textContent?.trim() ?? ''
        }
      }
    }
  }
}

function updateUserInfo() {
  if (userName) {
    // Get the user's name from stored users data
    const users = load<Record<string, { password: string; userType: 'business' | 'individual'; name?: string; role?: 'admin' | 'cashier' | 'observer' }>>('ws.users') ?? {}
    const user = currentUser ? users[currentUser] : null
    const displayName = user?.name || currentUser || 'User'
    userName.textContent = displayName
  }
  if (userTypeBadge) {
    userTypeBadge.textContent = userType === 'business' ? 'Business' : 'Individual'
  }
}

function showApp() {
  if (authView) authView.style.display = 'none'
  if (appHeader) appHeader.style.display = 'flex'
  if (appMain) appMain.style.display = 'block'
  if (appTabbar) appTabbar.style.display = 'grid'
  
  // Update user info
  updateUserInfo()
  
  // Show/hide tabs based on user type
  updateTabsForUserType()
  
  // Re-initialize settings tabs to ensure event listeners are attached
  initSettingsTabs()
  
  // Ensure Add User button has event listener
  const addUserBtn = qs<HTMLButtonElement>('#addUserBtn')
  if (addUserBtn && !addUserBtn.onclick) {
    addUserBtn.addEventListener('click', () => openUserDialog())
  }
}

function handleLogout() {
  isAuthenticated = false
  currentUser = ''
  userType = 'business'
  save(STORAGE_KEYS.isAuthenticated, false)
  save(STORAGE_KEYS.currentUser, '')
  save(STORAGE_KEYS.userType, 'business')
  showAuth()
}

function showAuth() {
  if (authView) authView.style.display = 'block'
  if (appHeader) appHeader.style.display = 'none'
  if (appMain) appMain.style.display = 'none'
  if (appTabbar) appTabbar.style.display = 'none'
}

// Auth event listeners
loginTabBtn?.addEventListener('click', () => switchAuthMode('login'))
signupTabBtn?.addEventListener('click', () => switchAuthMode('signup'))
businessTypeBtn?.addEventListener('click', () => switchUserType('business'))
individualTypeBtn?.addEventListener('click', () => switchUserType('individual'))

loginFormElement?.addEventListener('submit', (e) => {
  e.preventDefault()
  const data = new FormData(loginFormElement)
  const email = (data.get('email') as string).trim()
  const password = data.get('password') as string
  handleLogin(email, password)
})

signupFormElement?.addEventListener('submit', (e) => {
  e.preventDefault()
  const data = new FormData(signupFormElement)
  const email = (data.get('email') as string).trim()
  const password = data.get('password') as string
  const confirmPassword = data.get('confirmPassword') as string
  const accountType = (data.get('userType') as 'business' | 'individual') || 'business'
  handleSignup(email, password, confirmPassword, accountType)
})

// Header settings button handler
headerSettingsBtn?.addEventListener('click', () => {
  // Switch to settings view
  const settingsViewId = 'settingsView'
  const targetView = qs<HTMLElement>('#' + settingsViewId)
  if (targetView) {
    // Find and activate the settings tab (only for business users)
    if (userType === 'business') {
      const settingsTab = Array.from(tabs).find(t => t.dataset.target === settingsViewId && t.classList.contains('business-tab'))
      if (settingsTab) {
        tabs.forEach((x) => x.classList.remove('active'))
        settingsTab.classList.add('active')
      }
    }
    
    views.forEach((v) => v.classList.remove('active'))
    targetView.classList.add('active')
    headerTitle.textContent = 'Settings'
    save(STORAGE_KEYS.currentView, settingsViewId)
    
    // Hide search bars and back button
    if (cashierSearch) cashierSearch.style.display = 'none'
    if (inventorySearch) inventorySearch.style.display = 'none'
    if (headerBackBtn) headerBackBtn.style.display = 'none'
    if (addItemFab) addItemFab.style.display = 'none'
    
    // Render settings
    renderSettings()
  }
})

// Logout button handler
logoutBtnHeader?.addEventListener('click', () => {
  handleLogout()
})

// Check authentication on load
if (isAuthenticated) {
  showApp()
} else {
  showAuth()
}

// Init
if (isAuthenticated) {
  renderCategoryFilter()
renderProducts()
renderCart()
  renderOrders()
  renderSettings()
populateCategoryDatalist()
  populateSellableCategoryFilter()
  renderExpenses()
  renderSellableTable()
}

// Individual view render functions
function renderStores() {
  if (!storesContainer) return
  storesContainer.innerHTML = `
    <div style="text-align: center; padding: 40px 20px;">
      <h3 style="margin: 0 0 16px 0; color: var(--text);">Browse Stores</h3>
      <p style="margin: 0; color: var(--muted);">Available stores will appear here.</p>
    </div>
  `
}

function renderIndividualOrders() {
  if (!individualOrdersContainer) return
  individualOrdersContainer.innerHTML = `
    <div style="text-align: center; padding: 40px 20px;">
      <h3 style="margin: 0 0 16px 0; color: var(--text);">My Orders</h3>
      <p style="margin: 0; color: var(--muted);">Your order history will appear here.</p>
    </div>
  `
}

function renderHistory() {
  if (!historyContainer) return
  historyContainer.innerHTML = `
    <div style="text-align: center; padding: 40px 20px;">
      <h3 style="margin: 0 0 16px 0; color: var(--text);">Purchase History</h3>
      <p style="margin: 0; color: var(--muted);">Your purchase history will appear here.</p>
    </div>
  `
}

function renderIndividualReports() {
  if (!individualReportsContainer) return
  individualReportsContainer.innerHTML = `
    <div style="text-align: center; padding: 40px 20px;">
      <h3 style="margin: 0 0 16px 0; color: var(--text);">My Reports</h3>
      <p style="margin: 0; color: var(--muted);">Your reports and analytics will appear here.</p>
    </div>
  `
}

// Tab switching
tabs.forEach((t) =>
  t.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Only handle clicks on visible tabs
    const computedStyle = window.getComputedStyle(t)
    if (computedStyle.display === 'none') return
    
    tabs.forEach((x) => x.classList.remove('active'))
    t.classList.add('active')
    const id = t.dataset.target
    if (!id) return
    
    views.forEach((v) => v.classList.remove('active'))
    const targetView = qs<HTMLElement>('#' + id)
    if (targetView && headerTitle) {
      targetView.classList.add('active')
    headerTitle.textContent = t.textContent?.trim() ?? ''
      save(STORAGE_KEYS.currentView, id)
      if (headerBackBtn) headerBackBtn.dataset.reorder = 'false'
      
      // Render individual views if needed
      if (id === 'storesView') {
        renderStores()
      } else if (id === 'individualOrdersView') {
        renderIndividualOrders()
      } else if (id === 'historyView') {
        renderHistory()
      } else if (id === 'individualReportsView') {
        renderIndividualReports()
      }
      
      // Hide/show search bars and back button based on view
      if (id === 'cashierView') {
        cashierSearch.style.display = 'block'
        inventorySearch.style.display = 'none'
        headerBackBtn.style.display = 'none'
        addItemFab.style.display = 'none'
      } else if (id === 'expenseView') {
        cashierSearch.style.display = 'none'
        // Search bar visibility controlled by expense sub-view
        const savedExpenseView = load<string>(STORAGE_KEYS.expenseView)
        if (savedExpenseView === 'items') {
          addItemFab.style.display = 'flex'
        } else {
          addItemFab.style.display = 'none'
        }
        // Restore expense tab
        const savedExpenseTab = load<string>(STORAGE_KEYS.expenseTab) || 'sellable'
        switchExpenseTab(savedExpenseTab)
      } else {
        cashierSearch.style.display = 'none'
        inventorySearch.style.display = 'none'
        headerBackBtn.style.display = 'none'
        addItemFab.style.display = 'none'
      }
      
      if (id === 'expenseView') {
        showInventoryCategories()
        renderInventory()
      }
      if (id === 'ordersView') renderOrders()
    if (id === 'reportsView') renderReports()
      if (id === 'settingsView') renderSettings()
      if (id === 'expenseView') {
        const savedExpenseTab = load<string>(STORAGE_KEYS.expenseTab) || 'sellable'
        if (savedExpenseTab === 'operational') {
          renderExpenses()
        }
      }
    }
  })
)

// Expense tab switching
function switchExpenseTab(tabName: 'sellable' | 'operational') {
  expenseTabs.forEach(tab => {
    if (tab.dataset.expenseTab === tabName) {
      tab.classList.add('active')
    } else {
      tab.classList.remove('active')
    }
  })
  
  expenseTabContents.forEach(content => {
    if (content.id === `${tabName}View`) {
      content.classList.add('active')
    } else {
      content.classList.remove('active')
    }
  })
  
  save(STORAGE_KEYS.expenseTab, tabName)
}

expenseTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.expenseTab as 'sellable' | 'operational'
    switchExpenseTab(tabName)
    if (tabName === 'operational') {
      renderExpenses()
    } else if (tabName === 'sellable') {
      renderSellableTable()
    }
  })
})

// Report tab switching
function switchReportTab(tabName: 'general' | 'income' | 'balance' | 'cashflow') {
  reportTabs.forEach(tab => {
    if (tab.dataset.reportTab === tabName) {
      tab.classList.add('active')
    } else {
      tab.classList.remove('active')
    }
  })
  
  reportTabContents.forEach(content => {
    if (content.id === `${tabName}ReportView`) {
      content.classList.add('active')
    } else {
      content.classList.remove('active')
    }
  })
  
  save(STORAGE_KEYS.reportTab, tabName)
}

reportTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.reportTab as 'general' | 'income' | 'balance' | 'cashflow'
    switchReportTab(tabName)
  })
})
  
  // Initialize settings tab elements after DOM is ready
function initSettingsTabs() {
  settingsTabs = qsa<HTMLButtonElement>('.expense-tab[data-settings-tab]')
  storeProfileView = qs<HTMLDivElement>('#storeProfileView')
  usersView = qs<HTMLDivElement>('#usersView')
  settingsTabContents = qsa<HTMLDivElement>('#storeProfileView, #usersView')
  storeProfileContainer = qs<HTMLDivElement>('#storeProfileContainer')
  usersContainer = qs<HTMLDivElement>('#usersContainer')
  addUserBtn = qs<HTMLButtonElement>('#addUserBtn')
  usersList = qs<HTMLDivElement>('#usersList')
  
  // Attach event listeners after elements are initialized
  const tabs = Array.isArray(settingsTabs) ? settingsTabs : Array.from(settingsTabs)
  if (tabs.length > 0) {
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.settingsTab as 'storeProfile' | 'users'
        switchSettingsTab(tabName)
      })
    })
  }
  
}

// Operational Expenses event listeners
if (addExpenseBtn) addExpenseBtn.addEventListener('click', () => openExpenseDialog())
if (expenseForm) expenseForm.addEventListener('submit', saveExpenseFromDialog)
if (closeExpenseDialogBtn) closeExpenseDialogBtn.addEventListener('click', () => expenseDialog?.close())
if (cancelExpenseBtn) cancelExpenseBtn.addEventListener('click', () => expenseDialog?.close())
if (expenseSearch) expenseSearch.addEventListener('input', renderExpenses)
if (expenseStartDate) expenseStartDate.addEventListener('change', renderExpenses)
if (expenseEndDate) expenseEndDate.addEventListener('change', renderExpenses)
if (clearExpenseFiltersBtn) clearExpenseFiltersBtn.addEventListener('click', clearExpenseFilters)

// Restore last view on load
let savedView = load<string>(STORAGE_KEYS.currentView)
if (savedView === 'salesView') {
  savedView = 'cashierView'
  save(STORAGE_KEYS.currentView, savedView)
}
if (!savedView) {
  savedView = userType === 'business' ? 'cashierView' : 'storesView'
}

if (savedView) {
  tabs.forEach((x) => x.classList.remove('active'))
  
  // Filter tabs based on user type
  const visibleTabs = userType === 'business' 
    ? Array.from(tabs).filter(t => t.classList.contains('business-tab'))
    : Array.from(tabs).filter(t => t.classList.contains('individual-tab'))
  
  const activeTab = visibleTabs.find(t => t.dataset.target === savedView) || visibleTabs[0]
  if (activeTab) {
    activeTab.classList.add('active')
    const targetId = activeTab.dataset.target || savedView
    views.forEach((v) => v.classList.remove('active'))
    const targetView = qs<HTMLElement>('#' + targetId)
    if (targetView) {
      targetView.classList.add('active')
      headerTitle.textContent = activeTab.textContent?.trim() ?? ''
      
      // Render individual views if needed
      if (targetId === 'storesView') {
        renderStores()
      } else if (targetId === 'individualOrdersView') {
        renderIndividualOrders()
      } else if (targetId === 'historyView') {
        renderHistory()
      } else if (targetId === 'individualReportsView') {
        renderIndividualReports()
      }
      
      if (targetId === 'cashierView') {
        cashierSearch.style.display = 'block'
      } else if (targetId === 'expenseView' || targetId === 'inventoryView') {
        const savedExpenseView = load<string>(STORAGE_KEYS.expenseView) || load<string>('ws.inventoryView')
        const savedCategory = load<string>(STORAGE_KEYS.selectedInventoryCategory)
        const savedExpenseTab = load<string>(STORAGE_KEYS.expenseTab) || 'sellable'
        switchExpenseTab(savedExpenseTab)
        
        if (savedExpenseTab === 'operational') {
          renderExpenses()
        } else {
          if (savedExpenseView === 'manage') {
            showManageCategories()
          } else if (savedExpenseView === 'items') {
            if (savedCategory) {
              selectedInventoryCategory = savedCategory
            }
            showInventoryItems()
          } else {
            showInventoryCategories()
          }
          renderInventory()
        }
      }
    }
  }
  
  if (savedView === 'reportsView') {
    renderReports()
    const savedReportTab = load<string>(STORAGE_KEYS.reportTab) || 'general'
    switchReportTab(savedReportTab)
  } else if (savedView === 'ordersView') {
    renderOrders()
  } else if (savedView === 'settingsView') {
    renderSettings()
  } else if (savedView === 'reorderView') {
    openReorderView()
  }
} else {
  // Default to cashier view
  cashierSearch.style.display = 'block'
}

// Settings tab switching function - must be after variable declarations
function switchSettingsTab(tabName: 'storeProfile' | 'users') {
  const tabs = Array.isArray(settingsTabs) ? settingsTabs : Array.from(settingsTabs)
  if (tabs.length === 0 || settingsTabContents.length === 0) return
  
  tabs.forEach(tab => {
    if (tab.dataset.settingsTab === tabName) {
      tab.classList.add('active')
    } else {
      tab.classList.remove('active')
    }
  })
  
  settingsTabContents.forEach(content => {
    if (content.id === `${tabName}View`) {
      content.classList.add('active')
    } else {
      content.classList.remove('active')
    }
  })
  
  save(STORAGE_KEYS.settingsTab, tabName)
  
  // Render content based on tab
  if (tabName === 'users') {
    renderUsers()
  }
}

// Initialize settings tabs when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSettingsTabs)
} else {
  // DOM already loaded
  initSettingsTabs()
}

// User Dialog event listeners - attach at module level
if (userForm) userForm.addEventListener('submit', saveUserFromDialog)
if (closeUserDialogBtn) closeUserDialogBtn.addEventListener('click', () => userDialog?.close())
if (cancelUserBtn) cancelUserBtn.addEventListener('click', () => userDialog?.close())

// Cashier interactions
cashierSearch.addEventListener('input', renderProducts)
categoryFilter.addEventListener('change', () => {
  selectedCategory = categoryFilter.value
  renderProducts()
})
completeSaleBtn.addEventListener('click', completeSale)
cartToggle.addEventListener('click', () => {
  cartPanel.classList.toggle('collapsed')
})
cartModeToggle.addEventListener('click', () => {
  cartMode = cartMode === 'sale' ? 'order' : 'sale'
  save(STORAGE_KEYS.cartMode, cartMode)
  updateCartModeUI()
})
closeReceiptBtn.addEventListener('click', () => receiptDialog.close())
whatsappReceiptBtn.addEventListener('click', shareReceiptWhatsApp)
downloadReceiptBtn.addEventListener('click', downloadReceiptPDF)

// Inventory interactions
inventorySearch.addEventListener('input', () => {
  if (inventoryItemsView.style.display !== 'none') {
    renderInventoryItems()
  }
})
addItemFab.addEventListener('click', () => openItemDialog())
itemForm.addEventListener('submit', saveItemFromDialog)
cancelItemBtn.addEventListener('click', () => itemDialog.close())
deleteItemBtn.addEventListener('click', () => {
  const itemId = (itemForm.elements.namedItem('id') as HTMLInputElement).value
  if (!itemId) return
  
  const item = inventory.find(i => i.id === itemId)
  if (!item) return
  
  if (confirm(`Delete "${item.name}"?\n\nThis action cannot be undone.`)) {
    // Remove item from inventory
    inventory = inventory.filter(i => i.id !== itemId)
    persist()
    itemDialog.close()
    
    // Refresh views
    renderInventoryCategories()
    renderInventory()
    renderCategoryFilter()
      renderProducts()
    renderReports()
    
    console.log(`🗑️  Deleted item: ${item.name}`)
  }
})
headerBackBtn.addEventListener('click', () => {
  if (headerBackBtn.dataset.reorder === 'true') {
    headerBackBtn.dataset.reorder = 'false'
    tabs.forEach((x) => x.classList.remove('active'))
    const expenseTab = Array.from(tabs).find(t => t.dataset.target === 'expenseView')
    if (expenseTab) {
      expenseTab.classList.add('active')
    }
    views.forEach((v) => v.classList.remove('active'))
    qs<HTMLElement>('#expenseView').classList.add('active')
    headerTitle.textContent = expenseTab?.textContent?.trim() ?? 'Expense'
    save(STORAGE_KEYS.currentView, 'expenseView')
    switchExpenseTab('sellable')
    showInventoryCategories()
    renderInventory()
    inventorySearch.style.display = 'none'
    cashierSearch.style.display = 'none'
    headerBackBtn.style.display = 'none'
    addItemFab.style.display = 'none'
    return
  }

  const savedExpenseView = load<string>(STORAGE_KEYS.expenseView) || load<string>('ws.inventoryView')
  if (savedExpenseView === 'manage' || savedExpenseView === 'items') {
    showInventoryCategories()
  }
})
addCategoryBtn.addEventListener('click', openAddCategoryDialog)
addCategoryForm.addEventListener('submit', (e) => {
  e.preventDefault()
  addCategory()
})
cancelAddCategoryBtn.addEventListener('click', () => addCategoryDialog.close())

// Image upload/capture
function handleImageSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (event) => {
    const dataUrl = event.target?.result as string
    itemImagePreview.src = dataUrl
    itemImageData.value = dataUrl
  }
  reader.readAsDataURL(file)
}

uploadImageBtn.addEventListener('click', () => itemImageUpload.click())
captureImageBtn.addEventListener('click', () => itemImageCapture.click())
itemImageUpload.addEventListener('change', handleImageSelect)
itemImageCapture.addEventListener('change', handleImageSelect)

// Category management
renameCategoryForm.addEventListener('submit', (e) => {
  e.preventDefault()
  renameCategory()
})
cancelRenameBtn.addEventListener('click', () => renameCategoryDialog.close())
confirmDeleteBtn.addEventListener('click', deleteCategory)
cancelDeleteBtn.addEventListener('click', () => deleteCategoryDialog.close())

function getAllCategories(): string[] {
  const inventoryCategories = unique(inventory.map((i) => i.category))
  const combined = unique([...inventoryCategories, ...customCategories, 'Other'])
  return combined.sort((a, b) => {
    if (a === 'Other') return 1
    if (b === 'Other') return -1
    return a.localeCompare(b, undefined, { sensitivity: 'base' })
  })
}

function renderCategoryFilter() {
  const categories = ['All', ...getAllCategories()]
  categoryFilter.innerHTML = ''
  categories.forEach((c) => {
    const option = h('option', { value: c })
    option.textContent = c === 'All' ? 'All Categories' : c
    if (c === selectedCategory) option.selected = true
    categoryFilter.appendChild(option)
  })
}

// Audio context for generating phone dial tones
let audioContext: AudioContext | null = null

function initAudioContext() {
  if (!audioContext && typeof AudioContext !== 'undefined') {
    audioContext = new AudioContext()
  } else if (!audioContext && typeof (window as any).webkitAudioContext !== 'undefined') {
    audioContext = new (window as any).webkitAudioContext()
  }
}

function playDialTone() {
  if (!audioContext) {
    initAudioContext()
    if (!audioContext) return
  }
  
  // Resume audio context if suspended (required by some browsers)
  if (audioContext.state === 'suspended') {
    audioContext.resume()
  }
  
  // Generate a random DTMF-like tone (using phone dial frequencies)
  // Randomly select one of the DTMF frequencies for variety
  const frequencies = [
    [697, 1209], [697, 1336], [697, 1477], // Row 1
    [770, 1209], [770, 1336], [770, 1477], // Row 2
    [852, 1209], [852, 1336], [852, 1477], // Row 3
    [941, 1209], [941, 1336], [941, 1477], // Row 4
  ]
  
  const selectedFreqs = frequencies[Math.floor(Math.random() * frequencies.length)]
  const duration = 0.1 // 100ms tone
  
  selectedFreqs.forEach((freq) => {
    const oscillator = audioContext!.createOscillator()
    const gainNode = audioContext!.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext!.destination)
    
    oscillator.frequency.value = freq
    oscillator.type = 'sine'
    
    gainNode.gain.setValueAtTime(0.3, audioContext!.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext!.currentTime + duration)
    
    oscillator.start(audioContext!.currentTime)
    oscillator.stop(audioContext!.currentTime + duration)
  })
}

function vibrate(pattern: number | number[] = 10) {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(pattern)
    } catch (e) {
      // Vibration API not supported or failed
    }
  }
}

// Cache for the cash register audio
let cashRegisterAudio: HTMLAudioElement | null = null

function playCashRegisterSound() {
  // Create audio element if it doesn't exist
  if (!cashRegisterAudio) {
    cashRegisterAudio = new Audio('./soundfx/videoplayback.m4a')
    cashRegisterAudio.volume = 0.7
    cashRegisterAudio.preload = 'auto'
  }
  
  // Play the sound (reset to start if already playing)
  cashRegisterAudio.currentTime = 0
  cashRegisterAudio.play().catch((err) => {
    console.warn('Could not play cash register sound:', err)
  })
}

function showAddToCartAnimation(element: HTMLElement) {
  const rect = element.getBoundingClientRect()
  const animEl = document.createElement('div')
  animEl.textContent = '+1'
  animEl.style.cssText = `
    position: fixed;
    left: ${rect.left + rect.width / 2}px;
    top: ${rect.top + rect.height / 2}px;
    transform: translate(-50%, -50%);
    font-size: 24px;
    font-weight: 700;
    color: #2563eb;
    pointer-events: none;
    z-index: 1000;
    opacity: 1;
    transition: all 0.6s ease-out;
  `
  document.body.appendChild(animEl)
  
  // Trigger animation on next frame
  requestAnimationFrame(() => {
    animEl.style.transform = `translate(-50%, -${rect.height / 2 + 40}px)`
    animEl.style.opacity = '0'
  })
  
  // Remove element after animation
  setTimeout(() => {
    document.body.removeChild(animEl)
  }, 600)
}

function updateCartModeUI() {
  if (cartModeLabel) {
    cartModeLabel.textContent = cartMode === 'sale' ? '(Sale)' : '(Order)'
  }
  if (cartModeToggle) {
    cartModeToggle.textContent = cartMode === 'sale' ? 'Switch to Order' : 'Switch to Sale'
    cartModeToggle.setAttribute('aria-pressed', cartMode === 'order' ? 'true' : 'false')
    cartModeToggle.setAttribute('title', cartMode === 'sale' ? 'Switch cart to order mode' : 'Switch cart to sale mode')
    cartModeToggle.classList.toggle('sale', cartMode === 'sale')
    cartModeToggle.classList.toggle('order', cartMode === 'order')
  }
  if (completeSaleBtn) {
    completeSaleBtn.textContent = cartMode === 'sale' ? 'Complete Sale' : 'Complete Order'
  }
}

function renderProducts() {
  const term = cashierSearch.value.toLowerCase()
  const filtered = inventory.filter(
    (i) => (selectedCategory === 'All' || i.category === selectedCategory) && (i.name.toLowerCase().includes(term) || i.category.toLowerCase().includes(term))
  )
  productGrid.innerHTML = ''
  filtered.forEach((item) => {
    const card = h('div', { class: 'product' })
    const img = h('img', { class: 'thumb', alt: item.name, src: item.image || pic(Number(item.id.slice(-3))) })
    const body = h('div', { class: 'body' })
    body.append(
      h('div', { class: 'title' }, item.name),
      h('div', { class: 'muted' }, `${item.stock} in stock`),
      h('div', { class: 'price' }, fmt(item.price))
    )
    card.append(img, body)
    card.addEventListener('click', () => {
      playDialTone()
      vibrate(10)
      showAddToCartAnimation(card)
      addToCart(item.id)
    })
    productGrid.appendChild(card)
  })
}

function renderCart() {
  updateCartModeUI()
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
  const total = subtotal + tax
  cartTaxEl.textContent = fmt(tax)
  cartTotalEl.textContent = fmt(total)
  completeSaleBtn.disabled = entries.length === 0
  
  // Update cart header summary (mobile)
  const totalItems = entries.reduce((sum, [, qty]) => sum + qty, 0)
  cartHeaderCount.textContent = `${totalItems} item${totalItems !== 1 ? 's' : ''}`
  cartHeaderTotal.textContent = fmtNoCents(total)
}

function changeQty(id: string, delta: number) {
  const cur = cart[id] || 0
  const newQty = cur + delta
  if (newQty <= 0) delete cart[id]
  else {
    const item = inventory.find((i) => i.id === id)!
    cart[id] = Math.min(newQty, item.stock)
  }
  save(STORAGE_KEYS.cart, cart)
  renderCart()
}

function addToCart(id: string) {
  const item = inventory.find((i) => i.id === id)
  if (!item || item.stock <= 0) return
  cart[id] = Math.min((cart[id] || 0) + 1, item.stock)
  save(STORAGE_KEYS.cart, cart)
  renderCart()
}

async function saveSaleToSupabase(tx: Transaction) {
  if (!supabase) {
    console.warn('⚠ Supabase client not initialized. Sale not saved to database.')
    return false
  }
  
  try {
    console.log('💾 Saving sale to Supabase:', tx.id, 'Items:', tx.items.length)
    
    // Create one entry per item in the sale
    const entries = tx.items.map((item, index) => {
      // Generate unique timestamp with microsecond precision for each item
      const itemDate = new Date(new Date(tx.date).getTime() + index)
      
      return {
        transaction_id: tx.id,
        date: itemDate.toISOString(),
        item_id: item.itemId,
        item_name: item.name,
        quantity: item.qty,
        item_price: item.price,
        item_cost: item.cost,
        item_subtotal: item.price * item.qty,
        item_profit: (item.price - item.cost) * item.qty,
        // Transaction totals (repeated for each item)
        transaction_subtotal: tx.subtotal,
        transaction_tax: tx.tax,
        transaction_total: tx.total,
        transaction_profit: tx.profit,
      }
    })
    
    console.log('📤 Inserting', entries.length, 'entries:', entries)
    
    const { data, error } = await supabase
      .from('sales')
      .insert(entries)
      .select()
    
    if (error) {
      console.error('❌ Failed to save sale to Supabase:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      return false
    }
    
    console.log('✅ Sale saved successfully to Supabase:', data)
    return true
  } catch (err) {
    console.error('❌ Error saving sale to Supabase:', err)
    return false
  }
}

async function getCustomerName(): Promise<string | null> {
  return new Promise((resolve) => {
    if (!customerNameDialog || !customerNameForm || !customerNameInput || !cancelCustomerNameBtn) {
      resolve(null)
      return
    }
    
    // Reset form
    customerNameInput.value = ''
    
    // Handle form submission
    const handleSubmit = (e: Event) => {
      e.preventDefault()
      const name = customerNameInput.value.trim()
      customerNameDialog.close()
      customerNameForm.removeEventListener('submit', handleSubmit)
      cancelCustomerNameBtn.removeEventListener('click', handleCancel)
      resolve(name || null)
    }
    
    // Handle cancel
    const handleCancel = () => {
      customerNameDialog.close()
      customerNameForm.removeEventListener('submit', handleSubmit)
      cancelCustomerNameBtn.removeEventListener('click', handleCancel)
      resolve(null)
    }
    
    customerNameForm.addEventListener('submit', handleSubmit)
    cancelCustomerNameBtn.addEventListener('click', handleCancel)
    
    // Show modal and focus input
    customerNameDialog.showModal()
    setTimeout(() => customerNameInput.focus(), 100)
  })
}

async function completeSale() {
  const entries = Object.entries(cart)
  if (!entries.length) return
  
  // If in order mode, prompt for customer name via modal
  let customerName: string | null = null
  if (cartMode === 'order') {
    customerName = await getCustomerName()
    if (customerName === null) {
      // User cancelled
      return
    }
  }
  
  // Play cash register sound
  playCashRegisterSound()
  vibrate([20, 10, 20]) // Longer vibration pattern for sale completion
  
  let subtotal = 0
  let profit = 0
  const items: TransactionItem[] = entries.map(([id, qty]) => {
    const it = inventory.find((x) => x.id === id)!
    subtotal += it.price * qty
    profit += (it.price - it.cost) * qty
    // Only reduce stock for sales, not orders
    if (cartMode === 'sale') {
    it.stock -= qty
    soldTally[id] = (soldTally[id] || 0) + qty
    }
    return { itemId: id, name: it.name, qty, price: it.price, cost: it.cost }
  })
  const tax = subtotal * TAX_RATE
  const total = subtotal + tax
  
  // Generate transaction ID - use order number for orders, regular counter for sales
  let txId: string
  if (cartMode === 'order') {
    // For orders, use daily resetting order number (0001, 0002, etc.)
    const orderNumber = getNextOrderNumber()
    txId = orderNumber
  } else {
    // For sales, use regular sequential counter
    const txCounter = load<number>(STORAGE_KEYS.transactionCounter) ?? 0
    const newCounter = txCounter + 1
    save(STORAGE_KEYS.transactionCounter, newCounter)
    txId = `waia${newCounter}`
  }
  
  const tx: Transaction = {
    id: txId,
    date: new Date().toISOString(), 
    items, 
    subtotal, 
    tax, 
    total, 
    profit, 
    mode: cartMode,
    customerName: customerName || undefined,
    cashierName: currentUser || undefined
  }
  transactions.unshift(tx)
  cart = {}
  save(STORAGE_KEYS.cart, cart)
  persist()
  
  // Save to Supabase and get result
  const saved = await saveSaleToSupabase(tx)
  
  renderProducts()
  renderCart()
  renderReports()
  renderInventory()
  renderReorder()
  renderOrders()
  showReceipt(tx, saved)
}

// Inventory
function renderInventoryCategories() {
  const categories = getAllCategories()
  inventoryCategories.innerHTML = ''
  const lowStockItems = inventory.filter(item => {
    const lowPoint = item.lowPoint ?? LOW_STOCK_THRESHOLD
    return item.stock <= lowPoint
  })
  
  // Add Reorder card
  const reorderCard = h('div', { class: 'product reorder-card' })
  const reorderImg = h('img', {
    class: 'thumb',
    alt: 'Reorder Suggestions',
    src: getReorderImage()
  })
  const reorderBody = h('div', { class: 'body' })
  reorderBody.append(
    h('div', { class: 'title', style: 'font-weight: 700; color: #2563eb;' }, 'Reorder'),
    h('div', { style: 'font-size: 9px; color: #6b7280; margin: 2px 0;' }, `${lowStockItems.length} item${lowStockItems.length === 1 ? '' : 's'} need attention`),
    h('div', { class: 'muted', style: 'font-size: 9px;' }, 'View low stock & restock recommendations')
  )
  reorderCard.append(reorderImg, reorderBody)
  reorderCard.addEventListener('click', openReorderView)
  inventoryCategories.appendChild(reorderCard)
  
  // Add "Manage Categories" button - matching product style
  const totalInventoryValue = inventory.reduce((sum, item) => sum + item.price, 0)
  const manageBtn = h('div', { class: 'product manage-card' })
  const manageImg = h('img', { 
    class: 'thumb', 
    alt: 'Manage Categories', 
    src: getSettingsImage()
  })
  const manageBody = h('div', { class: 'body' })
  manageBody.append(
    h('div', { class: 'title', style: 'font-weight: 700; color: #2563eb;' }, 'Manage Categories'),
    h('div', { style: 'font-size: 9px; color: #6b7280; margin: 2px 0;' }, `${categories.length} categories`),
    h('div', { class: 'muted', style: 'font-size: 9px;' }, `Value: ${fmtNoCents(totalInventoryValue)}`)
  )
  manageBtn.append(manageImg, manageBody)
  manageBtn.addEventListener('click', showManageCategories)
  inventoryCategories.appendChild(manageBtn)
  
  // Add category buttons - matching product style
  categories.forEach((category) => {
    const categoryItems = inventory.filter(i => i.category === category)
    const totalStock = categoryItems.reduce((sum, item) => sum + item.stock, 0)
    const totalValue = categoryItems.reduce((sum, item) => sum + item.price, 0)
    
    const card = h('div', { class: 'product' })
    const img = h('img', { 
      class: 'thumb', 
      alt: category, 
      src: getCategoryImage(category)
    })
    const body = h('div', { class: 'body' })
    body.append(
      h('div', { class: 'title', style: 'font-weight: 700; color: #2563eb;' }, category),
      h('div', { style: 'font-size: 9px; color: #6b7280; margin: 2px 0;' }, `${categoryItems.length} item${categoryItems.length !== 1 ? 's' : ''} • ${totalStock} total`),
      h('div', { class: 'muted', style: 'font-size: 9px;' }, `Value: ${fmtNoCents(totalValue)}`)
    )
    card.append(img, body)
    card.addEventListener('click', () => {
      selectedInventoryCategory = category
      showInventoryItems()
    })
    inventoryCategories.appendChild(card)
  })
}

function showInventoryItems() {
  inventoryCategories.style.display = 'none'
  inventoryItemsView.style.display = 'block'
  manageCategoriesView.style.display = 'none'
  save(STORAGE_KEYS.expenseView, 'items')
  save(STORAGE_KEYS.selectedInventoryCategory, selectedInventoryCategory)
  headerBackBtn.style.display = 'block'
  headerBackBtn.dataset.reorder = 'false'
  inventorySearch.style.display = 'block'
  addItemFab.style.display = 'flex'
  headerTitle.textContent = selectedInventoryCategory || 'All Items'
  renderInventoryItems()
}

function showInventoryCategories() {
  selectedInventoryCategory = null
  inventoryItemsView.style.display = 'none'
  manageCategoriesView.style.display = 'none'
  inventoryCategories.style.display = 'grid'
  save(STORAGE_KEYS.expenseView, 'categories')
  headerBackBtn.style.display = 'none'
  headerBackBtn.dataset.reorder = 'false'
  inventorySearch.style.display = 'none'
  addItemFab.style.display = 'none'
  headerTitle.textContent = 'Expense'
}

function showManageCategories() {
  inventoryCategories.style.display = 'none'
  inventoryItemsView.style.display = 'none'
  manageCategoriesView.style.display = 'block'
  save(STORAGE_KEYS.expenseView, 'manage')
  headerBackBtn.style.display = 'block'
  headerBackBtn.dataset.reorder = 'false'
  inventorySearch.style.display = 'none'
  addItemFab.style.display = 'none'
  headerTitle.textContent = 'Manage Categories'
  renderManageCategories()
}

function renderManageCategories() {
  const categories = getAllCategories()
  categoryManageList.innerHTML = ''
  
  categories.forEach(category => {
    const categoryItems = inventory.filter(i => i.category === category)
    const itemCount = categoryItems.length
    const totalStock = categoryItems.reduce((sum, item) => sum + item.stock, 0)
    
    const li = h('li', { class: 'category-manage-item' })
    
    const info = h('div', { class: 'category-info' })
    info.append(
      h('div', { class: 'category-name' }, category),
      h('div', { class: 'category-details' }, `${itemCount} items • ${totalStock} in stock`)
    )
    
    const actions = h('div', { class: 'category-actions' })
    
    const renameBtn = h('button', { class: 'btn' })
    renameBtn.textContent = 'Rename'
    renameBtn.addEventListener('click', () => openRenameCategoryDialog(category))
    
    const deleteBtn = h('button', { class: 'btn', style: 'background: #ef4444; border-color: #ef4444; color: white;' })
    deleteBtn.textContent = 'Delete'
    deleteBtn.addEventListener('click', () => openDeleteCategoryDialog(category))
    
    if (category === 'Other') {
      renameBtn.disabled = true
      renameBtn.style.opacity = '0.6'
      renameBtn.style.cursor = 'not-allowed'
      deleteBtn.disabled = true
      deleteBtn.style.opacity = '0.6'
      deleteBtn.style.cursor = 'not-allowed'
      deleteBtn.title = 'Default category cannot be deleted'
      renameBtn.title = 'Default category cannot be renamed'
    }
    
    actions.append(renameBtn, deleteBtn)
    li.append(info, actions)
    categoryManageList.appendChild(li)
  })
}

function openAddCategoryDialog() {
  addCategoryInput.value = ''
  addCategoryDialog.showModal()
  addCategoryInput.focus()
}

function addCategory() {
  const newName = addCategoryInput.value.trim()
  
  if (!newName) {
    addCategoryDialog.close()
    return
  }
  
  const exists = getAllCategories().some(cat => cat.toLowerCase() === newName.toLowerCase())
  if (exists) {
    alert('A category with this name already exists!')
    return
  }
  
  customCategories = unique([...customCategories, newName])
  persist()
  addCategoryDialog.close()
  renderManageCategories()
  renderInventoryCategories()
  renderCategoryFilter()
  populateCategoryDatalist()
}

function openReorderView() {
  tabs.forEach((x) => x.classList.remove('active'))
  views.forEach((v) => v.classList.remove('active'))
  qs<HTMLElement>('#reorderView').classList.add('active')
  headerTitle.textContent = 'Reorder'
  save(STORAGE_KEYS.currentView, 'reorderView')
  cashierSearch.style.display = 'none'
  inventorySearch.style.display = 'none'
  headerBackBtn.style.display = 'block'
  headerBackBtn.dataset.reorder = 'true'
  addItemFab.style.display = 'none'
  renderReorder()
}

function openRenameCategoryDialog(category: string) {
  oldCategoryName.value = category
  renameCategoryInput.value = category
  renameCategoryDialog.showModal()
  renameCategoryInput.focus()
  renameCategoryInput.select()
}

function renameCategory() {
  const oldName = oldCategoryName.value
  const newName = renameCategoryInput.value.trim()
  
  if (oldName === 'Other') {
    alert('The default category cannot be renamed.')
    renameCategoryDialog.close()
    return
  }
  
  if (!newName || newName === oldName) {
    renameCategoryDialog.close()
    return
  }
  
  // Check if new name already exists
  const existingCategories = unique(inventory.map(i => i.category))
  if (existingCategories.includes(newName)) {
    alert('A category with this name already exists!')
    return
  }
  
  // Update all items with this category
  inventory.forEach(item => {
    if (item.category === oldName) {
      item.category = newName
    }
  })
  customCategories = unique([...customCategories.filter((c) => c !== oldName), newName])
  
  persist()
  renameCategoryDialog.close()
  renderManageCategories()
  renderInventoryCategories()
  renderCategoryFilter()
}

function openDeleteCategoryDialog(category: string) {
  if (category === 'Other') {
    alert('The default category cannot be deleted.')
    return
  }
  
  const categoryItems = inventory.filter(i => i.category === category)
  const itemCount = categoryItems.length
  
  categoryToDelete.value = category
  deleteCategoryMessage.textContent = `This category has ${itemCount} item${itemCount !== 1 ? 's' : ''}. Delete anyway?`
  deleteCategoryDialog.showModal()
}

function deleteCategory() {
  const category = categoryToDelete.value
  
  // Move items to "Other" category
  inventory.forEach(item => {
    if (item.category === category) {
      item.category = 'Other'
    }
  })
  customCategories = customCategories.filter((c) => c !== category)
  
  persist()
  deleteCategoryDialog.close()
  renderManageCategories()
  renderInventoryCategories()
  renderCategoryFilter()
}

function renderInventoryItems() {
  let list = inventory
  if (selectedInventoryCategory) {
    list = list.filter(i => i.category === selectedInventoryCategory)
  }
  
  const term = inventorySearch.value?.toLowerCase?.() || ''
  list = list.filter((i) => i.name.toLowerCase().includes(term))
  
  inventoryList.innerHTML = ''
  
  list.forEach((item) => {
    const li = h('li', { class: 'inventory-item' })
    
    // Use historical max or default to 100
    const maxStock = item.maxStock || 100
    const stockPercentage = Math.min((item.stock / maxStock) * 100, 100)
    const stockColor = getStockColor(item.stock, item.lowPoint, maxStock)
    
    const stockBarContainer = h('div', { class: 'stock-bar-container' })
    const stockBar = h('div', { 
      class: 'stock-bar',
      style: `width: ${stockPercentage}%; background: ${stockColor};`
    })
    stockBarContainer.appendChild(stockBar)
    
    // Add low point indicator if set
    const lowPoint = item.lowPoint ?? (maxStock * 0.25)
    const lowPercentage = Math.min((lowPoint / maxStock) * 100, 100)
    const lowIndicator = h('div', { 
      class: 'low-indicator',
      style: `left: ${lowPercentage}%`
    })
    stockBarContainer.appendChild(lowIndicator)
    
    // Add max label
    const maxLabel = h('div', { 
      class: 'stock-max-label',
      style: 'position: absolute; bottom: -20px; right: 0; font-size: 10px; color: #9ca3af;'
    }, `Max: ${maxStock}`)
    stockBarContainer.appendChild(maxLabel)
    
    const textBox = h('div', { style: 'position: relative; flex: 1; padding-bottom: 18px;' })
    textBox.append(
      h('div', { class: 'title' }, item.name), 
      h('div', { class: 'muted' }, fmt(item.price)),
      stockBarContainer
    )
    
    li.append(
      h('img', { class: 'avatar', src: item.image || pic(Number(item.id.slice(-3))), alt: item.name }),
      textBox
    )
    li.addEventListener('click', () => openItemDialog(item))
    inventoryList.appendChild(li)
  })
}

function renderOrders() {
  if (!ordersContainer) return
  const orders = transactions.filter((tx) => tx.mode === 'order')
  if (orders.length === 0) {
    ordersContainer.innerHTML = `
      <p style="margin: 0; color: var(--muted);">
        No orders recorded yet. Switch the cart to <strong>Order</strong> mode and complete to capture orders without checking out.
      </p>
    `
    return
  }
  
  ordersContainer.innerHTML = ''
  orders.forEach((order) => {
    const card = h('div', { 
      class: 'order-card',
      style: 'cursor: pointer; transition: background 0.2s ease; display: flex; align-items: center; gap: 16px;',
      onclick: () => openOrderDetails(order)
    })
    
    // Customer name on the left (big text, without "Customer" prefix)
    if (order.customerName) {
      const customerNameDiv = h('div', { 
        style: 'font-size: 24px; font-weight: 700; color: var(--ink); flex-shrink: 0; min-width: 150px;'
      }, order.customerName)
      card.appendChild(customerNameDiv)
    }
    
    // Main content area
    const contentDiv = h('div', { style: 'flex: 1; display: flex; justify-content: space-between; align-items: center;' })
    const meta = h('div', { class: 'order-meta', style: 'flex: 1;' })
    const date = new Date(order.date)
    const topRow = h('div', { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;' })
    topRow.append(
      h('div', { class: 'order-id' }, `Order #${order.id}`),
      h('div', { class: 'order-date' }, date.toLocaleString())
    )
    meta.appendChild(topRow)
    
    // Add cashier name if available
    if (order.cashierName) {
      const cashierRow = h('div', { style: 'font-size: 13px; color: var(--muted); margin-top: 4px;' }, `Cashier: ${order.cashierName}`)
      meta.appendChild(cashierRow)
    }
    
    const summary = h('div', { class: 'order-summary' })
    summary.append(
      h('div', null, `${order.items.length} item${order.items.length === 1 ? '' : 's'}`),
      h('div', { class: 'order-total' }, fmt(order.total))
    )
    
    contentDiv.append(meta, summary)
    card.appendChild(contentDiv)
    ordersContainer.appendChild(card)
  })
}

function openOrderDetails(order: Transaction) {
  if (!orderDetailsDialog || !orderDetailsTitle || !orderDetailsContent) return
  
  // Store current order for button handlers
  currentOrderView = order
  
  const date = new Date(order.date)
  orderDetailsTitle.textContent = `Order #${order.id}`
  
  // Build clean order details HTML matching the image
  let html = ''
  
  // Order info section
  html += '<div class="order-info-section">'
  html += `<div class="order-info-item"><span class="order-info-label">Date:</span> ${date.toLocaleString()}</div>`
  if (order.customerName) {
    html += `<div class="order-info-item"><span class="order-info-label">Customer:</span> ${order.customerName}</div>`
  }
  if (order.cashierName) {
    html += `<div class="order-info-item"><span class="order-info-label">Cashier:</span> ${order.cashierName}</div>`
  }
  html += '</div>'
  
  // Items section
  html += '<div class="order-items-section">'
  html += '<h3 class="order-items-title">Items</h3>'
  html += '<table class="order-items-table">'
  html += '<thead>'
  html += '<tr>'
  html += '<th class="order-table-header order-col-item">ITEM</th>'
  html += '<th class="order-table-header order-col-qty">QTY</th>'
  html += '<th class="order-table-header order-col-price">PRICE</th>'
  html += '<th class="order-table-header order-col-total">TOTAL</th>'
  html += '</tr>'
  html += '</thead>'
  html += '<tbody>'
  
  order.items.forEach((item) => {
    const itemTotal = item.qty * item.price
    html += '<tr class="order-table-row">'
    html += `<td class="order-table-cell order-col-item">${item.name}</td>`
    html += `<td class="order-table-cell order-col-qty">${item.qty}</td>`
    html += `<td class="order-table-cell order-col-price">${fmt(item.price)}</td>`
    html += `<td class="order-table-cell order-col-total">${fmt(itemTotal)}</td>`
    html += '</tr>'
  })
  
  html += '</tbody>'
  html += '</table>'
  html += '</div>'
  
  // Totals section
  html += '<div class="order-totals-section">'
  html += `<div class="order-total-row"><span>Subtotal:</span><span>${fmt(order.subtotal)}</span></div>`
  if (order.tax > 0) {
    html += `<div class="order-total-row"><span>Tax:</span><span>${fmt(order.tax)}</span></div>`
  }
  html += `<div class="order-total-row order-total-final"><span>Total:</span><span class="order-total-amount">${fmt(order.total)}</span></div>`
  html += '</div>'
  
  orderDetailsContent.innerHTML = html
  
  if (orderDetailsDialog) {
    orderDetailsDialog.showModal()
  }
}

// Handle order actions
function markOrderDelivered(order: Transaction) {
  if (!deliverOrderDialog || !deliverOrderMessage || !deliverOrderId) return
  
  // Show confirmation modal
  deliverOrderMessage.textContent = `Are you sure you want to mark order #${order.id} as delivered? This will convert the order to a completed sale and reduce inventory stock accordingly.`
  deliverOrderId.value = order.id
  deliverOrderDialog.showModal()
}

function confirmDeliverOrder() {
  if (!deliverOrderId || !deliverOrderDialog) return
  
  const orderId = deliverOrderId.value
  const order = transactions.find((tx) => tx.id === orderId)
  
  if (!order) {
    deliverOrderDialog.close()
    return
  }
  
  // Convert order to sale
  const orderIndex = transactions.findIndex((tx) => tx.id === orderId)
  if (orderIndex !== -1) {
    // Change mode to sale
    transactions[orderIndex].mode = 'sale'
    
    // Reduce inventory stock for all items (since it's now a completed sale)
    order.items.forEach((item) => {
      const inventoryItem = inventory.find((i) => i.id === item.itemId)
      if (inventoryItem) {
        inventoryItem.stock -= item.qty
        soldTally[item.itemId] = (soldTally[item.itemId] || 0) + item.qty
      }
    })
  }
  
  persist()
  deliverOrderDialog.close()
  orderDetailsDialog?.close()
  currentOrderView = null
  renderOrders()
  renderInventory()
  renderProducts()
  renderReports()
  renderReorder()
  
  alert(`Order #${orderId} marked as delivered. Inventory updated.`)
}

function cancelOrderAction(order: Transaction) {
  if (!cancelOrderDialog || !cancelOrderMessage || !cancelOrderId) return
  
  // Show confirmation modal
  cancelOrderMessage.textContent = `Are you sure you want to cancel order #${order.id}? This will permanently delete the order from both orders and sales.`
  cancelOrderId.value = order.id
  cancelOrderDialog.showModal()
}

function confirmCancelOrder() {
  if (!cancelOrderId || !cancelOrderDialog) return
  
  const orderId = cancelOrderId.value
  const order = transactions.find((tx) => tx.id === orderId)
  
  if (!order) {
    cancelOrderDialog.close()
    return
  }
  
  // Remove order from transactions completely (from both orders and sales)
  transactions = transactions.filter((tx) => tx.id !== orderId)
  
  persist()
  cancelOrderDialog.close()
  orderDetailsDialog?.close()
  currentOrderView = null
  renderOrders()
  renderReports()
  
  alert(`Order #${orderId} has been cancelled and removed.`)
}

// Close order details modal
closeOrderDetailsXBtn?.addEventListener('click', () => {
  if (orderDetailsDialog) {
    orderDetailsDialog.close()
    orderDetailsDialog.style.display = 'none'
    currentOrderView = null
  }
})

// Close modal when clicking on backdrop
orderDetailsDialog?.addEventListener('click', (e) => {
  if (e.target === orderDetailsDialog) {
    orderDetailsDialog.close()
    orderDetailsDialog.style.display = 'none'
    currentOrderView = null
  }
})

// Ensure modal is hidden when closed
orderDetailsDialog?.addEventListener('close', () => {
  if (orderDetailsDialog) {
    orderDetailsDialog.style.display = 'none'
    currentOrderView = null
  }
})

cancelOrderBtn?.addEventListener('click', () => {
  if (currentOrderView) {
    cancelOrderAction(currentOrderView)
  }
})

deliveredOrderBtn?.addEventListener('click', () => {
  if (currentOrderView) {
    markOrderDelivered(currentOrderView)
  }
})

// Cancel Order Confirmation Modal handlers
closeCancelOrderDialog?.addEventListener('click', () => {
  cancelOrderDialog?.close()
})

closeCancelOrderConfirmBtn?.addEventListener('click', () => {
  cancelOrderDialog?.close()
})

confirmCancelOrderBtn?.addEventListener('click', () => {
  confirmCancelOrder()
})

// Deliver Order Confirmation Modal handlers
closeDeliverOrderDialog?.addEventListener('click', () => {
  deliverOrderDialog?.close()
})

closeDeliverOrderConfirmBtn?.addEventListener('click', () => {
  deliverOrderDialog?.close()
})

confirmDeliverOrderBtn?.addEventListener('click', () => {
  confirmDeliverOrder()
})

function renderSettings() {
  // Restore saved settings tab or default to storeProfile
  const savedTab = load<string>(STORAGE_KEYS.settingsTab) || 'storeProfile'
  switchSettingsTab(savedTab as 'storeProfile' | 'users')
}

function renderUsers() {
  if (!usersList) return
  
  const users = load<Record<string, { password: string; userType: 'business' | 'individual'; name?: string }>>('ws.users') ?? {}
  const userEntries = Object.entries(users)
  
  if (userEntries.length === 0) {
    usersList.innerHTML = '<p style="color: var(--muted); margin: 0;">No users found. Add a user to get started.</p>'
    return
  }
  
  usersList.innerHTML = ''
  userEntries.forEach(([email, userData]) => {
    const userCard = h('div', {
      class: 'card',
      style: 'padding: 16px; display: flex; justify-content: space-between; align-items: center;'
    })
    
    const userInfo = h('div')
    const displayName = userData.name || email
    userInfo.append(
      h('div', { style: 'font-weight: 600; font-size: 16px; color: var(--ink); margin-bottom: 4px;' }, displayName),
      h('div', { style: 'font-size: 14px; color: var(--muted); margin-bottom: 2px;' }, email),
      h('div', { style: 'font-size: 14px; color: var(--muted);' }, `Role: ${userData.userType === 'business' ? 'Business' : 'Individual'}`)
    )
    
    const actions = h('div', { style: 'display: flex; gap: 8px;' })
    if (email !== currentUser) {
      const editBtn = h('button', {
        class: 'btn',
        style: 'background: #2563eb; color: white; border-color: #2563eb;',
        onclick: () => {
          openUserDialog(email)
        }
      }, 'Edit')
      
      const deleteBtn = h('button', {
        class: 'btn',
        style: 'background: #ef4444; color: white; border-color: #ef4444;',
        onclick: () => {
          if (confirm(`Delete user "${displayName}" (${email})?`)) {
            const allUsers = load<Record<string, { password: string; userType: 'business' | 'individual'; name?: string; role?: 'admin' | 'cashier' | 'observer' }>>('ws.users') ?? {}
            delete allUsers[email]
            save('ws.users', allUsers)
            renderUsers()
          }
        }
      }, 'Delete')
      
      actions.appendChild(editBtn)
      actions.appendChild(deleteBtn)
    } else {
      actions.appendChild(h('span', { style: 'color: var(--muted); font-size: 14px;' }, 'Current User'))
    }
    
    userCard.append(userInfo, actions)
    usersList.appendChild(userCard)
  })
}

function openUserDialog(userEmail?: string) {
  if (!userDialog || !userForm || !userDialogTitle) return
  
  const users = load<Record<string, { password: string; userType: 'business' | 'individual'; name?: string; role?: 'admin' | 'cashier' | 'observer' }>>('ws.users') ?? {}
  
  if (userEmail && users[userEmail]) {
    // Edit mode
    const user = users[userEmail]
    userDialogTitle.textContent = 'Edit User'
    ;(userForm.elements.namedItem('id') as HTMLInputElement).value = userEmail
    ;(userForm.elements.namedItem('email') as HTMLInputElement).value = userEmail
    ;(userForm.elements.namedItem('email') as HTMLInputElement).readOnly = true
    ;(userForm.elements.namedItem('name') as HTMLInputElement).value = user.name || ''
    ;(userForm.elements.namedItem('role') as HTMLSelectElement).value = user.role || 'cashier'
    ;(userForm.elements.namedItem('password') as HTMLInputElement).value = ''
    ;(userForm.elements.namedItem('password') as HTMLInputElement).placeholder = 'Leave blank to keep current password'
    ;(userForm.elements.namedItem('password') as HTMLInputElement).required = false
  } else {
    // Add mode
    userDialogTitle.textContent = 'Add User'
    userForm.reset()
    ;(userForm.elements.namedItem('id') as HTMLInputElement).value = ''
    ;(userForm.elements.namedItem('email') as HTMLInputElement).readOnly = false
    ;(userForm.elements.namedItem('password') as HTMLInputElement).placeholder = 'Minimum 6 characters'
    ;(userForm.elements.namedItem('password') as HTMLInputElement).required = true
  }
  
  userDialog.showModal()
}

function saveUserFromDialog(ev: SubmitEvent) {
  ev.preventDefault()
  if (!userForm) return
  
  const data = Object.fromEntries(new FormData(userForm) as any) as Record<string, string>
  const existingEmail = (data.id as string).trim().toLowerCase()
  const email = (data.email as string).trim().toLowerCase()
  const name = (data.name as string).trim()
  const password = data.password as string
  const role = data.role as 'admin' | 'cashier' | 'observer'
  
  if (!email || !role) {
    alert('Please fill in all required fields.')
    return
  }
  
  const users = load<Record<string, { password: string; userType: 'business' | 'individual'; name?: string; role?: 'admin' | 'cashier' | 'observer' }>>('ws.users') ?? {}
  
  const isEditMode = !!existingEmail && existingEmail === email
  
  if (isEditMode) {
    // Edit mode - update existing user
    if (!users[email]) {
      alert('User not found.')
      return
    }
    
    // Update user data - preserve userType (always business for users added through this dialog)
    users[email] = {
      ...users[email],
      password: password && password.length >= 6 ? password : users[email].password, // Keep existing password if new one is empty or too short
      userType: 'business', // Always business for users managed through Settings
      role: role,
      name: name
    }
    
    // Validate password if provided
    if (password && password.length < 6) {
      alert('Password must be at least 6 characters long if provided.')
      return
    }
  } else {
    // Add mode - create new user
    if (users[email]) {
      alert('A user with this email already exists.')
      return
    }
    
    if (!password || password.length < 6) {
      alert('Password must be at least 6 characters long.')
      return
    }
    
    // Save new user - always business type, with specified role
    users[email] = {
      password: password,
      userType: 'business',
      role: role,
      name: name
    }
  }
  
  save('ws.users', users)
  userDialog?.close()
  renderUsers()
}

// Sellable Table
function renderSellableTable() {
  if (!sellableTableBody || !sellableEmpty) return
  
  // Get filter values
  const searchTerm = sellableSearch?.value.toLowerCase() || ''
  const categoryFilter = sellableCategoryFilter?.value || ''
  
  // Filter items
  let filteredItems = inventory.filter(item => {
    // Search filter
    if (searchTerm) {
      const matchesSearch = 
        item.name.toLowerCase().includes(searchTerm) ||
        item.category.toLowerCase().includes(searchTerm) ||
        item.unit?.toLowerCase().includes(searchTerm)
      if (!matchesSearch) return false
    }
    
    // Category filter
    if (categoryFilter && item.category !== categoryFilter) return false
    
    return true
  })
  
  // Sort by name
  filteredItems.sort((a, b) => a.name.localeCompare(b.name))
  
  // Clear table
  sellableTableBody.innerHTML = ''
  
  if (filteredItems.length === 0) {
    sellableEmpty.style.display = 'block'
  } else {
    sellableEmpty.style.display = 'none'
    
    // Render items
    filteredItems.forEach(item => {
      const row = h('tr')
      const expiryDate = item.expiryDate ? new Date(item.expiryDate) : null
      const isExpired = expiryDate && expiryDate < new Date()
      const expiryDateStr = expiryDate ? expiryDate.toLocaleDateString() : '-'
      
      row.innerHTML = `
        <td>${item.name}</td>
        <td style="font-weight: 600;">${fmt(item.cost)}</td>
        <td style="font-weight: 600;">${fmt(item.price)}</td>
        <td>${item.unit || '-'}</td>
        <td>${item.stock}</td>
        <td style="${isExpired ? 'color: #ef4444; font-weight: 600;' : ''}">${expiryDateStr}</td>
        <td>${item.lowPoint || '-'}</td>
        <td>
          <div class="expense-actions">
            <button class="btn-edit" data-item-id="${item.id}">Edit</button>
            <button class="btn-delete" data-item-id="${item.id}">Delete</button>
          </div>
        </td>
      `
      
      sellableTableBody.appendChild(row)
    })
    
    // Add event listeners for edit/delete buttons
    sellableTableBody.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.target as HTMLButtonElement).dataset.itemId
        if (id) {
          const item = inventory.find(i => i.id === id)
          if (item) openItemDialog(item)
        }
      })
    })
    
    sellableTableBody.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.target as HTMLButtonElement).dataset.itemId
        if (id) {
          const item = inventory.find(i => i.id === id)
          if (item) {
            if (confirm(`Delete "${item.name}"?\n\nThis action cannot be undone.`)) {
              inventory = inventory.filter(i => i.id !== id)
              persist()
              renderSellableTable()
              renderInventoryCategories()
              renderInventory()
              renderCategoryFilter()
              renderProducts()
              renderReports()
              console.log(`🗑️  Deleted item: ${item.name}`)
            }
          }
        }
      })
    })
  }
}

function populateSellableCategoryFilter() {
  if (!sellableCategoryFilter) return
  const categories = getAllCategories()
  sellableCategoryFilter.innerHTML = '<option value="">All Categories</option>'
  categories.forEach(category => {
    sellableCategoryFilter.appendChild(h('option', { value: category }, category))
  })
}

function clearSellableFilters() {
  if (sellableSearch) sellableSearch.value = ''
  if (sellableCategoryFilter) sellableCategoryFilter.value = ''
  renderSellableTable()
}

// Operational Expenses
function renderExpenses() {
  if (!expensesTableBody || !expensesEmpty || !expensesTotal || !expensesTableFooter) return
  
  // Get filter values
  const searchTerm = expenseSearch?.value.toLowerCase() || ''
  const startDate = expenseStartDate?.value || ''
  const endDate = expenseEndDate?.value || ''
  
  // Filter expenses
  let filteredExpenses = expenses.filter(expense => {
    // Search filter
    if (searchTerm) {
      const matchesSearch = 
        expense.description.toLowerCase().includes(searchTerm) ||
        expense.category?.toLowerCase().includes(searchTerm) ||
        expense.notes?.toLowerCase().includes(searchTerm)
      if (!matchesSearch) return false
    }
    
    // Date range filter
    if (startDate && expense.date < startDate) return false
    if (endDate && expense.date > endDate) return false
    
    return true
  })
  
  // Sort by date (newest first)
  filteredExpenses.sort((a, b) => b.date.localeCompare(a.date))
  
  // Clear table
  expensesTableBody.innerHTML = ''
  
  if (filteredExpenses.length === 0) {
    expensesEmpty.style.display = 'block'
    expensesTableFooter.style.display = 'none'
  } else {
    expensesEmpty.style.display = 'none'
    expensesTableFooter.style.display = 'table-row-group'
    
    // Render expenses
    let total = 0
    filteredExpenses.forEach(expense => {
      total += expense.amount
      
      const row = h('tr')
      const date = new Date(expense.date)
      
      row.innerHTML = `
        <td>${date.toLocaleDateString()}</td>
        <td>${expense.description}</td>
        <td>${expense.category || '-'}</td>
        <td style="font-weight: 600;">${fmt(expense.amount)}</td>
        <td>
          <div class="expense-actions">
            <button class="btn-edit" data-expense-id="${expense.id}">Edit</button>
            <button class="btn-delete" data-expense-id="${expense.id}">Delete</button>
          </div>
        </td>
      `
      
      expensesTableBody.appendChild(row)
    })
    
    // Update total
    expensesTotal.textContent = fmt(total)
    
    // Add event listeners for edit/delete buttons
    expensesTableBody.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.target as HTMLButtonElement).dataset.expenseId
        if (id) openExpenseDialog(expenses.find(e => e.id === id))
      })
    })
    
    expensesTableBody.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.target as HTMLButtonElement).dataset.expenseId
        if (id) deleteExpense(id)
      })
    })
  }
}

function openExpenseDialog(expense?: Expense) {
  if (!expenseDialog || !expenseForm || !expenseDialogTitle) return
  
  if (expense) {
    expenseDialogTitle.textContent = 'Edit Expense'
    ;(expenseForm.elements.namedItem('id') as HTMLInputElement).value = expense.id
    ;(expenseForm.elements.namedItem('date') as HTMLInputElement).value = expense.date
    ;(expenseForm.elements.namedItem('description') as HTMLInputElement).value = expense.description
    ;(expenseForm.elements.namedItem('category') as HTMLSelectElement).value = expense.category || ''
    ;(expenseForm.elements.namedItem('amount') as HTMLInputElement).value = expense.amount.toString()
    ;(expenseForm.elements.namedItem('notes') as HTMLTextAreaElement).value = expense.notes || ''
  } else {
    expenseDialogTitle.textContent = 'Add Expense'
    expenseForm.reset()
    ;(expenseForm.elements.namedItem('date') as HTMLInputElement).value = new Date().toISOString().split('T')[0]
    ;(expenseForm.elements.namedItem('id') as HTMLInputElement).value = ''
    ;(expenseForm.elements.namedItem('category') as HTMLSelectElement).value = ''
  }
  
  expenseDialog.showModal()
}

function saveExpenseFromDialog(ev: SubmitEvent) {
  ev.preventDefault()
  if (!expenseForm) return
  
  const data = Object.fromEntries(new FormData(expenseForm) as any) as Record<string, string>
  const existingExpense = expenses.find((e) => e.id === (data.id || ''))
  
  const payload: Expense = {
    id: data.id || id(),
    date: data.date,
    description: data.description.trim(),
    category: data.category?.trim() || undefined,
    amount: parseFloat(data.amount) || 0,
    notes: data.notes?.trim() || undefined,
  }
  
  if (existingExpense) {
    const index = expenses.findIndex(e => e.id === existingExpense.id)
    expenses[index] = payload
  } else {
    expenses.unshift(payload)
  }
  
  save(STORAGE_KEYS.expenses, expenses)
  persist()
  expenseDialog?.close()
  renderExpenses()
  
  console.log(`${existingExpense ? 'Updated' : 'Added'} expense: ${payload.description}`)
}

function deleteExpense(expenseId: string) {
  const expense = expenses.find(e => e.id === expenseId)
  if (!expense) return
  
  if (confirm(`Delete expense "${expense.description}"?\n\nThis action cannot be undone.`)) {
    expenses = expenses.filter(e => e.id !== expenseId)
    save(STORAGE_KEYS.expenses, expenses)
    persist()
    renderExpenses()
    
    console.log(`🗑️  Deleted expense: ${expense.description}`)
  }
}


function clearExpenseFilters() {
  if (expenseSearch) expenseSearch.value = ''
  if (expenseStartDate) expenseStartDate.value = ''
  if (expenseEndDate) expenseEndDate.value = ''
  renderExpenses()
}

function renderInventory() {
  if (selectedInventoryCategory === null && inventoryItemsView.style.display === 'none') {
    renderInventoryCategories()
  } else {
    renderInventoryItems()
  }
}

function getStockColor(stock: number, lowPoint?: number, maxStock?: number): string {
  const max = maxStock || 100
  const low = lowPoint ?? (max * 0.25)
  
  // Red zone: at or below low point (including 0)
  if (stock <= low) return '#ef4444'
  
  // Calculate position between low point and max
  const range = max - low
  const position = stock - low
  const ratio = position / range
  
  // Orange zone: between low point and halfway to max
  if (ratio < 0.5) return '#f59e0b'
  
  // Green zone: above halfway point
  return '#10b981'
}

function stockClass(stock: number, lowPoint?: number) {
  const threshold = lowPoint ?? LOW_STOCK_THRESHOLD
  if (stock <= 0) return 'status-bad'
  if (stock <= threshold) return 'status-warn'
  return 'status-ok'
}

function openItemDialog(item?: Item) {
  itemDialogTitle.textContent = item ? 'Edit Item' : 'Add Item'
  ;(itemForm.elements.namedItem('name') as HTMLInputElement).value = item?.name || ''
  ;(itemForm.elements.namedItem('category') as HTMLInputElement).value = item?.category || ''
  ;(itemForm.elements.namedItem('price') as HTMLInputElement).value = item?.price?.toString() ?? ''
  ;(itemForm.elements.namedItem('cost') as HTMLInputElement).value = item?.cost?.toString() ?? ''
  ;(itemForm.elements.namedItem('stock') as HTMLInputElement).value = item?.stock?.toString() ?? ''
  ;(itemForm.elements.namedItem('lowPoint') as HTMLInputElement).value = item?.lowPoint?.toString() ?? ''
  ;(itemForm.elements.namedItem('unit') as HTMLInputElement).value = item?.unit || ''
  ;(itemForm.elements.namedItem('expiryDate') as HTMLInputElement).value = item?.expiryDate || ''
  ;(itemForm.elements.namedItem('id') as HTMLInputElement).value = item?.id || ''
  
  // Set image preview
  const imageUrl = item?.image || pic(1000)
  itemImagePreview.src = imageUrl
  itemImageData.value = item?.image || ''
  
  // Show delete button only when editing existing item
  if (item) {
    deleteItemBtn.style.display = 'block'
  } else {
    deleteItemBtn.style.display = 'none'
  }
  
  itemDialog.showModal()
}

function saveItemFromDialog(ev: SubmitEvent) {
  ev.preventDefault()
  const data = Object.fromEntries(new FormData(itemForm) as any) as Record<string, string>
  const existingItem = inventory.find((i) => i.id === (data.id || ''))
  const newStock = Number(data.stock) || 0

  const payload: Item = {
    id: data.id || id(),
    name: data.name.trim(),
    category: data.category.trim() || 'Other',
    price: Number(data.price),
    cost: Number(data.cost) || 0,
    stock: newStock,
    image: data.image?.trim() || '',
    lowPoint: data.lowPoint ? Number(data.lowPoint) : undefined,
    maxStock: Math.max(newStock, existingItem?.maxStock || 0),
    unit: data.unit?.trim() || undefined,
    expiryDate: data.expiryDate?.trim() || undefined,
  }
  const idx = inventory.findIndex((i) => i.id === payload.id)
  if (idx >= 0) inventory[idx] = payload
  else inventory.unshift(payload)
  persist()
  itemDialog.close()
  renderInventoryCategories()
  renderInventory()
  renderCategoryFilter()
  renderProducts()
}

function populateCategoryDatalist() {
  categoryList.innerHTML = ''
  getAllCategories().forEach((c) => {
    categoryList.appendChild(h('option', { value: c }))
  })
}

// Reports
function renderReports() {
  const sales = transactions.filter((t) => t.mode !== 'order')
  const totalSales = sales.reduce((s, t) => s + t.total, 0)
  const totalProfit = sales.reduce((s, t) => s + t.profit, 0)
  const lowStock = inventory.filter((i) => i.stock <= LOW_STOCK_THRESHOLD).length
  totalSalesEl.textContent = fmt(totalSales)
  totalProfitEl.textContent = fmt(totalProfit)
  totalTransactionsEl.textContent = String(sales.length)
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

// Toast notification
function showToast(message: string, duration = 1000) {
  if (toast) {
    toast.textContent = message
    toast.style.display = 'block'
    setTimeout(() => {
      toast.style.display = 'none'
    }, duration)
  }
}

// Receipt
function showReceipt(tx: Transaction, saved: boolean) {
  currentReceipt = tx
  
  receiptTransactionId.textContent = tx.id
  const date = new Date(tx.date)
  
  // Build receipt header with customer name and cashier name
  let headerInfo = `<div style="color: #6b7280; font-size: 14px;">Transaction #${tx.id}</div>`
  headerInfo += `<div style="color: #6b7280; font-size: 12px; margin-top: 5px;">${date.toLocaleString()}</div>`
  
  if (tx.mode === 'order' && tx.customerName) {
    headerInfo += `<div style="color: #6b7280; font-size: 14px; margin-top: 8px; font-weight: 500;">Customer: ${tx.customerName}</div>`
  }
  
  if (tx.cashierName) {
    headerInfo += `<div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Cashier: ${tx.cashierName}</div>`
  }
  
  receiptDate.innerHTML = headerInfo
  
  // Render items
  receiptItems.innerHTML = ''
  tx.items.forEach(item => {
    const row = h('div', { style: 'display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px;' })
    const left = h('div')
    left.textContent = `${item.qty}x ${item.name}`
    const right = h('div', { style: 'font-weight: 600;' })
    right.textContent = fmt(item.price * item.qty)
    row.append(left, right)
    receiptItems.appendChild(row)
  })
  
  // Render totals
  receiptTotals.innerHTML = ''
  const subtotalRow = h('div', { style: 'display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;' })
  subtotalRow.append(h('span', { style: 'color: #6b7280;' }, 'Subtotal'), h('span', null, fmt(tx.subtotal)))
  
  const taxRow = h('div', { style: 'display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;' })
  taxRow.append(h('span', { style: 'color: #6b7280;' }, 'VAT (16%)'), h('span', null, fmt(tx.tax)))
  
  const totalRow = h('div', { style: 'display: flex; justify-content: space-between; padding-top: 10px; margin-top: 10px; border-top: 2px solid #0f172a; font-size: 16px; font-weight: 700;' })
  totalRow.append(h('span', null, 'Total'), h('span', null, fmt(tx.total)))
  
  receiptTotals.append(subtotalRow, taxRow, totalRow)
  
  // Show toast notification
  if (saved) {
    showToast('✅ Items saved to database')
  } else {
    showToast('⚠️ Saved locally only. Check Supabase connection.')
  }
  
  receiptDialog.showModal()
}

// PDF Generation
function generateReceiptPDF(tx: Transaction): jsPDF {
  const pdf = new jsPDF()
  const date = new Date(tx.date)
  
  // Header
  pdf.setFontSize(20)
  pdf.text('WaiaSella POS', 105, 20, { align: 'center' })
  
  pdf.setFontSize(14)
  pdf.text('Receipt', 105, 30, { align: 'center' })
  
  pdf.setFontSize(10)
  pdf.text(`Transaction #${tx.id}`, 20, 40)
  pdf.text(date.toLocaleString(), 20, 46)
  
  // Items
  let yPos = 60
  pdf.setFontSize(12)
  pdf.text('Items:', 20, yPos)
  yPos += 8
  
  pdf.setFontSize(10)
  tx.items.forEach(item => {
    const itemText = `${item.qty}x ${item.name}`
    const priceText = fmt(item.price * item.qty)
    pdf.text(itemText, 20, yPos)
    pdf.text(priceText, 180, yPos, { align: 'right' })
    yPos += 7
  })
  
  // Totals
  yPos += 5
  pdf.setFontSize(10)
  pdf.text(`Subtotal: ${fmt(tx.subtotal)}`, 180, yPos, { align: 'right' })
  yPos += 7
  pdf.text(`VAT (16%): ${fmt(tx.tax)}`, 180, yPos, { align: 'right' })
  yPos += 10
  pdf.setFontSize(12)
  pdf.setFont(undefined, 'bold')
  pdf.text(`Total: ${fmt(tx.total)}`, 180, yPos, { align: 'right' })
  
  return pdf
}

function downloadReceiptPDF() {
  if (!currentReceipt) return
  const pdf = generateReceiptPDF(currentReceipt)
  const fileName = `receipt-${currentReceipt.id}-${Date.now()}.pdf`
  pdf.save(fileName)
}

function shareReceiptWhatsApp() {
  if (!currentReceipt) return
  const pdf = generateReceiptPDF(currentReceipt)
  const pdfBlob = pdf.output('blob')
  const pdfUrl = URL.createObjectURL(pdfBlob)
  
  const date = new Date(currentReceipt.date)
  const receiptText = `Receipt - Transaction #${currentReceipt.id}\nDate: ${date.toLocaleString()}\nTotal: ${fmt(currentReceipt.total)}`
  
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(receiptText)}`
  window.open(whatsappUrl, '_blank')
  
  // Clean up
  setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000)
}


// Additional utility functions
function btn(label: string, cls = '', onclick?: () => void) { return h('button', { class: cls ? cls : 'btn', onclick }, label) }
function row(a: Element, b: Element) { const r = h('div', { class: 'row' }); r.append(a, b); return r }

function persist() {
  save(STORAGE_KEYS.inventory, inventory)
  save(STORAGE_KEYS.transactions, transactions)
  save(STORAGE_KEYS.soldTally, soldTally)
  save(STORAGE_KEYS.customCategories, customCategories)
  save(STORAGE_KEYS.expenses, expenses)
}

