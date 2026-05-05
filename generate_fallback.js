/**
 * 학교 정보 API 데이터를 미리 받아 schools_fallback.json으로 저장하는 스크립트.
 * Vercel 서버가 schoolinfo.go.kr에 접근 불가한 경우를 대비한 정적 폴백 데이터 생성.
 *
 * 사용법: node generate_fallback.js
 */

const https = require('https');
const fs = require('fs');

const API_KEY = '78d56edb8f784428854ce15ce720fe86';
const SIDO_CODE = '41';
const SGG_CODES = ['41370', '41110', '41591', '41593', '41595', '41597'];
const SCHUL_KND_CODES = ['02', '03', '04']; // 초등, 중, 고

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.schoolinfo.go.kr/' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON 파싱 실패: ' + data.slice(0, 100))); }
      });
    }).on('error', reject);
  });
}

async function fetchList(sgg, schulKnd) {
  const url = `https://www.schoolinfo.go.kr/openApi.do?apiKey=${API_KEY}&apiType=0&sidoCode=${SIDO_CODE}&sggCode=${sgg}&schulKndCode=${schulKnd}`;
  try {
    const data = await httpGet(url);
    if (data.resultCode === 'success' && Array.isArray(data.list)) return data.list;
    return [];
  } catch (e) {
    console.warn(`  ✗ 목록 실패 (${sgg}/${schulKnd}): ${e.message}`);
    return [];
  }
}

async function fetchStats(sgg, schulKnd, year) {
  const url = `https://www.schoolinfo.go.kr/openApi.do?apiKey=${API_KEY}&apiType=09&sidoCode=${SIDO_CODE}&sggCode=${sgg}&schulKndCode=${schulKnd}&pbanYr=${year}`;
  try {
    const data = await httpGet(url);
    if (data.resultCode === 'success' && Array.isArray(data.list)) return data.list;
    return [];
  } catch (e) {
    console.warn(`  ✗ 통계 실패 (${sgg}/${schulKnd}): ${e.message}`);
    return [];
  }
}

async function main() {
  const statsYear = String(new Date().getFullYear() - 1);
  const result = {};

  for (const schulKnd of SCHUL_KND_CODES) {
    const label = { '02': '초등학교', '03': '중학교', '04': '고등학교' }[schulKnd];
    console.log(`\n📚 ${label} 데이터 수집 중...`);

    let allSchools = [];
    const statsMap = {};

    for (const sgg of SGG_CODES) {
      const [schools, stats] = await Promise.all([
        fetchList(sgg, schulKnd),
        fetchStats(sgg, schulKnd, statsYear)
      ]);

      allSchools = allSchools.concat(schools);
      stats.forEach(s => {
        const key = s.SCHUL_CODE || s.SD_SCHUL_CODE || s.SCHUL_NM;
        if (key) statsMap[key] = s;
      });

      if (schools.length > 0) {
        console.log(`  ✓ sgg=${sgg}: 학교 ${schools.length}개, 통계 ${stats.length}개`);
      }
    }

    // 통계 데이터 붙이기
    allSchools.forEach(school => {
      const key = school.SCHUL_CODE || school.SD_SCHUL_CODE || school.SCHUL_NM;
      if (key && statsMap[key]) {
        school._stats = statsMap[key];
        school._stats._displayYear = statsYear;
      }
    });

    result[schulKnd] = allSchools;
    console.log(`  → 총 ${allSchools.length}개 학교 수집`);
  }

  const total = Object.values(result).reduce((s, arr) => s + arr.length, 0);

  if (total === 0) {
    console.error('\n❌ 데이터를 받아오지 못했습니다. schoolinfo.go.kr API 키와 네트워크 연결을 확인하세요.');
    process.exit(1);
  }

  fs.writeFileSync('./schools_fallback.json', JSON.stringify(result, null, 2), 'utf-8');
  console.log(`\n✅ schools_fallback.json 생성 완료 (총 ${total}개 학교)`);
  console.log('   이 파일을 git commit 후 Vercel에 배포하면 해외에서도 마커가 표시됩니다.');
}

main().catch(err => {
  console.error('오류:', err.message);
  process.exit(1);
});
