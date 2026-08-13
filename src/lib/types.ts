// ============================================================
// DMS SYSTEM TYPES
// Legacy + Supabase Compatible
// ============================================================



// ================= ROLE =================


export type Role =
  | "manager"
  | "visitor";





// ================= CUSTOMER =================


export type Customer = {

  id: string;

  name: string;


  owner?: string;

  phone?: string;

  address?: string;

  region?: string;

  province?: string;

  visitor?: string;


  active: boolean;



  // old

  discountPercent?: number;



  // database

  default_discount_percent?: number;

};








// ================= PRODUCT =================


export type Product = {


  id: string;


  name: string;



  category?: string;


  brand?: string;



  barcode?: string;



  unit?: string;





  // تعداد در کارتن


  quantityPerCarton?: number;


  quantity_per_carton?: number;





  // قیمت مصرف کننده


  consumerPrice?: number;


  consumer_price?: number;





  // خرید


  buyPrice?: number;


  purchase_price?: number;





  // فروش


  sellPrice?: number;





  inventory?: number;


  stock?: number;



};









// ================= ORDER STATUS =================


export type OrderStatus =


  | "pending"


  | "approved"


  | "cancelled"


  | "delivered"


  | "partially_delivered"


  | "returned";









// ================= ORDER ITEM =================


export type OrderItem = {



  id?: string;



  order_id?: string;





  // =========================
  // Product ID
  // =========================


  product_id?: string;


  productId?: string;






  // =========================
  // Product Info
  // =========================


  barcode?: string;



  product_name?: string;


  productName?: string;



  category?: string;



  brand?: string;



  unit?: string;







  // =========================
  // Carton
  // =========================


  quantity_per_carton?: number;


  quantityPerCarton?: number;



  cartonSize?: number;








  // =========================
  // Quantity
  // =========================



  // کارتن سفارش

  order_cartons?: number;


  orderCartons?: number;





  // تعداد جزء جدید

  order_units?: number;


  orderUnits?: number;





  // تعداد جزء قدیمی سیستم

  orderPieces?: number;





  // مجموع تعداد جزء

  orderTotalPieces?: number;





  // مجموع واحد

  total_units?: number;


  totalUnits?: number;








  // =========================
  // Price
  // =========================



  consumer_price?: number;


  consumerPrice?: number;





  discount_percent?: number;


  discountPercent?: number;





  final_unit_price?: number;


  finalPurchasePrice?: number;







  // =========================
  // Total
  // =========================


  total_amount?: number;


  total?: number;


  totalPayment?: number;








  // =========================
  // Warehouse
  // =========================


  delivered_cartons?: number;


  deliveredCartons?: number;



  delivered_units?: number;


  deliveredPieces?: number;


  deliveredTotalPieces?: number;



  returned_cartons?: number;


  returned_units?: number;


  returnedTotalPieces?: number;



};









// ================= ORDER =================


export type Order = {


  id: string;




  // شماره سفارش


  order_number?: number | string | null;






  // مشتری


  customer_id?: string;


  customerId?: string;




  customer_name?: string;


  customerName?: string;






  visitor?: string;







  status: OrderStatus;



  deliveryStatus?:
    | "not_delivered"
    | "partially_delivered"
    | "delivered";









  // مبلغ


  total?: number;


  total_amount?: number;



  invoice_total?: number;



  final_cost?: number;



  cost?: number;


  extraCost?: number;


  profit?: number;








  // تاریخ ها


  created_at: string;


  createdAt?: string;



  send_date?: string | null;



  delivery_date?: string | null;



  approved_at?: string | null;



  delivered_at?: string | null;



  cancelled_at?: string | null;







  // کاربران


  approved_by?: string | null;



  delivered_by?: string | null;



  cancelled_by?: string | null;







  notes?: string | null;







  // آیتم ها


  items?: OrderItem[];


  order_items?: OrderItem[];




};









// ================= MARKETING =================


export type Marketing = {


  id: string;



  customer_id: string;



  start_date?: string | null;


  end_date?: string | null;




  shelf_rent?: number;


  tray_rent?: number;


  board_rent?: number;


  promoter_cost?: number;


  side_cost?: number;


  foc_amount?: number;



};








// ================= PAYMENT =================


export type PaymentType =


  | "cash"


  | "bank_transfer"


  | "pos"


  | "check";