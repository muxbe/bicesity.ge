import { AdminInventoryView } from '@/features/admin/admin-inventory-view';

export default function ReservedItemsPage() {
  return (
    <AdminInventoryView
      statusView="reserved"
      title="Reserved Items"
      description="Products currently held for customers."
    />
  );
}
