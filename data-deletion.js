const { parseSignedRequest, supabaseHeaders, supabaseUrl } = require('./_lib');

// POST /api/instagram/data-deletion — Pflicht-Endpunkt von Meta (DSGVO).
// Muss ein JSON mit { url, confirmation_code } zurueckgeben.
module.exports = async (req, res) => {
  // Status-Abfrage per GET (Nutzer klickt auf den zurueckgegebenen Link)
  if (req.method === 'GET' && req.query.id) {
    res.status(200).send(`Löschanfrage ${req.query.id}: abgeschlossen.`);
    return;
  }

  try {
    const signedRequest = (req.body && req.body.signed_request) || req.query.signed_request;
    if (!signedRequest) {
      res.status(400).json({ error: 'signed_request fehlt' });
      return;
    }
    const data = parseSignedRequest(signedRequest, process.env.INSTAGRAM_APP_SECRET);
    const igUserId = data.user_id;
    const confirmationCode = `del_${igUserId}_${Date.now()}`;

    await fetch(supabaseUrl(`instagram_accounts?instagram_user_id=eq.${igUserId}`), {
      method: 'DELETE',
      headers: supabaseHeaders()
    });

    res.status(200).json({
      url: `https://app.ajconnect.ch/api/instagram/data-deletion?id=${confirmationCode}`,
      confirmation_code: confirmationCode
    });
  } catch (e) {
    console.error('Data deletion error:', e);
    res.status(200).json({ url: 'https://app.ajconnect.ch', confirmation_code: 'error' });
  }
};
