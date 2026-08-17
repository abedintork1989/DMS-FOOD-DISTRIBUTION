export type MapCustomer = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  province: string | null;
  visitor: string | null;
  settlement_days: number | null;
  latitude: number;
  longitude: number;
  active: boolean;
  customer_type: string | null;
};
