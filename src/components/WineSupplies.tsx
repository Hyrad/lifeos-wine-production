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
        subtitle="Check current needs in your LifeOS checklist before shopping."
      />
      <div className="wine-refresh-unavailable" role="note" aria-label="Live refresh unavailable">
        <h3>Live refresh unavailable</h3>
        <p>
          This page is not connected to your live checklist. The older snapshot
          below may omit recent additions or include items already purchased.
        </p>
        <p>Last successful live refresh: never.</p>
      </div>
      <p className="wine-snapshot-label">
        Read-only snapshot · Captured <time dateTime="2026-11-14">14 November 2026</time> · Not live
      </p>
      <ul className="wine-supply-list" aria-label="Purchases recorded in the older snapshot">
        <li>
          <div className="wine-supply-item">
            <h3>Extra white sugar</h3>
            <strong className="wine-supply-quantity">2 kg<span className="sr-only"> in the snapshot</span></strong>
          </div>
          <p>Batch: not yet allocated.</p>
          <p className="wine-supply-note">Additional purchase quantity; this is not a recipe dose.</p>
        </li>
        <li>
          <div className="wine-supply-item">
            <h3>Apple juice</h3>
            <strong className="wine-supply-quantity">21 L<span className="sr-only"> in the snapshot</span></strong>
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
        <details className="wine-checklist-help">
          <summary>Manage purchases in Notion</summary>
          <p>
            This opens shared Tasks, which includes unrelated items. Open
            “[Groceries] Weekly shopping list”, then find the winemaking section.
            Notion access is required.
          </p>
          <External href={sources.tasks} className="text-link">
            Open shared LifeOS Tasks <ArrowUpRight size={15} aria-hidden="true" />
          </External>
        </details>
      </div>
    </section>
  );
}
