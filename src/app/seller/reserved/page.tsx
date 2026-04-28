import { AdminInventoryView } from '@/features/admin/admin-inventory-view';

export default function SellerReservedItemsPage() {
  return (
    <AdminInventoryView
      role="seller"
      statusView="reserved"
      title="Reserved Items"
      description="Products currently reserved for customers."
    />
  );
}
