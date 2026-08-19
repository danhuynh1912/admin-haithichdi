import { useNavigation } from '@refinedev/core';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ToursCalendar } from './calendar';

export function TourList() {
  const { create } = useNavigation();
  // Bulk create is a screen of its own rather than a resource action, so it is
  // reached by path — refine's navigation only knows list/create/edit/show.
  const navigate = useNavigate();

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">🏔️ Tours</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/tours/bulk')}>Tạo nhiều tour</Button>
          <Button onClick={() => create('tours')}>+ Thêm Tour</Button>
        </div>
      </div>
      <ToursCalendar />
    </div>
  );
}
