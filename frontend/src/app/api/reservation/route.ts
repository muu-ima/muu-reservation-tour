// app/api/reservation/route.ts
export const runtime = 'nodejs'; // ← Edge Runtimeだと Buffer が無いので明示しておく

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // ▼ 環境変数から読む（VercelのEnvironment Variables）
    const wpUrl = process.env.WP_API_URL;          // 例: https://.../wp-json/wp/v2/reservation
    const username = process.env.WP_USER;          // 例: enyukari.k.imamura@gmail.com
    const appPassword = process.env.WP_APP_PASSWORD; // 例: vS9a ... PPRW

    // ▼ デプロイ後にログで確認（パスワードは出さない）
    if (process.env.NODE_ENV !== 'production') {
      console.log('WP_API_URL =', wpUrl);
      console.log('WP_USER set =', Boolean(username));
      console.log('WP_APP_PASSWORD set =', Boolean(appPassword));
    }

    // ▼ 必須チェック（未設定なら 500）
    if (!wpUrl || !username || !appPassword) {
      console.error('Missing WP envs', { wpUrl: !!wpUrl, username: !!username, appPassword: !!appPassword });
      return new Response('Server misconfigured: WP env vars are missing', { status: 500 });
    }

    const auth = Buffer.from(`${username}:${appPassword}`).toString('base64');

    const payload = {
      title: `${body?.last_name ?? ''} ${body?.first_name ?? ''} (${body?.date ?? ''})`,
      status: 'publish',
      meta: {
        reservation_date: body?.date ?? null,
        reservation_program: body?.program ?? null,
        reservation_slot: body?.slot ?? null,
        reservation_last_name: body?.last_name ?? null,
        reservation_first_name: body?.first_name ?? null,
        reservation_kana: body?.kana ?? null,
        reservation_email: body?.email ?? null,
        reservation_phone: body?.phone ?? null,
        reservation_notebook_type: body?.notebook_type ?? null,
        reservation_has_certificate: !!body?.has_certificate,
        reservation_note: body?.note ?? null,
        payload_json: JSON.stringify(body ?? {}),
      },
    };

    const res = await fetch(wpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
    });

    // 失敗時の中身をログに残す
    const text = await res.text();
    if (!res.ok) {
      console.error('WP Error', res.status, text);
      return new Response(text || 'Failed to post to WordPress', { status: 502 });
    }

    const json = JSON.parse(text);
    return new Response(JSON.stringify({ ok: true, wp_id: json?.id }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Route Error', err);
    return new Response('Bad Request', { status: 400 });
  }
}
