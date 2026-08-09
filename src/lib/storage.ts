import type {
  Customer,
  Order,
  Product
} from "./types";


/* =========================================================
   Storage Keys
========================================================= */

const KEYS = {
  customers: "dms_customers",
  products: "dms_products",
  orders: "dms_orders"
};


/* =========================================================
   Customers
========================================================= */

const seedCustomers: Customer[] = [

  {
    id: "C1001",
    name: "سوپر احمدی",
    owner: "علی احمدی",
    phone: "09120000001",
    address: "شرق تهران",
    region: "شرق",
    visitor: "رضا",
    active: true,
    discountPercent: 10
  },

  {
    id: "C1002",
    name: "فروشگاه کریمی",
    owner: "مهدی کریمی",
    phone: "09120000002",
    address: "مرکز تهران",
    region: "مرکز",
    visitor: "رضا",
    active: true,
    discountPercent: 15
  },

  {
    id: "C1003",
    name: "هایپر رضایی",
    owner: "حسن رضایی",
    phone: "09120000003",
    address: "غرب تهران",
    region: "غرب",
    visitor: "محمد",
    active: true,
    discountPercent: 10
  }

];


/* =========================================================
   Products
========================================================= */

const seedProducts: Product[] = [

  {
    id: "P1001",
    name: "نوشابه خانواده",
    category: "نوشیدنی",
    brand: "کوکاکولا",
    buyPrice: 20000,
    sellPrice: 25000,
    barcode: "6261234567890",
    unit: "عدد",
    quantityPerCarton: 12,
    consumerPrice: 25000
  },

  {
    id: "P1002",
    name: "چیپس",
    category: "تنقلات",
    brand: "چی‌توز",
    buyPrice: 15000,
    sellPrice: 20000,
    barcode: "6261234567891",
    unit: "عدد",
    quantityPerCarton: 24,
    consumerPrice: 20000
  },

  {
    id: "P1003",
    name: "بیسکویت",
    category: "بیسکویت",
    brand: "مینو",
    buyPrice: 18000,
    sellPrice: 24000,
    barcode: "6261234567892",
    unit: "عدد",
    quantityPerCarton: 30,
    consumerPrice: 24000
  },

  {
    id: "P1004",
    name: "آب معدنی",
    category: "نوشیدنی",
    brand: "دماوند",
    buyPrice: 10000,
    sellPrice: 14000,
    barcode: "6261234567893",
    unit: "بطری",
    quantityPerCarton: 12,
    consumerPrice: 14000
  }

];


/* =========================================================
   Orders
========================================================= */

const seedOrders: Order[] = [

  {
    id: "O1001",

    customerId: "C1001",

    customerName: "سوپر احمدی",

    visitor: "رضا",

    createdAt:
      new Date().toISOString(),

    status: "approved",

    deliveryStatus:
      "not_delivered",

    items: [

      {
        productId: "P1001",

        productName:
          "نوشابه خانواده",

        barcode:
          "6261234567890",

        unit:
          "عدد",

        quantityPerCarton:
          12,

        orderCartons:
          8,

        orderPieces:
          3,

        orderTotalPieces:
          99,

        consumerPrice:
          25000,

        discountPercent:
          10,

        finalPurchasePrice:
          22500,

        totalPayment:
          2227500,

        deliveredCartons:
          0,

        deliveredPieces:
          0,

        deliveredTotalPieces:
          0,

        returnedTotalPieces:
          0
      }

    ],

    total:
      2227500,

    cost:
      1980000,

    extraCost:
      0,

    profit:
      247500
  },


  {
    id: "O1002",

    customerId: "C1002",

    customerName:
      "فروشگاه کریمی",

    visitor:
      "رضا",

    createdAt:
      new Date().toISOString(),

    status:
      "pending",

    deliveryStatus:
      "not_delivered",

    items: [

      {
        productId:
          "P1002",

        productName:
          "چیپس",

        barcode:
          "6261234567891",

        unit:
          "عدد",

        quantityPerCarton:
          24,

        orderCartons:
          5,

        orderPieces:
          5,

        orderTotalPieces:
          125,

        consumerPrice:
          20000,

        discountPercent:
          15,

        finalPurchasePrice:
          17000,

        totalPayment:
          2125000,

        deliveredCartons:
          0,

        deliveredPieces:
          0,

        deliveredTotalPieces:
          0,

        returnedTotalPieces:
          0
      }

    ],

    total:
      2125000,

    cost:
      1875000,

    extraCost:
      0,

    profit:
      250000
  }

];


/* =========================================================
   Load
========================================================= */

function load<T>(
  key: string,
  seed: T
): T {

  if (
    typeof window ===
    "undefined"
  ) {
    return seed;
  }

  const raw =
    localStorage.getItem(key);

  if (!raw) {

    localStorage.setItem(
      key,
      JSON.stringify(seed)
    );

    return seed;
  }

  try {

    return JSON.parse(raw) as T;

  } catch {

    return seed;
  }
}


/* =========================================================
   Save
========================================================= */

function save<T>(
  key: string,
  value: T
) {

  localStorage.setItem(
    key,
    JSON.stringify(value)
  );
}


/* =========================================================
   Customers
========================================================= */

export function getCustomers() {

  return load(
    KEYS.customers,
    seedCustomers
  );
}


export function saveCustomers(
  value: Customer[]
) {

  save(
    KEYS.customers,
    value
  );
}


/* =========================================================
   Products
========================================================= */

export function getProducts() {

  return load(
    KEYS.products,
    seedProducts
  );
}


export function saveProducts(
  value: Product[]
) {

  save(
    KEYS.products,
    value
  );
}


/* =========================================================
   Orders
========================================================= */

export function getOrders() {

  return load(
    KEYS.orders,
    seedOrders
  );
}


export function saveOrders(
  value: Order[]
) {

  save(
    KEYS.orders,
    value
  );
}


/* =========================================================
   Reset Demo
========================================================= */

export function resetDemoData() {

  save(
    KEYS.customers,
    seedCustomers
  );

  save(
    KEYS.products,
    seedProducts
  );

  save(
    KEYS.orders,
    seedOrders
  );
}