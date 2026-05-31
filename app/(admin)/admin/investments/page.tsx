import { Suspense } from 'react';
import Content from '@/components/admin/investments/content';
import StatsStrip from '@/components/admin/investments/stats-strip';
import FilterBar from '@/components/admin/investments/filter-bar';

export default function AdminInvestmentsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Investments</h1>
      <Suspense fallback={null}>
        <StatsStrip />
      </Suspense>
      <FilterBar />
      <Content />
    </div>
  );
}
