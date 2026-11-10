import { http } from '@/lib/http';

// Suppliers & Defects page (backend/app/routers/defects.py). Each category has one supplier.

export interface Supplier {
  supplier_id: number;
  supplier_name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
  categories: string[]; // categories that use this supplier now
  report_count: number;
  open_count: number; // Reported or Returned to supplier
  defective_units: number;
  units_sold: number; // from its categories, cancelled orders left out
}

export interface CategorySupplier {
  item_categ_id: number;
  item_category: string;
  supplier_id: number | null;
  product_count: number;
}

export type SupplierInput = Pick<Supplier, 'supplier_name' | 'contact_person' | 'phone' | 'email' | 'address' | 'is_active'>;

export type DefectSource = 'receiving' | 'storage' | 'customer_return';
export type DefectStatus = 'Reported' | 'Returned to supplier' | 'Replaced' | 'Credited';

export interface DefectReport {
  defect_id: number;
  prod_var_id: number | null;
  item_name: string;
  sku: string;
  supplier_id: number | null;
  supplier_name: string | null; // the supplier when it was reported
  quantity: number;
  defect_type: string;
  source: DefectSource;
  order_id: number | null;
  order_num: number | null;
  notes: string | null;
  photos: string | null; // comma separated, use parseImages()
  status: DefectStatus;
  reported_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface DefectInput {
  prod_var_id: number;
  quantity: number;
  defect_type: string;
  source: DefectSource;
  order_id?: number | null;
  notes?: string;
  photos: string[];
}

// "Report as defective" on a refund
export interface DefectOrder {
  order_id: number;
  order_num: number;
  customer_name: string;
  reason: string | null;
  details: string | null;
  photos: string | null;
  items: { prod_var_id: number; item_name: string; quantity: number }[];
}

export const defectService = {
  getSuppliers: () => http<{ suppliers: Supplier[]; categories: CategorySupplier[] }>('/admin/suppliers'),
  addSupplier: (input: SupplierInput) => http<Supplier>('/admin/suppliers', { method: 'POST', body: input }),
  editSupplier: (id: number, input: SupplierInput) => http<Supplier>(`/admin/suppliers/${id}`, { method: 'PUT', body: input }),
  setCategorySupplier: (categId: number, supplierId: number | null) =>
    http<{ suppliers: Supplier[]; categories: CategorySupplier[] }>(`/admin/categories/${categId}/supplier`, {
      method: 'PUT',
      body: { supplier_id: supplierId },
    }),

  getDefects: () => http<DefectReport[]>('/admin/defects'),
  fromOrder: (orderId: number) => http<DefectOrder>(`/admin/defects/order/${orderId}`),
  report: (input: DefectInput) => http<DefectReport>('/admin/defects', { method: 'POST', body: input }),
  update: (id: number, change: { status: DefectStatus; notes?: string }) =>
    http<DefectReport>(`/admin/defects/${id}`, { method: 'PATCH', body: change }),
};

// what each status can change to; Replaced and Credited are final
export const DEFECT_NEXT: Record<DefectStatus, DefectStatus[]> = {
  Reported: ['Returned to supplier', 'Credited'],
  'Returned to supplier': ['Replaced', 'Credited'],
  Replaced: [],
  Credited: [],
};

export const SOURCE_LABEL: Record<DefectSource, string> = {
  receiving: 'On delivery from supplier',
  storage: 'Found in stock',
  customer_return: 'Customer return',
};

export const DEFECT_TYPES = [
  'Broken or cracked part',
  'Scratches or dents',
  'Wrong color or finish',
  'Missing parts or hardware',
  'Wrong size',
  'Fabric tear or stain',
  'Wobbly or uneven',
];

// a supplier at or above this defect rate is flagged
export const HIGH_DEFECT_RATE = 5;
