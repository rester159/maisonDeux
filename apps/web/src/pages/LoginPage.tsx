import { useState } from "react";

export function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }
    // Fake login — accept anything for now.
    onLogin();
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logoRow}>
          <span style={styles.logo}>M</span>
          <h1 style={styles.title}>MaisonDeux</h1>
        </div>
        <p style={styles.subtitle}>Second-hand luxury deal finder</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={styles.input}
            />
          </label>
          <label style={styles.label}>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              style={styles.input}
            />
          </label>
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" style={styles.btn}>Sign In</button>
        </form>

        <p style={styles.footer}>
          Don't have an account? <a href="#" style={styles.link}>Sign up</a>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#fafaf8",
    fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  card: {
    width: 380,
    padding: 40,
    background: "#fff",
    borderRadius: 12,
    boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
  },
  logo: {
    width: 40,
    height: 40,
    background: "#2c2218",
    color: "#f7f3ef",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 22,
    borderRadius: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: "#2c2218",
    margin: 0,
  },
  subtitle: {
    fontSize: 13,
    color: "#888",
    marginBottom: 28,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontSize: 12,
    fontWeight: 600,
    color: "#4a3728",
  },
  input: {
    padding: "10px 12px",
    border: "1px solid #d0c8be",
    borderRadius: 6,
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
  },
  btn: {
    padding: "12px 16px",
    background: "#2c2218",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    marginTop: 4,
  },
  error: {
    color: "#c62828",
    fontSize: 12,
    margin: 0,
  },
  footer: {
    textAlign: "center",
    fontSize: 12,
    color: "#888",
    marginTop: 20,
  },
  link: {
    color: "#2c2218",
    fontWeight: 600,
  },
};
