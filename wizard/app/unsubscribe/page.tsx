// Confirmation page for the link in the email footer. The actual write happens on POST to
// /api/unsubscribe (the same endpoint mail clients call for RFC 8058 one-click), so a link
// prefetcher or security scanner following the GET can never unsubscribe anyone.

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const silo = typeof params.silo === 'string' ? params.silo : '';
  const token = typeof params.token === 'string' ? params.token : '';
  return (
    <main style={{ maxWidth: 520 }}>
      <h1>Unsubscribe</h1>
      {token && token !== 'preview' ? (
        <form method="post" action="/api/unsubscribe" className="card" style={{ display: 'grid', gap: 12 }}>
          <input type="hidden" name="silo" value={silo} />
          <input type="hidden" name="token" value={token} />
          <p style={{ margin: 0 }}>Stop receiving bulk email from this candidate? Event invitations and personal notes from the candidate are separate.</p>
          <button type="submit">Unsubscribe</button>
        </form>
      ) : (
        <p className="error">This unsubscribe link is incomplete{token === 'preview' ? ' (it is a preview link)' : ''}.</p>
      )}
    </main>
  );
}
