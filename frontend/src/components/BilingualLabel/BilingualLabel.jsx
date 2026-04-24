export default function BilingualLabel({ jp, es, icon }) {
  return (
    <span style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "2px",
      lineHeight: 1,
    }}>
      <span style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "inherit",
        fontWeight: "inherit",
      }}>
        {icon && icon}
        {jp}
      </span>
      <span style={{
        fontSize: "10px",
        fontWeight: 400,
        color: "var(--ink-faint)",
        letterSpacing: "0.03em",
        fontFamily: "-apple-system, sans-serif",
      }}>
        {es}
      </span>
    </span>
  );
}
