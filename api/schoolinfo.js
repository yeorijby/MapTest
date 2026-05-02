/**
 * Vercel 서버리스 함수: 학교정보 API 프록시
 * CORS 차단 우회 및 API 키 서버 사이드 보관
 */

const FALLBACK_API_KEY = '78d56edb8f784428854ce15ce720fe86';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const {
      sgg,
      apiType = '0',
      schulKndCode = '04',
      pbanYr,
      sidoCode = '41'
    } = req.query;

    if (!sgg) {
      return res.status(400).json({
        error: 'Missing required parameter: sgg',
        message: '시군구 코드(sgg)가 필요합니다.'
      });
    }

    const apiKey = process.env.SCHOOLINFO_API_KEY || FALLBACK_API_KEY;
    console.log('🔑 API 키 소스:', process.env.SCHOOLINFO_API_KEY ? 'env' : 'fallback');

    const params = new URLSearchParams();
    params.set('apiKey', apiKey);
    params.set('apiType', apiType);
    params.set('sidoCode', sidoCode);
    params.set('sggCode', sgg);
    params.set('schulKndCode', schulKndCode);
    if (pbanYr) params.set('pbanYr', pbanYr);

    const targetUrl = `https://www.schoolinfo.go.kr/openApi.do?${params.toString()}`;
    console.log('📡 요청:', { sgg, apiType, schulKndCode });

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json, */*',
        'Referer': 'https://www.schoolinfo.go.kr/'
      },
      signal: AbortSignal.timeout(30000)
    });

    const text = await response.text();
    console.log('📥 응답 상태:', response.status, '/ 길이:', text.length);

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('❌ JSON 파싱 실패. 원문(앞 200자):', text.slice(0, 200));
      return res.status(502).json({
        error: 'Parse error',
        message: '학교정보 API 응답을 파싱할 수 없습니다.',
        raw: text.slice(0, 500)
      });
    }

    console.log('✓ 응답:', { resultCode: data.resultCode, count: data.list ? data.list.length : 0 });
    return res.status(200).json(data);

  } catch (err) {
    console.error('❌ 서버 오류:', err.message);

    if (err.name === 'TimeoutError' || err.code === 'ETIMEDOUT') {
      return res.status(504).json({ error: 'API timeout', message: '학교정보 API 응답 시간 초과.' });
    }
    if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'API unreachable', message: '학교정보 API에 연결할 수 없습니다.' });
    }
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
};
