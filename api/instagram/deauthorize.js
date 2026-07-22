const { parseSignedRequest, supabaseHeaders, supabaseUrl } = require('./_lib');

// POST /api/instagram/deauthorize — wird von Meta aufgerufen, wenn ein Nutzer
// den Zugriff in seinen Instagram-Einstellungen widerruft.
module.exports = async (req, res) => {
  try {
    const signedRequest = (req.body && req.body.signed_request) || req.query.signed_request;
    if (!signedRequest) {
      res.status(400).json({ error: 'signed_request fehlt' });
      return;
    }
    const data = parseSignedRequest(signedRequest, process.env.INSTAGRAM_APP_SECRET);
    const igUserId = data.user_id;

    await fetch(supabaseUrl(`instagram_accounts?instagram_user_id=eq.${igUserId}`), {
      method: 'PATCH',
      headers: supabaseHeaders(),
      body: JSON.stringify({ status: 'revoked' })
    });

    res.status(200).json({ success: true });
  } catch (e) {
    console.error('Deauthorize error:', e);
    // Meta erwartet trotzdem 200, sonst wird der Aufruf wiederholt
    res.status(200).json({ success: true });
  }
};
