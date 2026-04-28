import { AdminInventoryView } from '@/features/admin/admin-inventory-view';

export default function SoldItemsPage() {
  return (
    <AdminInventoryView
      statusView="sold"
      title="Sold Items"
      description="Products already sold and removed from active inventory."
    />
  );
}
