import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Compass,
  Grape,
  LockKeyhole,
  Wine,
} from "lucide-react";
import {
  External,
  Footer,
  IconBox,
  SectionHeading,
  Sidebar,
  Topbar,
} from "./components/Shared";
import {
  homePagePath,
  libraryAndSupportSections,
  productionSections,
  wineSections,
  wineSources,
} from "./data/wine";

function WineCard({ section, primary = false }: {
  section: typeof wineSections[number];
  primary?: boolean;
}) {
  return (
    <article
      className={`wine-card${primary ? " wine-production-card" : ""}${section.id === "recipes" ? " wine-recipe-card" : ""}`}
      id={section.id}
      aria-labelledby={`${section.id}-title`}
    >
      <div className="card-top">
        <IconBox icon={section.icon} tone={section.tone} />
        <span className="wine-category">{section.category}</span>
      </div>
      <h3 id={`${section.id}-title`}>{section.title}</h3>
      <p className="wine-card-description">{section.description}</p>
      <External href={section.href} className="text-link wine-card-link">
        {section.label}
        <ArrowUpRight size={15} aria-hidden="true" />
      </External>
      <p className="wine-card-note">{section.note}</p>
    </article>
  );
}

export default function WinePage() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Sidebar />
      <div className="app-shell wine-page">
        <Topbar />
        <main id="main" tabIndex={-1}>
          <a className="text-link wine-back" href={homePagePath}>
            <ArrowLeft size={14} aria-hidden="true" />
            Back to LifeOS Home
          </a>
          <section className="wine-welcome" aria-labelledby="wine-title">
            <div>
              <p className="eyebrow">
                <Wine size={15} aria-hidden="true" /> HOME &amp; HOBBIES
              </p>
              <h1 id="wine-title">
                Wine Production<span>.</span>
              </h1>
              <p className="wine-intro">
                Plan a batch. Follow its progress. Learn from what you make.
              </p>
              <p className="home-identity">
                Navigation only · Your current records stay in Notion.
              </p>
            </div>
            <div className="wine-emblem" aria-hidden="true">
              <div className="wine-ring" />
              <div className="wine-ring inner" />
              <Grape size={62} strokeWidth={1} />
              <i />
              <i />
            </div>
          </section>

          <section
            className="wine-production"
            aria-labelledby="wine-production-title"
          >
            <SectionHeading
              id="wine-production-title"
              title="Production"
              subtitle="A clear place for each stage of a batch."
            />
            <div className="wine-grid wine-production-grid">
              {productionSections.map((section) => (
                <WineCard section={section} primary key={section.id} />
              ))}
            </div>
          </section>

          <section className="section wine-resources" aria-labelledby="wine-resources-title">
            <SectionHeading
              id="wine-resources-title"
              title="Recipes & workspace"
              subtitle="Choose a method, review its approval, and find the tools to keep moving."
            />
            <div className="wine-grid wine-resources-grid">
              {libraryAndSupportSections.map((section) => (
                <WineCard section={section} key={section.id} />
              ))}
            </div>
          </section>

          <nav className="wine-jump-links" aria-label="Wine page sections">
            {wineSections.map((section) => (
              <a href={`#${section.id}`} key={section.id}>
                {section.title}
                <ArrowRight size={12} aria-hidden="true" />
              </a>
            ))}
          </nav>

          <section
            className="wine-source-panel section"
            aria-labelledby="wine-source-title"
          >
            <div className="wine-source-heading">
              <IconBox icon={Compass} tone="mint" small />
              <div>
                <h2 id="wine-source-title">
                  One workspace. The original records.
                </h2>
                <p>
                  Wine Making owns the domain. The wine register holds
                  physical production records. The separate Recipe Library
                  holds reusable methods and verification, linked to those
                  batches. The guide holds the established workflow.
                </p>
              </div>
            </div>
            <div className="wine-source-links">
              <External href={wineSources.area} className="button wine-primary">
                Open Wine Making dashboard <ArrowUpRight size={15} aria-hidden="true" />
              </External>
              <External href={wineSources.area}>
                Wine Making area <ArrowUpRight size={13} aria-hidden="true" />
              </External>
              <External href={wineSources.register}>
                Registre de vinification{" "}
                <ArrowUpRight size={13} aria-hidden="true" />
              </External>
              <External href={wineSources.guide}>
                Wine Batch Management{" "}
                <ArrowUpRight size={13} aria-hidden="true" />
              </External>
            </div>
            <div className="wine-boundary">
              <LockKeyhole size={14} aria-hidden="true" />
              <p>
                This page provides navigation. It doesn’t display live batch
                status, measurements, tasks, or stock counts. Notion and Drive
                keep their existing access controls.
              </p>
            </div>
          </section>
          <Footer />
        </main>
      </div>
    </>
  );
}
