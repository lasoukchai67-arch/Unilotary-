import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth, useCurrentUser } from '../auth/AuthContext';
import { roleLabel } from '../lib/labels';

const NAV: { to: string; label: string; end?: boolean }[] = [
  { to: '/', label: 'ໜ້າຫຼັກ', end: true },
  { to: '/draws', label: 'ງວດຫວຍ' },
  { to: '/kyc', label: 'ຢືນຢັນຕົວຕົນ (KYC)' },
  { to: '/withdrawals', label: 'ຖອນເງິນ' },
  { to: '/payouts', label: 'ຈ່າຍລາງວັນ' },
  { to: '/users', label: 'ຜູ້ໃຊ້' },
  { to: '/reports', label: 'ລາຍງານ' },
  { to: '/audit', label: 'ບັນທຶກການກວດສອບ' },
  { to: '/settings', label: 'ຕັ້ງຄ່າ' },
];

export function Layout() {
  const user = useCurrentUser();
  const { signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        ຂ້າມໄປເນື້ອຫາ
      </a>
      <header className="sidebar">
        <div className="sidebar__top">
          <Link to="/" className="brand">
            <span className="brand__mark" aria-hidden="true">
              ຫ
            </span>
            <span className="brand__text">
              ຫວຍພັດທະນາ
              <small>ລະບົບຈັດການ</small>
            </span>
          </Link>
          <button
            type="button"
            className="menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="main-nav"
            aria-label={menuOpen ? 'ປິດເມນູ' : 'ເປີດເມນູ'}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span aria-hidden="true">{menuOpen ? '×' : '☰'}</span>
          </button>
        </div>
        <nav id="main-nav" className={`nav${menuOpen ? ' nav--open' : ''}`} aria-label="ເມນູຫຼັກ">
          <ul>
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} onClick={() => setMenuOpen(false)}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="nav__user">
            <div className="nav__phone">{user.fullName || user.phone}</div>
            <div className="nav__role">
              {roleLabel(user.role)}
              {user.role === 'auditor' ? ' · ອ່ານຢ່າງດຽວ' : ''}
            </div>
            <div className="nav__user-actions">
              <NavLink to="/pin" className="nav__small-link">
                {user.pinSet ? 'ປ່ຽນ PIN' : 'ຕັ້ງ PIN'}
              </NavLink>
              <button type="button" className="btn btn--ghost-light btn--sm" onClick={() => void signOut()}>
                ອອກຈາກລະບົບ
              </button>
            </div>
          </div>
        </nav>
      </header>
      <main id="main" className="main" tabIndex={-1}>
        {!user.pinSet && location.pathname !== '/pin' ? (
          <div className="alert alert--warn banner" role="status">
            <div className="alert__body">
              ທ່ານຍັງບໍ່ໄດ້ຕັ້ງລະຫັດ PIN. <Link to="/pin">ຕັ້ງ PIN ດຽວນີ້</Link>
            </div>
          </div>
        ) : null}
        <Outlet />
      </main>
    </div>
  );
}
