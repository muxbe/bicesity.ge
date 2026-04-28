import { AdminInventoryView } from '@/features/admin/admin-inventory-view';

export default function DeletedItemsPage() {
  return (
    <AdminInventoryView
      statusView="archived"
      title="Deleted Items"
      description="Archived products kept out of active admin and seller inventory."
    />
  );
}
