export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    service:   'fypro',
  })
}
