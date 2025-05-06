export default async function handler(req, res) {
    const { lat, lng, minutes = 30, profile = 'driving' } = req.query;
    const token = process.env.MAPBOX_KEY;
  
    const url = `https://api.mapbox.com/isochrone/v1/mapbox/${profile}/${lng},${lat}?contours_minutes=${minutes}&polygons=true&access_token=${token}`;
  
    try {
      const response = await fetch(url);
      const data = await response.json();
      res.setHeader('Access-Control-Allow-Origin', '*'); // CORS 허용
      res.status(200).json(data);
    } catch (error) {
      res.status(500).json({ error: 'Mapbox API 호출 실패', details: error.message });
    }
  }
  