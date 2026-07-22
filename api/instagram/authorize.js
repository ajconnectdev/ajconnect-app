const { signState } = require('./_lib');

// GET /api/instagram/authorize?mandant_id=xxx
// Baut die Instagram-Login-URL serverseitig (App Secret bleibt hier, nie im Browser)
// und leitet den Nutzer direkt zu Instagram weiter.
module.exports = async (req, res) => {
  const mandantId = req.query.mandant_id;
  if (!mandantId) {
    res.status(400).send('mandant_id fehlt');
    return;
  }

  const state = signState(mandantId, process.env.INSTAGRAM_APP_SECRET);

  const params = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID,
    redirect_uri: 'https://app.ajconnect.ch/api/instagram/callback',
    scope: 'instagram_business_basic,instagram_business_content_publish',
    response_type: 'code',
    state
  });

  res.writeHead(302, { Location: `https://www.instagram.com/oauth/authorize?${params.toString()}` });
  res.end();
};
