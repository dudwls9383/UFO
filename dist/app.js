/* 지역·날짜별 통계 결과를 표시하는 정적 시연 화면. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const levels = ['very_low','low','medium','high','very_high'];
  const levelNames = ['매우 낮음','낮음','보통','높음','매우 높음'];
  const cityNames = {R01:'Seattle',R02:'Los Angeles',R03:'Brooklyn (NYC)',R04:'Chicago',R05:'Irvine',R06:'San Francisco'};
  const weekdays = ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];
  const shapeNames = {light:'Light · 빛',triangle:'Triangle · 삼각형',circle:'Circle · 원형',fireball:'Fireball · 불덩어리',other:'Other · 기타'};
  const percent = value => `${(value*100).toFixed(1)}%`;
  const state = {region:'R01',year:2026,month:7,day:1};
  const data = window.UFO_DATA;
  if (!data || !Array.isArray(data.calendar) || data.calendar.length !== 10956) {
    $('error-message').hidden = false;
    $('error-message').textContent = '달력 데이터를 읽지 못했습니다. index.html, app.js, styles.css, data.js를 같은 폴더에 두고 다시 열어주세요.';
    return;
  }
  const rows = new Map(data.calendar.map(row => [`${row.region_id}/${row.date}`,row]));
  const dateKey = (month, day, year=state.year) => `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  const dots = level => `<span class="grade-dots" aria-hidden="true">${levels.map((_,i)=>`<i class="${i<=levels.indexOf(level)?'filled':''}"></i>`).join('')}</span>`;
  const current = () => rows.get(`${state.region}/${dateKey(state.month,state.day)}`);
  function setDate(region,month,day,year=state.year) {
    if (!data.regions.some(r=>r.region_id===region) || !Number.isInteger(year) || year<2026 || year>2030 || !Number.isInteger(month) || month<1 || month>12 || !Number.isInteger(day) || !rows.has(`${region}/${dateKey(month,day,year)}`)) throw new Error('2026~2030년 달력에 있는 지역·연도·월·날짜를 선택하세요.');
    Object.assign(state,{region,year,month,day});
    render();
    return current();
  }
  function renderRegions() {
    $('region-tabs').innerHTML = data.regions.map(region=>`<button class="region-tab" role="tab" aria-selected="${state.region===region.region_id}" data-region="${region.region_id}">${cityNames[region.region_id] || region.representative_city}</button>`).join('');
    $('region-tabs').querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>setDate(button.dataset.region,state.month,state.day)));
    const r = data.regions.find(r=>r.region_id===state.region);
    $('region-meta').textContent = `0.5° 격자 · ${r.lat_min.toFixed(1)}–${r.lat_max.toFixed(1)}°N, ${Math.abs(r.lon_min).toFixed(1)}–${Math.abs(r.lon_max).toFixed(1)}°W · 도시명이 대표하는 인근 격자입니다`;
  }
  function renderCalendar() {
    $('calendar-region').textContent = cityNames[state.region].toUpperCase();
    $('month-title').textContent = `${state.year}년 ${state.month}월`;
    $('year-select').value = state.year;
    $('month-select').value = state.month;
    $('prev-month').disabled = state.year===2026 && state.month===1;
    $('next-month').disabled = state.year===2030 && state.month===12;
    for (const id of ['prev-month','next-month']) $(id).title = $(id).disabled ? '달력 범위는 2026~2030년입니다' : $(id).getAttribute('aria-label');
    const first = (new Date(state.year,state.month-1,1).getDay()+6)%7;
    const count = new Date(state.year,state.month,0).getDate();
    let html = '<span class="day-empty" aria-hidden="true"></span>'.repeat(first);
    for (let day=1;day<=count;day++) {
      const row=rows.get(`${state.region}/${dateKey(state.month,day)}`);
      const selected = day===state.day;
      html += `<button class="day lv-${row.level} ${selected?'selected':''}" data-day="${day}" aria-pressed="${selected}" tabindex="${selected?0:-1}" aria-label="${state.month}월 ${day}일, ${levelNames[levels.indexOf(row.level)]} ${levels.indexOf(row.level)+1}단계, 참고 확률 ${percent(row.probability)}"><span class="day-number">${day}</span><span class="day-grade">${levelNames[levels.indexOf(row.level)]}${dots(row.level)}</span></button>`;
    }
    html += '<span class="day-empty" aria-hidden="true"></span>'.repeat((7-(first+count)%7)%7);
    $('calendar-grid').innerHTML=html;
    $('calendar-grid').querySelectorAll('button').forEach(button=>{
      button.addEventListener('click',()=>setDate(state.region,state.month,Number(button.dataset.day)));
      button.addEventListener('keydown',event=>{
        const offset={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[event.key];
        if (offset===undefined) return;
        event.preventDefault();
        const date=new Date(state.year,state.month-1,Number(button.dataset.day)+offset);
        if (date.getFullYear()<2026 || date.getFullYear()>2030) return;
        setDate(state.region,date.getMonth()+1,date.getDate(),date.getFullYear());
        $('calendar-grid').querySelector('.selected').focus();
      });
    });
    const top=data.calendar.filter(row=>row.region_id===state.region && row.year===state.year && row.month===state.month).sort((a,b)=>b.probability-a.probability || a.date.localeCompare(b.date)).slice(0,3);
    $('top-dates').innerHTML=top.map((row,i)=>`<button class="top-date" data-day="${Number(row.date.slice(-2))}" aria-label="추천 ${i+1}위 ${Number(row.date.slice(-2))}일 선택"><span><strong>${state.month}월 ${Number(row.date.slice(-2))}일</strong><small>${levelNames[levels.indexOf(row.level)]}</small></span><span class="rank">0${i+1}</span></button>`).join('');
    $('top-dates').querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>setDate(state.region,state.month,Number(button.dataset.day))));
  }
  function renderDetail() {
    const row=current(), levelIndex=levels.indexOf(row.level);
    $('detail-city').textContent=cityNames[state.region];
    $('detail-date').textContent=`${state.month}월 ${state.day}일 ${weekdays[new Date(state.year,state.month-1,state.day).getDay()]}`;
    $('detail-year').textContent=`${state.year}년 · 과거 패턴 기반`;
    $('detail-grade').className=`detail-grade lv-${row.level}`;
    $('detail-grade').innerHTML=`${levelNames[levelIndex]}${dots(row.level)}`;
    $('detail-description').textContent = levelIndex>=3 ? '다른 날보다 보고가 상대적으로 많을 것으로 계산된 날짜예요.' : levelIndex===2 ? '다른 날과 비교해 중간 수준의 신고 가능성이 계산됐어요.' : '다른 날보다 보고가 상대적으로 적을 것으로 계산된 날짜예요.';
    $('detail-probability').textContent=percent(row.probability);
    $('probability-fill').style.width=`${Math.min(row.probability/.3,1)*100}%`;
    $('probability-baseline').style.left=`${data.forecast.historical_baseline/.3*100}%`;
    $('baseline-label').textContent=`과거 보고율 ${percent(data.forecast.historical_baseline)}`;
    $('detail-shape').textContent=shapeNames[row.top_shape] || row.top_shape;
    $('shape-share').textContent=`알려진 모양 중 ${Number(row.top_shape_share_pct).toFixed(1)}%`;
    $('shape-share').style.opacity=row.reports_with_known_shape<30?'.7':'1';
    $('shape-icon').innerHTML=`<use href="#shape-${shapeNames[row.top_shape]?row.top_shape:'other'}"/>`;
    $('detail-hour').textContent=`${String(row.top_hour).padStart(2,'0')}:00–${String(row.top_hour).padStart(2,'0')}:59`;
    $('sample-count').textContent=`알려진 모양 표본 ${row.reports_with_known_shape}건`;
    $('low-sample').hidden=row.reports_with_known_shape>=30;
    $('low-sample').textContent=`표본 적음 (n=${row.reports_with_known_shape})`;
  }
  function render(){renderRegions();renderCalendar();renderDetail();window.UFO_ANALYSIS?.update(state.region);}
  $('year-select').innerHTML=Array.from({length:5},(_,i)=>`<option value="${2026+i}">${2026+i}년</option>`).join('');
  $('year-select').addEventListener('change',event=>{const year=Number(event.target.value);setDate(state.region,state.month,Math.min(state.day,new Date(year,state.month,0).getDate()),year);});
  $('month-select').innerHTML=Array.from({length:12},(_,i)=>`<option value="${i+1}">${i+1}월</option>`).join('');
  $('month-select').addEventListener('change',event=>setDate(state.region,Number(event.target.value),Math.min(state.day,new Date(state.year,Number(event.target.value),0).getDate())));
  function moveMonth(offset){const date=new Date(state.year,state.month-1+offset,1);setDate(state.region,date.getMonth()+1,1,date.getFullYear());}
  $('prev-month').addEventListener('click',()=>moveMonth(-1));
  $('next-month').addEventListener('click',()=>moveMonth(1));
  $('theme-toggle').addEventListener('click',()=>{
    const dark=document.documentElement.dataset.theme!=='dark';
    document.documentElement.dataset.theme=dark?'dark':'light';
    $('theme-toggle').setAttribute('aria-label',dark?'라이트 모드 켜기':'다크 모드 켜기');
    $('theme-toggle').setAttribute('aria-pressed',String(dark));
  });
  $('legend').innerHTML=levels.map((level,i)=>`<span class="legend-item"><i class="swatch lv-${level}"></i>${levelNames[i]}<span class="legend-dots">${dots(level)}</span></span>`).join('');
  $('evidence-chart').innerHTML=levels.map((level,i)=>{
    const rate=data.stats.gradeRates[level];
    return `<div class="chart-column"><div class="chart-bar lv-${level}" style="height:${rate/.25*100}%"><span class="chart-number">${percent(rate)}</span></div><span class="chart-label">${levelNames[i]}</span></div>`;
  }).join('')+`<div class="chart-baseline" style="bottom:calc(24px + ${data.stats.baseline/.25*98}px)"><span>기준 ${percent(data.stats.baseline)}</span></div>`;
  $('evidence-chart').setAttribute('aria-label',levels.map((level,i)=>`${levelNames[i]} ${percent(data.stats.gradeRates[level])}`).join(', '));
  $('model-performance').textContent=`2013년 ROC-AUC ${data.stats.rocAuc.toFixed(3)}, PR-AUC ${data.stats.prAuc.toFixed(3)}. 전체 기준 보고율은 ${percent(data.stats.baseline)}입니다.`;
  render();
  const context=document.modelContext || navigator.modelContext;
  if (context?.registerTool) {
    const lifecycle=new AbortController();
    try {
      Promise.resolve(context.registerTool({name:'select_calendar_date',title:'지역과 날짜 선택',description:'2026~2030년 UFO 장기 추정 달력의 지역과 날짜를 선택합니다. 미래 관측 성능은 검증되지 않았습니다.',inputSchema:{type:'object',properties:{region:{type:'string',enum:data.regions.map(r=>r.region_id)},year:{type:'integer',minimum:2026,maximum:2030},month:{type:'integer',minimum:1,maximum:12},day:{type:'integer',minimum:1,maximum:31}},required:['region','year','month','day'],additionalProperties:false},annotations:{readOnlyHint:false},execute(input){const row=setDate(input.region,input.month,input.day,input.year);return {region:state.region,date:row.date,probability:row.probability,level:row.level,shape:row.top_shape,hour:row.top_hour,interpretation:data.forecast.interpretation};}},{signal:lifecycle.signal})).catch(()=>{});
      window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
    } catch (_) { /* Browsers without WebMCP retain the visible calendar. */ }
  }
})();
