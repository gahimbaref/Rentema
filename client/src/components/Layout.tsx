import { Link, useLocation, Outlet } from 'react-router-dom';
import './Layout.css';

const Layout = () => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="logo">
          <h1>Rentema</h1>
        </div>
        <ul className="nav-links">
          <li>
            <Link to="/inquiries" className={isActive('/inquiries') ? 'active' : ''}>
              Inquiries
            </Link>
          </li>
          <li>
            <Link to="/properties" className={isActive('/properties') ? 'active' : ''}>
              Properties
            </Link>
          </li>
          <li>
            <Link to="/platforms" className={isActive('/platforms') ? 'active' : ''}>
              Platforms
            </Link>
          </li>
          <li>
            <Link to="/email" className={isActive('/email') ? 'active' : ''}>
              Email Integration
            </Link>
          </li>
          <li>
            <Link to="/scheduling" className={isActive('/scheduling') ? 'active' : ''}>
              Scheduling
            </Link>
          </li>
          <li>
            <Link to="/templates" className={isActive('/templates') ? 'active' : ''}>
              Templates
            </Link>
          </li>
          <li>
            <Link to="/test-mode" className={isActive('/test-mode') ? 'active' : ''}>
              Test Mode
            </Link>
          </li>
        </ul>
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
