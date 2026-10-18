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
import { homePagePath, wineSections, wineSources } from "./data/wine";

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
                A place for every batch, every lesson,
                <br className="wine-desktop-break" /> and everything you need
                along the way.
              </p>
              <p className="home-identity">
                Surface type: Home / Operator Window · Domain: Wine Making
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

          <section className="wine-start" aria-labelledby="wine-start-title">
            <div className="wine-start-copy">
              <span className="eyebrow">YOUR STARTING POINT</span>
              <h2 id="wine-start-title">Pick up where your records live.</h2>
              <p>
                Open the register to find a batch. Continue with the original
                notes, measurements, and instructions.
              </p>
            </div>
            <External
              href={wineSources.register}
              className="button wine-primary"
            >
              Open my wine batches <ArrowUpRight size={16} aria-hidden="true" />
            </External>
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
            className="section wine-destinations"
            aria-labelledby="wine-destinations-title"
          >
            <SectionHeading
              id="wine-destinations-title"
              title="What would you like to work on?"
              subtitle="Six ways into your existing winemaking workspace."
            />
            <div className="wine-grid">
              {wineSections.map((section) => (
                <article
                  className="wine-card"
                  id={section.id}
                  key={section.id}
                  aria-labelledby={`${section.id}-title`}
                >
                  <div className="card-top">
                    <IconBox icon={section.icon} tone={section.tone} />
                    <span className="wine-card-number">{section.number}</span>
                  </div>
                  <span className="wine-category">{section.category}</span>
                  <h3 id={`${section.id}-title`}>{section.title}</h3>
                  <p className="wine-card-description">{section.description}</p>
                  <External
                    href={section.href}
                    className="text-link wine-card-link"
                  >
                    {section.label}
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </External>
                  <p className="wine-card-note">{section.note}</p>
                </article>
              ))}
            </div>
          </section>

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
                  production records, and the guide holds the established
                  workflow.
                </p>
              </div>
            </div>
            <div className="wine-source-links">
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
