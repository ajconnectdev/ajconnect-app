const { verifyState, supabaseHeaders, supabaseUrl } = require('./_lib');

const APP_URL = 'https://app.ajconnect.ch';
const REDIRECT_URI = 'https://app.ajconnect.ch/api/instagram/callback';

module.exports = async (req, res) => {
  const { code, state, error, error_description } = req.query;

  function redirectWithStatus(status, reason) {
    const url = `${APP_URL}/?instagram=${status}` + (reason ? `&reason=${encodeURIComponent(reason)}` : '');
    res.writeHead(302, { Location: url });
    res.end();
  }

  if (error) return redirectWithStatus('error', error_description || error);
  if (!code || !state) return redirectWithStatus('error', 'Fehlende Parameter');

  const mandantId = verifyState(state, process.env.INSTAGRAM_APP_SECRET);
  if (!mandantId) return redirectWithStatus('error', 'Ungueltiger Zustand (state)');

  try {
    // 1. Autorisierungscode gegen kurzlebigen Access Token tauschen
    const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.INSTAGRAM_APP_ID,
        client_secret: process.env.INSTAGRAM_APP_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
        code
      })
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      throw new Error(tokenData.error_message || 'Token-Austausch fehlgeschlagen');
    }

    // 2. Kurzlebigen gegen langlebigen Token tauschen (60 Tage gueltig)
    const longRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env.INSTAGRAM_APP_SECRET}&access_token=${tokenData.access_token}`
    );
    const longData = await longRes.json();
    const accessToken = longData.access_token || tokenData.access_token;
    const expiresIn = longData.expires_in || 3600;

    // 3. Instagram-Profil abrufen (Username zur Anzeige)
    const profileRes = await fetch(`https://graph.instagram.com/v21.0/me?fields=id,username&access_token=${accessToken}`);
    const profile = await profileRes.json();
    if (!profile.id) throw new Error('Profil konnte nicht abgerufen werden');

    // 4. In Supabase speichern (Service Role Key, RLS wird umgangen — vom Client aus nicht lesbar)
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    const upsertRes = await fetch(supabaseUrl('instagram_accounts'), {
      method: 'POST',
      headers: { ...supabaseHeaders(), 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({
        mandant_id: mandantId,
        instagram_user_id: profile.id,
        instagram_username: profile.username,
        access_token: accessToken,
        token_expires_at: expiresAt,
        status: 'connected',
        connected_at: new Date().toISOString()
      })
    });
    if (!upsertRes.ok) {
      const errText = await upsertRes.text();
      throw new Error('Datenbank-Fehler: ' + errText);
    }

    return redirectWithStatus('connected');
  } catch (e) {
    console.error('Instagram callback error:', e);
    return redirectWithStatus('error', e.message);
  }
};
