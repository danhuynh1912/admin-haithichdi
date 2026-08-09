import { Refine, Authenticated } from '@refinedev/core';
import { dataProvider, liveProvider } from '@refinedev/supabase';
import routerProvider from '@refinedev/react-router';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { authProvider } from '@/lib/authProvider';
import { Layout } from '@/components/Layout';
import { RequireAdmin } from '@/components/RequireAdmin';
import { Login } from '@/pages/Login';
import { LocationList } from '@/pages/locations';
import { LocationForm } from '@/pages/locations/form';
import { TourList } from '@/pages/tours';
import { TourForm } from '@/pages/tours/form';
import { BookingList } from '@/pages/bookings';
import { StaffList } from '@/pages/staff';
import { StaffForm } from '@/pages/staff/form';

export default function App() {
  return (
    <BrowserRouter>
      <Refine
        dataProvider={dataProvider(supabase)}
        liveProvider={liveProvider(supabase)}
        authProvider={authProvider}
        routerProvider={routerProvider}
        resources={[
          { name: 'locations', list: '/locations', create: '/locations/create', edit: '/locations/edit/:id' },
          { name: 'tours', list: '/tours', create: '/tours/create', edit: '/tours/edit/:id' },
          { name: 'bookings', list: '/bookings' },
          // Read-only from the tour form, which previews what the route lends it.
          { name: 'location_images' },
          { name: 'location_itinerary_days' },
          // table is `profiles`; the list reads the `staff_admin` view (adds email)
          { name: 'profiles', list: '/staff', create: '/staff/create', edit: '/staff/edit/:id', meta: { label: 'Tài khoản' } },
          { name: 'staff_admin', list: '/staff' },
        ]}
        options={{ syncWithLocation: true, warnWhenUnsavedChanges: true }}
      >
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<Authenticated key="auth" fallback={<Navigate to="/login" />}><Layout /></Authenticated>}>
            {/* Bookings is the only screen a sale may open, so it is the landing
                page for everyone and the destination RequireAdmin bounces to. */}
            <Route index element={<Navigate to="/bookings" />} />
            <Route path="/bookings" element={<BookingList />} />

            <Route path="/locations" element={<RequireAdmin><LocationList /></RequireAdmin>} />
            <Route path="/locations/create" element={<RequireAdmin><LocationForm mode="create" /></RequireAdmin>} />
            <Route path="/locations/edit/:id" element={<RequireAdmin><LocationForm mode="edit" /></RequireAdmin>} />
            <Route path="/tours" element={<RequireAdmin><TourList /></RequireAdmin>} />
            <Route path="/tours/create" element={<RequireAdmin><TourForm mode="create" /></RequireAdmin>} />
            <Route path="/tours/edit/:id" element={<RequireAdmin><TourForm mode="edit" /></RequireAdmin>} />
            <Route path="/staff" element={<RequireAdmin><StaffList /></RequireAdmin>} />
            <Route path="/staff/create" element={<RequireAdmin><StaffForm mode="create" /></RequireAdmin>} />
            <Route path="/staff/edit/:id" element={<RequireAdmin><StaffForm mode="edit" /></RequireAdmin>} />

            {/* Anything else, including links to the routes this panel used to have. */}
            <Route path="*" element={<Navigate to="/bookings" replace />} />
          </Route>
        </Routes>
      </Refine>
    </BrowserRouter>
  );
}
