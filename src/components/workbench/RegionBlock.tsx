import { PropsWithChildren } from "react";

type RegionBlockProps = PropsWithChildren<{
  region: string;
  title: string;
  note?: string;
}>;

export function RegionBlock({ children, note, region, title }: RegionBlockProps) {
  return (
    <section className="lg-region" data-region={region} style={{ padding: 16 }}>
      <div className="lg-region-header">
        <div>
          <div className="lg-kicker">{region}</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{title}</div>
        </div>
      </div>
      {note ? (
        <p className="lg-subtitle" style={{ marginTop: 0, marginBottom: 14 }}>
          {note}
        </p>
      ) : null}
      {children}
    </section>
  );
}
