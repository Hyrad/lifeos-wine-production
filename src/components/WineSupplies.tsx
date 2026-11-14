import { ArrowUpRight } from "lucide-react";
import { External, SectionHeading } from "./Shared";
import { sources } from "../data/navigation";

// Only the purchase requirements approved for public display in WINE-SUPPLIES-01.
// This is a release snapshot, never a second checklist or a private-data export.
export default function WineSupplies() {
  return (
    <section id="supplies" className="section wine-supplies" aria-labelledby="supplies-title">
      <SectionHeading
        id="supplies-title"
        title="Wine Supplies / To Buy"
        subtitle="A quick reference for your next shopping trip."
      />
      <p className="wine-snapshot-label">
        Read-only snapshot · Last checked <time dateTime="2026-11-14">14 November 2026</time> · Not live
      </p>
      <ul className="wine-supply-list" aria-label="Supplies needed at last check">
        <li>
          <div className="wine-supply-item">
            <h3>Extra white sugar</h3>
            <strong className="wine-supply-quantity">2 kg<span className="sr-only"> to buy</span></strong>
          </div>
          <p>Batch: not yet allocated.</p>
          <p className="wine-supply-note">Additional purchase quantity; this is not a recipe dose.</p>
        </li>
        <li>
          <div className="wine-supply-item">
            <h3>Apple juice</h3>
            <strong className="wine-supply-quantity">21 L<span className="sr-only"> to buy</span></strong>
          </div>
          <p>Batch: planned cider (not started).</p>
        </li>
      </ul>
      <div className="wine-supplies-source">
        <p>
          Source of truth: LifeOS weekly grocery checklist. Quantities and purchase
          status may have changed since this snapshot. Check off purchases only in
          the live checklist.
        </p>
        <External href={sources.tasks} className="text-link">
          Open LifeOS Tasks for the live checklist <ArrowUpRight size={15} aria-hidden="true" />
        </External>
        <p>In Tasks, open “[Groceries] Weekly shopping list”. Notion access is required.</p>
      </div>
    </section>
  );
}
