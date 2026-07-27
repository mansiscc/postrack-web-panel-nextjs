import { CustomerTable } from "@/hooks/features/customers/components/customer-table";
import { mapCustomerRow } from "@/hooks/features/customers/types";
import { PageHeader } from "@/components/layout/page-header";
import { requireModuleAccess } from "@/lib/auth/session";
import { getCustomersList } from "@/services/customer.service";

export default async function CustomersPage() {
  await requireModuleAccess("customers");
  const rows = await getCustomersList({ includeInactive: true });

  return (
    <>
      <PageHeader
        title="Customers"
        description="Manage customer records and view bill history."
      />
      <CustomerTable customers={rows.map(mapCustomerRow)} />
    </>
  );
}
