/**
 * Vercel 서버리스 함수: 학교정보 API 프록시
 * CORS 차단 우회 및 API 키 서버 사이드 보관
 */

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
        message: '시군구 코드(sgg)가 필요합니다.',
        example: '/api/schoolinfo?sgg=41370&apiType=0&schulKndCode=03'
      });
    }

    const apiKey = process.env.SCHOOLINFO_API_KEY;

    if (!apiKey) {
      console.error('❌ SCHOOLINFO_API_KEY 환경변수가 설정되지 않았습니다');
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'API 키가 설정되지 않았습니다. Vercel 대시보드에서 환경변수를 설정하세요.'
      });
    }

    const params = new URLSearchParams();
    params.set('apiKey', apiKey);
    params.set('apiType', apiType);
    params.set('sidoCode', sidoCode);
    params.set('sggCode', sgg);
    params.set('schulKndCode', schulKndCode);
    if (pbanYr) params.set('pbanYr', pbanYr);

    const targetUrl = `https://www.schoolinfo.go.kr/openApi.do?${params.toString()}`;

    console.log('📡 학교정보 API 요청:', { sgg, apiType, schulKndCode });

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json, */*'
      },
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      console.error(`❌ API 응답 오류: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({
        error: 'External API error',
        message: `학교정보 API 응답 오류: ${response.status}`
      });
    }

    const contentType = response.headers.get('content-type') || '';
    let data;

    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = { rawResponse: text };
      }
    }

    console.log('✓ API 응답 성공:', {
      resultCode: data.resultCode,
      itemCount: data.list ? data.list.length : 0
    });

    return res.status(200).json(data);

  } catch (err) {
    console.error('❌ 서버 오류:', err.message);

    if (err.name === 'TimeoutError' || err.code === 'ETIMEDOUT') {
      return res.status(504).json({
        error: 'API timeout',
        message: '학교정보 API 응답 시간 초과.'
      });
    }

    if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'API unreachable',
        message: '학교정보 API에 연결할 수 없습니다.'
      });
    }

    return res.status(500).json({
      error: 'Internal server error',
      message: err.message || '서버 오류가 발생했습니다.'
    });
  }
};
