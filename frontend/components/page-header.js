export function PageHeader({ eyebrow, title, subtitle, rightSlot }) {
  return (
    <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem" }}>
      <div>
        {eyebrow ? <div className="label">{eyebrow}</div> : null}
        <h1 className="headline" style={{ margin: "0.1rem 0 0 0", fontSize: "1.8rem" }}>
          {title}
        </h1>
        {subtitle ? (
          <p className="muted" style={{ margin: "0.5rem 0 0 0", maxWidth: 780, lineHeight: 1.6 }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {rightSlot ? <div>{rightSlot}</div> : null}
    </header>
  );
}
