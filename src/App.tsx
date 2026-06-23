import { Refine, Authenticated } from '@refinedev/core';
import { dataProvider, liveProvider } from '@refinedev/supabase';
import routerProvider from '@refinedev/react-router';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { authProvider } from '@/lib/authProvider';
import { Layout } from '@/components/Layout';
import { Login } from '@/pages/Login';
import { LocationList } from '@/pages/locations';
import { LocationForm } from '@/pages/locations/form';
import { TourList } from '@/pages/tours';
import { TourForm } from '@/pages/tours/form';
import { BookingList } from '@/pages/bookings';
import { LeaderList } from '@/pages/leaders';
import { LeaderForm } from '@/pages/leaders/form';

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
          { name: 'leaders', list: '/leaders', edit: '/leaders/edit/:id', meta: { label: 'Leaders' } },
        ]}
        options={{ syncWithLocation: true, warnWhenUnsavedChanges: true }}
      >
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<Authenticated key="auth" fallback={<Navigate to="/login" />}><Layout /></Authenticated>}>
            <Route index element={<Navigate to="/bookings" />} />
            <Route path="/locations" element={<LocationList />} />
            <Route path="/locations/create" element={<LocationForm mode="create" />} />
            <Route path="/locations/edit/:id" element={<LocationForm mode="edit" />} />
            <Route path="/tours" element={<TourList />} />
            <Route path="/tours/create" element={<TourForm mode="create" />} />
            <Route path="/tours/edit/:id" element={<TourForm mode="edit" />} />
            <Route path="/bookings" element={<BookingList />} />
            <Route path="/leaders" element={<LeaderList />} />
            <Route path="/leaders/edit/:id" element={<LeaderForm mode="edit" />} />
          </Route>
        </Routes>
      </Refine>
    </BrowserRouter>
  );
}
