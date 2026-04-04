export function LoadingCard({ message = "Loading..." }) {
  return (
    <div className="card fade-in" style={{ padding: "1rem 1.2rem" }}>
      <div className="label">Please Wait</div>
      <div>{message}</div>
    </div>
  );
}
