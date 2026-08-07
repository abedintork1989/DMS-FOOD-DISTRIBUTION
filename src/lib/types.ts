export type Role = "manager" | "visitor";

export type Customer = {
  id: string;
  name: string;
  owner: string;
  phone: string;
  address: string;
  region: string;
  visitor: string;
  active: boolean;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  brand: string;
  buyPrice: number;
  sellPrice: number;
};

export type OrderStatus =
  | "pending"
  | "approved"
  | "delivered"
  | "cancelled";

export type OrderItem = {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
};

export type Order = {
  id: string;
  customerId: string;
  customerName: string;
  visitor: string;
  createdAt: string;
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  cost: number;
  extraCost: number;
  profit: number;
};
