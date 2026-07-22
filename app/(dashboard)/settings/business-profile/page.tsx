import { BusinessProfileForm } from "@/features/business-profile/components/business-profile-form";
import type { BusinessProfileInput } from "@/features/business-profile/schema";
import { requireModuleAccess } from "@/lib/auth/session";
import { getBusinessProfile } from "@/services/business-profile.service";

export default async function BusinessProfilePage() {
  const user = await requireModuleAccess("business-profile");
  const company = await getBusinessProfile(user.companyId);

  if (!company) {
    return <p className="text-sm text-destructive">Company profile not found.</p>;
  }

  const initial: BusinessProfileInput = {
    businessName: company.business_name,
    phone: company.phone,
    email: company.owner_email,
    address: company.address,
    gstin: company.gstin,
    invoicePrefix: company.invoice_prefix,
    receiptFooter: company.receipt_footer,
    showLogoOnBill: company.show_logo_on_bill,
    logoUrl: company.logo_url,
  };

  return (
    <BusinessProfileForm
      initial={initial}
      canEdit={user.role === "Admin" || user.role === "Manager"}
    />
  );
}
