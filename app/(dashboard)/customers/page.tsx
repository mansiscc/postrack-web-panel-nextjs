import { CustomerTable } from "@/hooks/features/customers/components/customer-table";
import { mapCustomerRow } from "@/hooks/features/customers/types";
import { requireModuleAccess } from "@/lib/auth/session";
import { getCustomersList } from "@/services/customer.service";

export default async function CustomersPage() {
  await requireModuleAccess("customers");
  const rows = await getCustomersList({ includeInactive: true });

  return <CustomerTable customers={rows.map(mapCustomerRow)} />;
}
