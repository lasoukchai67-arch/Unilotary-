import { Link, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import { Layout } from './components/Layout';
import { PageHeader } from './components/ui';
import { AuditPage } from './pages/AuditPage';
import { DashboardPage } from './pages/DashboardPage';
import { DrawCreatePage } from './pages/draws/DrawCreatePage';
import { DrawDetailPage } from './pages/draws/DrawDetailPage';
import { DrawsPage } from './pages/draws/DrawsPage';
import { KycDetailPage } from './pages/kyc/KycDetailPage';
import { KycListPage } from './pages/kyc/KycListPage';
import { LoginPage } from './pages/LoginPage';
import { PayoutsPage } from './pages/PayoutsPage';
import { PinPage } from './pages/PinPage';
import { DrawReportPage, ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { UsersPage } from './pages/UsersPage';
import { WithdrawalsPage } from './pages/WithdrawalsPage';

function NotFound() {
  return (
    <section>
      <PageHeader title="ບໍ່ພົບໜ້ານີ້" />
      <Link to="/" className="btn btn--primary">
        ກັບໜ້າຫຼັກ
      </Link>
    </section>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="pin" element={<PinPage />} />
        <Route path="draws" element={<DrawsPage />} />
        <Route path="draws/new" element={<DrawCreatePage />} />
        <Route path="draws/:id" element={<DrawDetailPage />} />
        <Route path="kyc" element={<KycListPage />} />
        <Route path="kyc/:userId" element={<KycDetailPage />} />
        <Route path="withdrawals" element={<WithdrawalsPage />} />
        <Route path="payouts" element={<PayoutsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="reports/:drawId" element={<DrawReportPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
