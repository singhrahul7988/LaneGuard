type ScreenMetaProps = {
  title: string;
  sourceHtmlPath: string;
  screenshotPath: string;
  sourceFolder: string;
  coreRegions: string[];
};

export function ScreenMeta(props: ScreenMetaProps) {
  return (
    <section className="lg-panel" style={{ padding: 24 }}>
      <div className="lg-kicker">Reference Source</div>
      <h1 className="lg-title" style={{ margin: "8px 0 10px" }}>
        {props.title}
      </h1>
      <div className="lg-stack" style={{ gap: 10 }}>
        <div className="lg-subtitle">
          HTML: <span className="lg-mono">{props.sourceHtmlPath}</span>
        </div>
        <div className="lg-subtitle">
          Screenshot: <span className="lg-mono">{props.screenshotPath}</span>
        </div>
        <div className="lg-subtitle">
          Folder: <span className="lg-mono">{props.sourceFolder}</span>
        </div>
      </div>
      <div style={{ marginTop: 18, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {props.coreRegions.map((region) => (
          <span className="lg-chip" key={region}>
            {region}
          </span>
        ))}
      </div>
    </section>
  );
}
