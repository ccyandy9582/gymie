export default function AuthLayout({ children }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "1.25rem",
      }}
    >
      {children}
    </main>
  );
}
