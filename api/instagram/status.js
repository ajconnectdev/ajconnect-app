const { supabaseHeaders, supabaseUrl } = require('./_lib');

// GET /api/instagram/status?mandant_id=xxx
// Gibt NUR zurueck, ob verbunden + Username — der Access Token verlaesst den Server nie.
module.exports = async (req, res) => {
  const mandantId = req.query.mandant_id;
  if (!mandantId) {
    res.status(400).json({ error: 'mandant_id fehlt' });
    return;
  }

  try {
    const r = await fetch(
      supabaseUrl(`instagram_accounts?mandant_id=eq.${mandantId}&select=instagram_username,status,connected_at`),
      { headers: supabaseHeaders() }
    );
    const rows = await r.json();
    const row = Array.isArray(rows) ? rows[0] : null;

    if (!row || row.status !== 'connected') {
      res.status(200).json({ connected: false });
      return;
    }
    res.status(200).json({ connected: true, username: row.instagram_username, connectedAt: row.connected_at });
  } catch (e) {
    console.error('Status error:', e);
    res.status(500).json({ error: e.message });
  }
};
