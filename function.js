// Cleaned function.js - core helpers for map app
let gApi_key = '78d56edb8f784428854ce15ce720fe86';
let gUrl = 'https://www.schoolinfo.go.kr/openApi.do';
let gParams;

function CreateContentsTag(No, PosName, img, DoRoMyung, JiBun, HomePage, members, fond, tel, fax, coedCode, stats) {
  // 공학 구분 처리
  var coedText = '정보없음';
  if (coedCode) {
    var cc = String(coedCode);
    if (/남/.test(cc)) coedText = '남녀공학';
    else if (/여/.test(cc)) coedText = '여학교';
    else if (cc === '1' || cc === '01' || /Y/i.test(cc)) coedText = '남녀공학';
    else if (cc === '2' || cc === '02') coedText = '남학교';
    else if (cc === '3' || cc === '03') coedText = '여학교';
    else coedText = cc;
  }

  // 홈페이지 링크
  var homepageHtml = '';
  if (HomePage && String(HomePage).trim().length > 0) {
    var href = String(HomePage).trim();
    if (!/^https?:\/\//i.test(href)) href = 'http://' + href;
    homepageHtml = `<div><a href="${href}" target="_blank" class="link">홈페이지</a></div>`;
  }

  // stats 자동 추출 helper
  function autoGetStat(obj, keywordGroups, usedKeys) {
    if (!obj) return { key: null, value: '' };
    usedKeys = usedKeys || [];
    var keys = Object.keys(obj).filter(k => usedKeys.indexOf(k) === -1);
    // 정확한 키
    for (var gi = 0; gi < keywordGroups.length; gi++) {
      var group = keywordGroups[gi];
      for (var ki = 0; ki < group.length; ki++) {
        var k = group[ki];
        for (var i = 0; i < keys.length; i++) {
          if (keys[i].toLowerCase() === k.toLowerCase()) {
            var v = obj[keys[i]]; if (v !== null && v !== undefined && String(v).trim() !== '') return { key: keys[i], value: v };
          }
        }
      }
    }
    // 포함 기반
    for (var gi2 = 0; gi2 < keywordGroups.length; gi2++) {
      var group2 = keywordGroups[gi2];
      for (var i2 = 0; i2 < keys.length; i2++) {
        var kk = keys[i2].toLowerCase();
        for (var kj = 0; kj < group2.length; kj++) {
          var sub = group2[kj].toLowerCase();
          if (kk.indexOf(sub) !== -1) {
            var v2 = obj[keys[i2]]; if (v2 !== null && v2 !== undefined && String(v2).trim() !== '') return { key: keys[i2], value: v2 };
          }
        }
      }
    }
    // 숫자 우선
    for (var i3 = 0; i3 < keys.length; i3++) {
      var vv = obj[keys[i3]];
      if (vv !== null && vv !== undefined && !isNaN(Number(String(vv).replace(/[^0-9.-]/g, '')))) return { key: keys[i3], value: vv };
    }
    return { key: null, value: '' };
  }

  var usedKeys = [];
  // 우선순위를 실제 API 응답 키에 맞게 조정
  var c_sum_c4 = autoGetStat(stats, [['COL_C_SUM', 'COL_SUM_C4', 'COL_SUM_C04', 'COL_SUMC4', 'CLASS_SUM', 'CLASS', 'CLSS']], usedKeys); if (c_sum_c4.key) usedKeys.push(c_sum_c4.key);
  var c_sum_s4 = autoGetStat(stats, [['COL_S_SUM', 'COL_SUM_S4', 'COL_SUM_S04', 'COL_SUMS4', 'STUD_SUM', 'STU_SUM', 'STUDENT_SUM', 'TOTAL_STUD']], usedKeys); if (c_sum_s4.key) usedKeys.push(c_sum_s4.key);
  var c_sum_4 = autoGetStat(stats, [['COL_SUM', 'COL_SUM_4', 'COL_SUM04', 'AVG_STU_PER_CLASS', 'STU_PER_CLASS', 'CLASS_STU_AVG', 'COL_SUM4']], usedKeys); if (c_sum_4.key) usedKeys.push(c_sum_4.key);
  var teach_cnt = autoGetStat(stats, [['TEACH_CNT', 'TEACHCOUNT', 'TEACH_COUNT', 'TEACHER_CNT', 'TOT_TEACHER']], usedKeys); if (teach_cnt.key) usedKeys.push(teach_cnt.key);
  var teach_cal = autoGetStat(stats, [['TEACH_CAL', 'TEACHCAL', 'TEACH_CALC', 'STU_PER_TEACHER', 'STUDENT_PER_TEACHER']], usedKeys); if (teach_cal.key) usedKeys.push(teach_cal.key);

  // 값 존재 여부를 정확히 판별(0도 유효값으로 취급)
  function hasValue(v) { return v !== null && v !== undefined && String(v).trim() !== ''; }
  // 우선적으로 응답의 표준 키를 직접 사용하고, 없으면 자동 탐지값 사용
  var c_sum_c4_val = null;
  var c_sum_s4_val = null;
  var c_sum_4_val = null;
  var teach_cnt_val = null;
  var teach_cal_val = null;

  try {
    if (stats) {
      if (stats.COL_C_SUM !== undefined && stats.COL_C_SUM !== null) c_sum_c4_val = stats.COL_C_SUM;
      if (stats.COL_S_SUM !== undefined && stats.COL_S_SUM !== null) c_sum_s4_val = stats.COL_S_SUM;
      if (stats.COL_SUM !== undefined && stats.COL_SUM !== null) c_sum_4_val = stats.COL_SUM;
      if (stats.TEACH_CNT !== undefined && stats.TEACH_CNT !== null) teach_cnt_val = stats.TEACH_CNT;
        // teach_cal_val is computed if missing
        if (stats.TEACH_CAL !== undefined && stats.TEACH_CAL !== null) {
          teach_cal_val = stats.TEACH_CAL;
        }
      
        // 보조 계산: TEACH_CAL이 없고 총학생수, 총교사수가 있으면 계산
        try {
          if ((teach_cal_val === null || teach_cal_val === '') && c_sum_s4_val != null && teach_cnt_val != null && Number(teach_cnt_val) !== 0) {
            var computed = Number(String(c_sum_s4_val).replace(/,/g,'')) / Number(String(teach_cnt_val).replace(/,/g,''));
            if (!isNaN(computed)) teach_cal_val = Math.round(computed * 10) / 10;
          }
        } catch(e) { console.warn('teach_cal compute failed', e); }
    }
  } catch(e) { console.warn('stats direct key read failed', e); }

  // 자동탐지 결과 보조 대입
  if (c_sum_c4_val === null && c_sum_c4 && hasValue(c_sum_c4.value)) c_sum_c4_val = c_sum_c4.value;
  if (c_sum_s4_val === null && c_sum_s4 && hasValue(c_sum_s4.value)) c_sum_s4_val = c_sum_s4.value;
  if (c_sum_4_val === null && c_sum_4 && hasValue(c_sum_4.value)) c_sum_4_val = c_sum_4.value;
  if (teach_cnt_val === null && teach_cnt && hasValue(teach_cnt.value)) teach_cnt_val = teach_cnt.value;
  if (teach_cal_val === null && teach_cal && hasValue(teach_cal.value)) teach_cal_val = teach_cal.value;

  // 숫자일 경우 포맷(소수 1자리)
  function fmtNumber(v) {
    if (v === null || v === undefined || String(v).trim() === '') return v;
    var n = Number(String(v).replace(/,/g, ''));
    if (!isNaN(n) && Math.abs(n - Math.round(n)) > 0) return Math.round(n * 10) / 10; // 1 decimal
    return v;
  }
  c_sum_c4_val = c_sum_c4_val !== null ? fmtNumber(c_sum_c4_val) : null;
  c_sum_s4_val = c_sum_s4_val !== null ? fmtNumber(c_sum_s4_val) : null;
  c_sum_4_val = c_sum_4_val !== null ? fmtNumber(c_sum_4_val) : null;
  teach_cnt_val = teach_cnt_val !== null ? fmtNumber(teach_cnt_val) : null;
  teach_cal_val = teach_cal_val !== null ? fmtNumber(teach_cal_val) : null;

  if (c_sum_c4 && c_sum_c4.key) console.log('stat key for 총 학급수:', c_sum_c4.key);
  if (c_sum_s4 && c_sum_s4.key) console.log('stat key for 총 학생수:', c_sum_s4.key);
  if (c_sum_4 && c_sum_4.key) console.log('stat key for 학급당학생수:', c_sum_4.key);
  if (teach_cnt && teach_cnt.key) console.log('stat key for 총 교사수:', teach_cnt.key);
  if (teach_cal && teach_cal.key) console.log('stat key for 교원1인당학생수:', teach_cal.key);

  var yearLabel = '';
  if (stats && stats._displayYear) yearLabel = `<div class="year-label">(작년: ${stats._displayYear}년 기준)</div>`;

  function withKey(val) {
    return `${val}`;
  }

  // 고정 폼: 항상 모든 항목을 표시 (값이 없으면 '-' 표시)
  var statsHtml = `<div class="stats">
    ${yearLabel}
    <div class="stat-row">총 학급수: ${c_sum_c4_val !== null ? withKey(c_sum_c4_val) : '-'}</div>
    <div class="stat-row">총 학생수: ${c_sum_s4_val !== null ? withKey(c_sum_s4_val) : '-'}</div>
    <div class="stat-row">학급당 학생수: ${c_sum_4_val !== null ? withKey(c_sum_4_val) : '-'}</div>
    <div class="stat-row">총 교사수: ${teach_cnt_val !== null ? withKey(teach_cnt_val) : '-'}</div>
    <div class="stat-row">교원 1인당 학생수: ${teach_cal_val !== null ? withKey(teach_cal_val) : '-'}</div>
  </div>`;

  var content = `<div class="wrap">
    <div class="info">
      <div class="title">
        ${PosName}
        <div class="close" id="info_close_${No}" title="닫기"></div>
      </div>
      <div class="body">
        <div class="popup-grid">
          <div class="col-left">
            <div class="img"><img src="${img}" alt="logo"/></div>
          </div>
          <div class="col-mid">
            <div class="ellipsis">${DoRoMyung}</div>
            <div class="jibun ellipsis">${JiBun}</div>
            ${homepageHtml}
            <div class="coed">공학구분: ${coedText}</div>
            <div class="meta">
              <div>설립구분: ${fond || '-'}</div>
              <div>전화번호: ${tel || '-'}</div>
              <div>팩스번호: ${fax || '-'}</div>
            </div>
          </div>
          <div class="col-right">
            ${statsHtml}
          </div>
          <div class="members-row">${members}</div>
        </div>
      </div>
    </div>
  </div>`;

  return content;
}

function closeOverlay() { if (typeof customOverlay !== 'undefined') try { customOverlay.setMap(null); } catch(e){} }

function setMarkers(map) {
  for (var i = 0; i < markers.length; i++) {
    try { markers[i].setMap(map); } catch (e) { console.warn('setMarkers error', e); }
  }
}

function fetchSchool(schooltype) {
  var queryParams = '?' + encodeURIComponent('apiKey') + '=' + gApi_key + gParams;
  queryParams += '&' + encodeURIComponent('apiType') + '=' + encodeURIComponent('0');
  queryParams += '&' + encodeURIComponent('sidoCode') + '=' + encodeURIComponent('41');
  queryParams += '&' + encodeURIComponent('sggCode') + '=' + encodeURIComponent('41370');

  var targetUrl = gUrl + queryParams;
  var uri = 'http://localhost:3000/proxy?url=' + encodeURIComponent(targetUrl);

  fetch(uri).then(response => response.json()).then(data => {
    console.log('fetchSchool - API 응답:', data);
    if (data && data.resultCode === 'success' && Array.isArray(data.list) && data.list.length > 0) {
      arrAllSchoolData = data.list;
    }
    window.processData();
  }).catch(err => { console.error('❌ 학교 API 요청 실패:', err); window.processData(); });
}

function setMapType(maptype) {
  var roadmapControl = document.getElementById("btnRoadmap");
  var skyviewControl = document.getElementById("btnSkyview");
  if (maptype === "roadmap") {
    map.setMapTypeId(kakao.maps.MapTypeId.ROADMAP);
    roadmapControl.className = "selected_btn";
    skyviewControl.className = "btn";
  } else {
    map.setMapTypeId(kakao.maps.MapTypeId.HYBRID);
    skyviewControl.className = "selected_btn";
    roadmapControl.className = "btn";
  }
}

function setSchoolInfo(schooltype) {
  var elementarySchoolControl = document.getElementById("btnElemtarySchool");
  var middleSchoolControl = document.getElementById("btnMiddleSchool");
  var highSchoolControl = document.getElementById("btnHighSchool");
  gParams = '&' + encodeURIComponent('schulKndCode');
  if (schooltype === "Elementary") {
    elementarySchoolControl.className = "selected_btn";
    middleSchoolControl.className = "btn";
    highSchoolControl.className = "btn";
    gParams += '=' + encodeURIComponent('02');
  } else if (schooltype === "Middle") {
    elementarySchoolControl.className = "btn";
    middleSchoolControl.className = "selected_btn";
    highSchoolControl.className = "btn";
    gParams += '=' + encodeURIComponent('03');
  } else {
    elementarySchoolControl.className = "btn";
    highSchoolControl.className = "selected_btn";
    middleSchoolControl.className = "btn";
    gParams += '=' + encodeURIComponent('04');
  }
  fetchSchool(schooltype);
}

function zoomIn() { map.setLevel(map.getLevel() - 1); }
function zoomOut() { map.setLevel(map.getLevel() + 1); }

function AddMarkerNCustomOverlay(map, nIndex, latitude, longitude) {
  var position = new kakao.maps.LatLng(latitude, longitude);
  var marker = new kakao.maps.Marker({ map: map, position: position });
  markers.push(marker);
  var customOverlay = new kakao.maps.CustomOverlay({ content: contents, map: map, position: position });
  kakao.maps.event.addListener(marker, "click", function () { customOverlay.setMap(map); });
  customOverlay.setMap(null);
  AddClickEventListener(nIndex, customOverlay);
}

function AddClickEventListener(nIndex, customOverlay) {
  var strGetElementById = "info_close_" + nIndex;
  try { document.getElementById(strGetElementById).addEventListener("click", function () { customOverlay.setMap(null); }); } catch(e) {}
}
