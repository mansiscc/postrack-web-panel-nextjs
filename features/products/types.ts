import type { ProductBatchRow, ProductListRow } from "@/repositories/products.repository";

export type ProductListItem = {
  id: string;
  name: string;
  barcode: string | null;
  categoryId: string | null;
  categoryName: string | null;
  purchasePrice: number | null;
  sellingPrice: number | null;
  mrp: number | null;
  unit: string | null;
  stockQuantity: number;
  lowStockAlertQty: number;
  isActive: boolean;
  isDeleted: boolean;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
};

export type ProductDetailsPayload = {
  product: {
    id: string;
    name: string;
    product_category_id: string | null;
    barcode: string | null;
    purchase_price: number | null;
    selling_price: number | null;
    mrp: number | null;
    unit: string | null;
    stock_quantity: number;
    low_stock_alert_qty: number;
    is_active: boolean;
    is_deleted: boolean;
    image_url: string | null;
    created_at: string;
    updated_at: string | null;
  };
  category_name: string | null;
  stock_summary: {
    opening_stock: number;
    total_received: number;
    total_sold: number;
    total_returned: number;
  };
  financial_summary: {
    units_sold: number;
    units_returned: number;
    net_units_sold: number;
    sales_revenue: number;
    return_amount: number;
    net_revenue: number;
    cost_of_goods_sold: number;
    gross_profit: number;
    profit_margin_percent: number | null;
    inventory_value_at_cost: number;
    inventory_value_at_sell: number | null;
  };
  movements: ProductMovement[];
};

export type ProductMovement = {
  id: string;
  transaction_type: string;
  quantity: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
  batch_id: string | null;
  batch_seq: number | null;
  batch_name: string | null;
  party_name: string | null;
  document_label: string | null;
  related_document_label: string | null;
  unit_price: number | null;
  selling_price: number | null;
  mrp: number | null;
  line_total: number | null;
  refund_method: string | null;
};

export type ProductBatchItem = {
  id: string;
  batchSeq: number;
  name: string;
  purchasePrice: number;
  sellingPrice: number | null;
  mrp: number | null;
  quantityRemaining: number;
};

export function mapProductRow(row: ProductListRow): ProductListItem {
  return {
    id: row.id,
    name: row.name,
    barcode: row.barcode,
    categoryId: row.product_category_id,
    categoryName: row.category_name,
    purchasePrice: row.purchase_price,
    sellingPrice: row.selling_price,
    mrp: row.mrp,
    unit: row.unit,
    stockQuantity: row.stock_quantity ?? 0,
    lowStockAlertQty: row.low_stock_alert_qty ?? 0,
    isActive: row.is_active,
    isDeleted: row.is_deleted,
    imageUrl: row.image_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapProductBatch(row: ProductBatchRow): ProductBatchItem {
  return {
    id: row.id,
    batchSeq: row.batch_seq,
    name: row.name,
    purchasePrice: row.purchase_price,
    sellingPrice: row.selling_price,
    mrp: row.mrp,
    quantityRemaining: row.quantity_remaining,
  };
}

export function parseProductDetailsPayload(
  payload: unknown,
): ProductDetailsPayload | null {
  if (!payload || typeof payload !== "object") return null;
  return payload as ProductDetailsPayload;
}

export function getStockStatus(product: ProductListItem): "out" | "low" | "ok" {
  if (product.stockQuantity <= 0) return "out";
  if (product.stockQuantity <= product.lowStockAlertQty) return "low";
  return "ok";
}
