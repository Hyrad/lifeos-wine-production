import { useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { SectionHeading } from './Shared';

type Item = {
  name: string; quantity: string; unit: string; purpose: string;
  classification: 'confirmed' | 'conditional' | 'review'; condition: string;
};
type Shopping = { items: Item[]; fetchedAt: string };
const endpoint = '/api/v1/wine-supplies';
const errors: Record<string, string> = {
  permission: 'Access denied. Confirm your approved device and Notion connection access.',
  timeout: 'LifeOS did not respond in time. Try again.',
  offline: 'You appear to be offline. Reconnect to your private network and try again.',
  network: 'Unable to reach LifeOS. Check your connection and try again.',
  invalid: 'LifeOS returned an incomplete response. Try again.',
  upstream: 'The shopping source is unavailable. Check its connection permissions and try again.',
  busy: 'A refresh is already running or the request limit was reached. Wait a moment and try again.',
};
function validate(value: unknown): Shopping {
  if (!value || typeof value !== 'object') throw Error('invalid');
  const d = value as Shopping;
  if (Object.keys(d).sort().join(',') !== 'fetchedAt,items' || !Array.isArray(d.items) || d.items.length > 100 || typeof d.fetchedAt !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(d.fetchedAt) || !Number.isFinite(Date.parse(d.fetchedAt))) throw Error('invalid');
  for (const item of d.items) {
    if (!item || typeof item !== 'object' || Object.keys(item).sort().join(',') !== 'classification,condition,name,purpose,quantity,unit') throw Error('invalid');
    if (!['confirmed', 'conditional', 'review'].includes(item.classification)) throw Error('invalid');
    for (const key of ['name', 'quantity', 'unit', 'purpose', 'condition'] as const) {
      if (typeof item[key] !== 'string' || item[key].length > 8000 || /https?:\/\/|\b[a-f0-9]{32}\b|\b[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\b|(?:ntn_|secret_)[A-Za-z0-9_]+/i.test(item[key])) throw Error('invalid');
    }
    if (!item.name || (item.classification === 'conditional' && !item.condition)) throw Error('invalid');
  }
  return d;
}
export default function PrivateWineSupplies() {
  const [shopping, setShopping] = useState<Shopping | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  async function refresh() {
    if (busy.current) return;
    setError('');
    if (!navigator.onLine) { setError('offline'); return; }
    busy.current = true; setLoading(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(endpoint, { method: 'GET', headers: { 'X-LifeOS-Client': 'wine-private', Accept: 'application/json' }, signal: controller.signal, cache: 'no-store', credentials: 'omit', redirect: 'error' });
      if (res.status === 401 || res.status === 403) throw Error('permission');
      if (res.status === 429) throw Error('busy');
      if (res.status === 504) throw Error('timeout');
      if (!res.ok) throw Error('upstream');
      if (!(res.headers.get('content-type') || '').includes('application/json')) throw Error('invalid');
      const raw = await res.text();
      if (raw.length > 200000) throw Error('invalid');
      let parsed;
      try { parsed = JSON.parse(raw); } catch { throw Error('invalid'); }
      setShopping(validate(parsed));
    } catch (e) {
      const err = e instanceof Error ? e : Error();
      setError(controller.signal.aborted ? 'timeout' : err.message in errors ? err.message : navigator.onLine ? 'network' : 'offline');
    } finally {
      clearTimeout(timeout); busy.current = false; setLoading(false);
    }
  }
  const groups = [
    ['confirmed', 'Confirmed purchases'], ['conditional', 'Conditional purchases'], ['review', 'Purchases needing clarification'],
  ] as const;
  return (
    <section id="supplies" className="section wine-supplies" aria-labelledby="supplies-title">
      <SectionHeading id="supplies-title" title="Wine Supplies / To Buy" subtitle="Only outstanding purchases from your LifeOS winemaking checklist." />
      <button className="wine-refresh-button" onClick={refresh} disabled={loading} aria-controls="wine-live-results">
        <RefreshCw size={17} aria-hidden="true" />{loading ? 'Refreshing…' : 'Refresh from LifeOS'}
      </button>
      <div role="status" aria-live="polite" className="wine-live-status">
        {loading ? 'Reading your current LifeOS checklist…' : error ? '' : shopping ? 'Refresh successful.' : 'No live data loaded. Refresh to check current purchases.'}
      </div>
      {error && <p className="wine-live-error" role="alert">{errors[error]} {shopping ? 'Previous results are stale; the last successful refresh has not changed.' : 'No current purchases could be verified.'}</p>}
      <p className="wine-snapshot-label">
        Last successful refresh: {shopping ? <time dateTime={shopping.fetchedAt}>{new Date(shopping.fetchedAt).toLocaleString()}</time> : 'never'}
        {shopping && error ? ' · Stale' : shopping && loading ? ' · Refresh in progress; showing previous results' : shopping ? ' · Live read at the time shown' : ''}
      </p>
      <div id="wine-live-results" aria-busy={loading}>
        {shopping?.items.length === 0 && <p className="wine-empty">No outstanding winemaking purchases at the last successful refresh.</p>}
        {groups.map(([classification, title]) => {
          const items = shopping?.items.filter(i => i.classification === classification) || [];
          return items.length > 0 && <div className="wine-live-group" key={classification}>
            <h3>{title}</h3>
            <ul className="wine-supply-list" aria-label={title}>{items.map((item, index) => <li key={`${item.name}-${index}`}>
              <div className="wine-supply-item"><h4>{item.name}</h4><strong className="wine-supply-quantity">{item.quantity && item.unit ? `${item.quantity} ${item.unit}` : 'Quantity to confirm'}</strong></div>
              <p>{item.purpose}</p>
              {item.classification === 'conditional' && <p className="wine-condition"><strong>Conditional — confirm before buying.</strong> {item.condition !== item.purpose && item.condition}</p>}
              {item.classification === 'review' && <p className="wine-condition">Confirm the quantity and purchasing requirements before buying.</p>}
            </li>)}</ul>
          </div>;
        })}
      </div>
      <div className="wine-supplies-source"><p>Source of truth: the LifeOS weekly grocery checklist, winemaking section only. This view is read-only. Record purchases in Notion; refresh here afterward. No separate purchase state is stored.</p></div>
    </section>
  );
}
