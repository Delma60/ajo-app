import { useEffect, useState } from 'react';
import { AdminInvestment } from '@/lib/types/admin-investment';
import InvestmentRow from './investment-row';
import InvestmentDetailSheet from './investment-detail-sheet';

export default function Content() {
  const [investments, setInvestments] = useState<AdminInvestment[]>([]);
  const [selected, setSelected] = useState<AdminInvestment | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/investments')
      .then((res) => res.json())
      .then((data) => {
        setInvestments(data.data.investments);
        setLoading(false);
      });
  }, []);

  function handleRowClick(inv: AdminInvestment) {
    setSelected(inv);
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    setSelected(null);
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left border rounded-lg">
        <thead>
          <tr className="bg-muted">
            <th className="px-3 py-2 text-xs font-semibold">ID</th>
            <th className="px-3 py-2 text-xs font-semibold">User</th>
            <th className="px-3 py-2 text-xs font-semibold">Package</th>
            <th className="px-3 py-2 text-xs font-semibold">Amount</th>
            <th className="px-3 py-2 text-xs font-semibold">Status</th>
            <th className="px-3 py-2 text-xs font-semibold">Created</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={6} className="text-center py-8">Loading...</td></tr>
          ) : investments.length === 0 ? (
            <tr><td colSpan={6} className="text-center py-8">No investments found.</td></tr>
          ) : (
            investments.map((inv) => (
              <InvestmentRow key={inv.id} investment={inv} onClick={() => handleRowClick(inv)} />
            ))
          )}
        </tbody>
      </table>
      <InvestmentDetailSheet
        open={open}
        onOpenChange={handleClose}
        investment={selected}
        onForceWithdraw={selected ? () => {/* TODO: implement force withdraw */} : undefined}
      />
    </div>
  );
}
