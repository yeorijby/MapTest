/**
 * Vercel 서버리스 함수: 학교정보 API 프록시
 * 클라이언트에서 직접 API 호출 시 CORS 차단 문제 해결
 * 
 * 사용 방법:
 * - /api/schoolinfo?sgg=41370&apiType=0&schulKndCode=03
 * - 서버에서 API 키를 환경변수로 관리하여 보안 강화
 */

// fetch 함수 import (Node.js 18+ 기본 제공, 구버전은 node-fetch 필요)
const fetch = require('node-fetch');

/**
 * Vercel 서버리스 함수 진입점
 * @param {Object} req - HTTP 요청 객체
 * @param {Object} res - HTTP 응답 객체
 */
export default async function handler(req, res) {
  // ==================== 1. CORS 헤더 설정 ====================
  // 모든 출처에서의 요청 허용 (보안 주의: 필요시 특정 도메인만 허용)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  // OPTIONS 요청 처리 (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // ==================== 2. 요청 파라미터 추출 ====================
    const {
      sgg,           // 시군구 코드 (필수)
      apiType = '0', // API 타입 (기본값: 0 = 학교 목록)
      schulKndCode = '04', // 학교 종류 코드 (기본값: 04 = 고등학교)
      pbanYr,        // 통계 연도 (apiType=09일 때만 사용)
      sidoCode = '41' // 시도 코드 (기본값: 41 = 경기도)
    } = req.query;

    // 필수 파라미터 검증
    if (!sgg) {
      return res.status(400).json({
        error: 'Missing required parameter: sgg',
        message: '시군구 코드(sgg)가 필요합니다.',
        example: '/api/schoolinfo?sgg=41370&apiType=0&schulKndCode=03'
      });
    }

    // ==================== 3. API 키 환경변수에서 가져오기 ====================
    // 중요: 클라이언트에 노출되지 않은 서버 환경변수 사용
    const apiKey = process.env.SCHOOLINFO_API_KEY;
    
    if (!apiKey) {
      console.error('❌ SCHOOLINFO_API_KEY 환경변수가 설정되지 않았습니다');
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'API 키가 설정되지 않았습니다. Vercel 대시보드에서 환경변수를 설정하세요.'
      });
    }

    // ==================== 4. 대상 API URL 구성 ====================
    const apiBase = 'https://www.schoolinfo.go.kr/openApi.do';
    
    // 쿼리 파라미터 구성
    const params = new URLSearchParams();
    params.set('apiKey', apiKey);           // API 키
    params.set('apiType', apiType);         // API 타입
    params.set('sidoCode', sidoCode);       // 시도 코드
    params.set('sggCode', sgg);             // 시군구 코드
    params.set('schulKndCode', schulKndCode); // 학교 종류 코드
    
    // pbanYr 파라미터 추가 (apiType=09일 때만 필수)
    if (pbanYr) {
      params.set('pbanYr', pbanYr);
    }

    const targetUrl = `${apiBase}?${params.toString()}`;

    console.log('📡 학교정보 API 요청:', {
      sgg,
      apiType,
      schulKndCode,
      targetUrl: targetUrl.replace(apiKey, '***') // 로그에서 API 키 숨김
    });

    // ==================== 5. 외부 API 호출 ====================
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json, */*'
      },
      timeout: 30000 // 30초 타임아웃
    });

    // ==================== 6. 응답 상태 확인 ====================
    if (!response.ok) {
      console.error(`❌ API 응답 오류: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({
        error: 'External API error',
        message: `학교정보 API 응답 오류: ${response.status}`,
        details: response.statusText
      });
    }

    // ==================== 7. 응답 데이터 파싱 ====================
    const contentType = response.headers.get('content-type') || '';
    let data;

    try {
      if (contentType.includes('application/json')) {
        // JSON 응답
        data = await response.json();
      } else if (contentType.includes('text/xml') || contentType.includes('application/xml')) {
        // XML 응답 (필요시 변환)
        const text = await response.text();
        console.warn('⚠️ API가 XML 형식으로 응답했습니다. JSON 변환이 필요합니다.');
        data = { error: 'XML response', rawData: text };
      } else {
        // 기타 형식
        const text = await response.text();
        data = { rawResponse: text };
      }
    } catch (parseErr) {
      console.error('❌ 응답 파싱 오류:', parseErr.message);
      return res.status(500).json({
        error: 'Response parsing error',
        message: '응답 데이터를 파싱할 수 없습니다.'
      });
    }

    // ==================== 8. 응답 데이터 검증 ====================
    if (!data) {
      console.error('❌ API로부터 빈 응답을 받았습니다');
      return res.status(500).json({
        error: 'Empty response',
        message: 'API로부터 데이터를 받지 못했습니다.'
      });
    }

    // ==================== 9. 성공 응답 반환 ====================
    console.log('✓ API 응답 성공:', {
      resultCode: data.resultCode,
      itemCount: data.list?.length || 0
    });

    // CORS 헤더를 포함하여 응답 반환
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(data);

  } catch (err) {
    // ==================== 10. 에러 처리 ====================
    console.error('❌ 서버 오류:', err.message);
    
    // 타임아웃 에러 처리
    if (err.code === 'ETIMEDOUT' || err.message.includes('timeout')) {
      return res.status(504).json({
        error: 'API timeout',
        message: '학교정보 API 응답 시간 초과. 잠시 후 다시 시도하세요.'
      });
    }

    // 네트워크 에러 처리
    if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'API unreachable',
        message: '학교정보 API에 연결할 수 없습니다.'
      });
    }

    // 기타 에러
    return res.status(500).json({
      error: 'Internal server error',
      message: err.message || '서버 오류가 발생했습니다.'
    });
  }
}
