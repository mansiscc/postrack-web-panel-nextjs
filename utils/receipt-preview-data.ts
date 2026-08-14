export type ReceiptPreviewData = {
  billNumber: string | null;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  /** Kept for WhatsApp share; not printed on thermal receipt (matches Android). */
  paymentMode: string;
  status?: string | null;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    rowTotal: number;
    mrp?: number | null;
  }>;
  subtotal: number;
  otherItemsAmount: number;
  discountAmount: number;
  totalPayable: number;
  receivedAmount: number;
  businessName?: string | null;
  businessAddress?: string | null;
  businessPhone?: string | null;
  businessGstin?: string | null;
  receiptFooter?: string | null;
  /** Public https URL of the business logo (Cloudinary / storage). */
  logoUrl?: string | null;
  /** When true and logoUrl is set, print/preview shows the logo. */
  showLogoOnBill?: boolean;
};

export function shouldShowReceiptLogo(data: {
  logoUrl?: string | null;
  showLogoOnBill?: boolean;
}): boolean {
  return Boolean(data.showLogoOnBill && data.logoUrl?.trim());
}
