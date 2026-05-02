import fetch from 'node-fetch';

// Vercel serverless function: 안전한 학교정보 프록시
// 사용 방법:
// - 직접 전체 URL 전달: /api/schoolinfo?url={ENCODED_FULL_URL}
// - 안전 모드 (권장): /api/schoolinfo?sgg=41370&apiType=0&schulKndCode=04&pbanYr=2025
//   이 경우 API 키는 서버 환경변수 SCHOOLINFO_API_KEY 로부터 읽어옵니다.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const API_BASE = 'https://www.schoolinfo.go.kr/openApi.do';

  try {
    const q = req.query || {};

    let targetUrl = null;
    if (q.url) {
      // 전달된 전체 URL을 그대로 사용
      targetUrl = q.url;
    } else if (q.sgg) {
      const apiKey = process.env.SCHOOLINFO_API_KEY || '';
      const apiType = q.apiType || '0';
      const sidoCode = q.sidoCode || '41';
      const sggCode = q.sgg;
      const schulKndCode = q.schulKndCode || q.schulKnd || '04';
      const pbanYr = q.pbanYr;

      const params = new URLSearchParams();
      if (!apiKey) {
        return res.status(500).json({ error: 'SCHOOLINFO_API_KEY not configured on server' });
      }
      params.set('apiKey', apiKey);
      params.set('apiType', apiType);
      params.set('sidoCode', sidoCode);
      params.set('sggCode', sggCode);
      params.set('schulKndCode', schulKndCode);
      if (pbanYr) params.set('pbanYr', pbanYr);

      targetUrl = API_BASE + '?' + params.toString();
    } else {
      return res.status(400).json({ error: 'url or sgg query parameter required' });
    }

    const r = await fetch(targetUrl);
    const ct = r.headers.get('content-type') || '';
    const text = await r.text();

    if (ct.includes('application/json') || ct.includes('text/xml') || ct.includes('xml')) {
      // 대부분 이 API는 JSON 또는 XML을 반환합니다. JSON이면 파싱 후 전달.
      try {
        const json = JSON.parse(text);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.status(r.status).json(json);
      } catch (e) {
        // JSON 파싱 실패 시 원문 전달
        res.setHeader('Content-Type', ct || 'text/plain; charset=utf-8');
        return res.status(r.status).send(text);
      }
    }

    res.setHeader('Content-Type', ct || 'text/plain; charset=utf-8');
    return res.status(r.status).send(text);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
