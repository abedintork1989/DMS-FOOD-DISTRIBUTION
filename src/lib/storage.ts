import type { Customer, Order, Product } from "./types";

const KEYS = {
  customers: "dms_customers",
  products: "dms_products",
  orders: "dms_orders"
};

const seedCustomers: Customer[] = [
  { id: "C1001", name: "سوپر احمدی", owner: "علی احمدی", phone: "09120000001", address: "شرق تهران", region: "شرق", visitor: "رضا", active: true },
  { id: "C1002", name: "فروشگاه کریمی", owner: "مهدی کریمی", phone: "09120000002", address: "مرکز تهران", region: "مرکز", visitor: "رضا", active: true },
  { id: "C1003", name: "هایپر رضایی", owner: "حسن رضایی", phone: "09120000003", address: "غرب تهران", region: "غرب", visitor: "محمد", active: true }
];

const seedProducts: Product[] = [
  { id: "P1001", name: "نوشابه خانواده", category: "نوشیدنی", brand: "کوکاکولا", buyPrice: 20000, sellPrice: 25000 },
  { id: "P1002", name: "چیپس", category: "تنقلات", brand: "چی‌توز", buyPrice: 15000, sellPrice: 20000 },
  { id: "P1003", name: "بیسکویت", category: "بیسکویت", brand: "مینو", buyPrice: 18000, sellPrice: 24000 },
  { id: "P1004", name: "آب معدنی", category: "نوشیدنی", brand: "دماوند", buyPrice: 10000, sellPrice: 14000 }
];

const seedOrders: Order[] = [
  {
    id: "O1001",
    customerId: "C1001",
    customerName: "سوپر احمدی",
    visitor: "رضا",
    createdAt: new Date().toISOString(),
    status: "approved",
    items: [{ productId: "P1001", productName: "نوشابه خانواده", quantity: 100, price: 25000 }],
    total: 2500000,
    cost: 2000000,
    extraCost: 0,
    profit: 500000
  },
  {
    id: "O1002",
    customerId: "C1002",
    customerName: "فروشگاه کریمی",
    visitor: "رضا",
    createdAt: new Date().toISOString(),
    status: "pending",
    items: [{ productId: "P1002", productName: "چیپس", quantity: 100, price: 20000 }],
    total: 2000000,
    cost: 1500000,
    extraCost: 0,
    profit: 500000
  }
];

function load<T>(key: string, seed: T): T {
  if (typeof window === "undefined") return seed;
  const raw = localStorage.getItem(key);
  if (!raw) {
    localStorage.setItem(key, JSON.stringify(seed));
    return seed;
  }
  try { return JSON.parse(raw) as T; } catch { return seed; }
}

function save<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getCustomers() { return load(KEYS.customers, seedCustomers); }
export function saveCustomers(value: Customer[]) { save(KEYS.customers, value); }

export function getProducts() { return load(KEYS.products, seedProducts); }
export function saveProducts(value: Product[]) { save(KEYS.products, value); }

export function getOrders() { return load(KEYS.orders, seedOrders); }
export function saveOrders(value: Order[]) { save(KEYS.orders, value); }

export function resetDemoData() {
  save(KEYS.customers, seedCustomers);
  save(KEYS.products, seedProducts);
  save(KEYS.orders, seedOrders);
}
