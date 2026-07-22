const { supabaseHeaders, supabaseUrl } = require('./_lib');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// POST /api/instagram/publish  Body: { mandant_id, video_url, caption }
// video_url muss oeffentlich erreichbar sein (z.B. Supabase Storage public URL)
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { mandant_id, video_url, caption } = req.body || {};
  if (!mandant_id || !video_url) {
    res.status(400).json({ error: 'mandant_id und video_url sind Pflichtfelder' });
    return;
  }

  try {
    // 1. Gespeicherten Zugang der Gemeinde laden
    const accRes = await fetch(
      supabaseUrl(`instagram_accounts?mandant_id=eq.${mandant_id}&select=access_token,instagram_user_id,status`),
      { headers: supabaseHeaders() }
    );
    const rows = await accRes.json();
    const account = Array.isArray(rows) ? rows[0] : null;
    if (!account || account.status !== 'connected') {
      res.status(400).json({ error: 'Kein aktiver Instagram-Zugang für diese Gemeinde. Bitte zuerst verbinden.' });
      return;
    }

    // 2. Media Container erstellen (Reel)
    const createRes = await fetch(`https://graph.instagram.com/v21.0/${account.instagram_user_id}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'REELS',
        video_url,
        caption: caption || '',
        access_token: account.access_token
      })
    });
    const createData = await createRes.json();
    if (!createData.id) {
      throw new Error(createData.error?.message || 'Container-Erstellung fehlgeschlagen');
    }
    const creationId = createData.id;

    // 3. Verarbeitungsstatus abfragen (max. ~60 Sekunden warten)
    let statusCode = 'IN_PROGRESS';
    for (let i = 0; i < 20 && statusCode !== 'FINISHED'; i++) {
      await sleep(3000);
      const statusRes = await fetch(
        `https://graph.instagram.com/v21.0/${creationId}?fields=status_code&access_token=${account.access_token}`
      );
      const statusData = await statusRes.json();
      statusCode = statusData.status_code;
      if (statusCode === 'ERROR') throw new Error('Instagram konnte das Video nicht verarbeiten');
    }
    if (statusCode !== 'FINISHED') {
      throw new Error('Zeitüberschreitung — Video wird noch verarbeitet, bitte später erneut versuchen');
    }

    // 4. Veroeffentlichen
    const publishRes = await fetch(`https://graph.instagram.com/v21.0/${account.instagram_user_id}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: creationId, access_token: account.access_token })
    });
    const publishData = await publishRes.json();
    if (!publishData.id) {
      throw new Error(publishData.error?.message || 'Veröffentlichung fehlgeschlagen');
    }

    res.status(200).json({ success: true, media_id: publishData.id });
  } catch (e) {
    console.error('Publish error:', e);
    res.status(500).json({ error: e.message });
  }
};
