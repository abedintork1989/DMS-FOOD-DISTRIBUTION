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

  default_discount_percent?: number;
};


export type Product = {
  id: string;

  name: string;

  category: string;

  brand?: string;

  barcode?: string;

  unit?: string;

  quantity_per_carton?: number;

  consumer_price: number;

  inventory?: number;
};


export type OrderStatus =
  | "pending"
  | "approved"
  | "cancelled"
  | "delivered"
  | "partially_delivered"
  | "returned";


export type OrderItem = {
  id?: string;

  order_id?: string;

  product_id: string;

  row_number: number;

  barcode?: string;

  product_name: string;

  quantity_per_carton: number;

  order_cartons: number;

  order_units: number;

  consumer_price: number;

  discount_percent: number;

  final_unit_price: number;

  total_amount: number;

  delivered_cartons?: number;

  delivered_units?: number;

  returned_cartons?: number;

  returned_units?: number;
};


export type Order = {
  id: string;

  customer_id: string;

  customer_name?: string;

  visitor?: string;

  status: OrderStatus;

  total_amount: number;

  created_at: string;

  approved_at?: string | null;

  approved_by?: string | null;

  delivered_at?: string | null;

  delivered_by?: string | null;

  cancelled_at?: string | null;

  cancelled_by?: string | null;

  notes?: string | null;

  items: OrderItem[];
};