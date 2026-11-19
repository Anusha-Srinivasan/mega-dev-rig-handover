import type { DigestRow, Night } from '../digest/types.js';

const dash = '—';

function Row({ r }: { r: DigestRow }) {
  const failed = r.lastStatus === 'fail';
  const manyRetries = r.retries >= 3;
  return (
    <tr class={failed || manyRetries ? 'warn' : undefined}>
      <td>{r.job}</td>
      <td>{r.owner ?? dash}</td>
      <td>{r.runs}</td>
      <td>{manyRetries ? `⚠ ${r.retries} (3+ retries)` : r.retries}</td>
      <td>{failed ? '⚠ fail' : r.lastStatus}</td>
      <td>{r.lastError ?? dash}</td>
      <td>{r.firstAt}</td>
      <td>{r.lastAt}</td>
    </tr>
  );
}

export function DigestPage({ night }: { night: Night }) {
  return (
    <>
      <h1>{night.night}</h1>
      {night.badLines > 0 && (
        <p class="warn">
          {night.badLines} {night.badLines === 1 ? 'line' : 'lines'} could not be read
        </p>
      )}
      {night.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th><th>owner</th><th>runs</th><th>retries</th>
              <th>last status</th><th>last error</th><th>first</th><th>last</th>
            </tr>
          </thead>
          <tbody>
            {night.rows.map((r) => (
              <Row r={r} />
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

export function NoSuchNight({ night }: { night: string }) {
  return (
    <>
      <h1>no such night</h1>
      <p class="mute">no log for {night}</p>
    </>
  );
}
