export type ReceiptPreviewData = {
  billNumber: string | null;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  paymentMode: string;
  status?: string | null;
  items: Array<{
    productName: string;
    quantity: number;
    rowTotal: number;
  }>;
  subtotal: number;
  otherItemsAmount: number;
  discountAmount: number;
  totalPayable: number;
  receivedAmount: number;
  businessName?: string | null;
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
