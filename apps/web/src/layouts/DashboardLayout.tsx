import { NavLink, Outlet } from "react-router-dom";

export function DashboardLayout({ onLogout }: { onLogout: () => void }) {
  return (
    <div style={styles.wrapper}>
      <aside style={styles.sidebar}>
        <div style={styles.sidebarTop}>
          <div style={styles.logoRow}>
            <span style={styles.logo}>M</span>
            <span style={styles.brand}>MaisonDeux</span>
          </div>
        </div>

        <nav style={styles.nav}>
          <SidebarLink to="/settings" icon="&#9881;" label="Settings" />
          <SidebarLink to="/analytics" icon="&#128202;" label="Analytics" />
          <SidebarLink to="/compare" icon="&#9638;" label="Compare" />
        </nav>

        <div style={styles.sidebarBottom}>
          <button onClick={onLogout} style={styles.logoutBtn}>Sign Out</button>
        </div>
      </aside>

      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

function SidebarLink({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        ...styles.navLink,
        background: isActive ? "#3d3027" : "transparent",
        color: isActive ? "#fff" : "#a89888",
      })}
    >
      <span dangerouslySetInnerHTML={{ __html: icon }} />
      {label}
    </NavLink>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: "flex",
    minHeight: "100vh",
    fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  sidebar: {
    width: 220,
    background: "#2c2218",
    color: "#f7f3ef",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
  },
  sidebarTop: {
    padding: "20px 16px 12px",
    borderBottom: "1px solid #3d3027",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  logo: {
    width: 32,
    height: 32,
    background: "#f7f3ef",
    color: "#2c2218",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 18,
    borderRadius: 6,
  },
  brand: {
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: 0.3,
  },
  nav: {
    flex: 1,
    padding: "12px 8px",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  navLink: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 6,
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 500,
    transition: "background 0.15s",
  },
  sidebarBottom: {
    padding: "12px 16px",
    borderTop: "1px solid #3d3027",
  },
  logoutBtn: {
    width: "100%",
    padding: "8px 12px",
    background: "transparent",
    color: "#a89888",
    border: "1px solid #3d3027",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "inherit",
  },
  main: {
    flex: 1,
    background: "#fafaf8",
    padding: 32,
    overflowY: "auto",
  },
};
