/* Decorative raster sprites follow weather; the UFO follows calendar rank, never weather. */
(() => {
  'use strict';
  let card;
  function condition(current){
    if(!current || ![0,1].includes(current.is_day))return {phase:'unknown',tone:'unknown',label:'기상 정보 확인 중'};
    const code=current.weather_code;
    let label='기상 정보',tone=current.cloud_cover>=70?'cloudy':'clear';
    if(code===0)label='맑음';
    else if(code===1)label='대체로 맑음';
    else if(code===2)label='구름 조금';
    else if(code===3){label='흐림';tone='cloudy';}
    else if([45,48].includes(code)){label='안개';tone='cloudy';}
    else if([51,53,55,56,57].includes(code)){label='이슬비';tone='wet';}
    else if([61,63,65,66,67].includes(code)){label='비';tone='wet';}
    else if([71,73,75,77].includes(code)){label='눈';tone='wet';}
    else if([80,81,82].includes(code)){label='소나기';tone='wet';}
    else if([85,86].includes(code)){label='눈 소나기';tone='wet';}
    else if([95,96,97,99].includes(code)){label='뇌우';tone='wet';}
    return {phase:current.is_day===1?'day':'night',tone,label};
  }
  const favorable=row=>!!row&&['high','very_high'].includes(row.level);
  function attach(element){
    card=element;card.classList.add('weather-illustrated');card.dataset.sky='unknown';card.dataset.tone='unknown';
    const scene=document.createElement('div');scene.className='weather-scene';scene.setAttribute('aria-hidden','true');
    scene.innerHTML='<span class="sky-sprite sky-sun"></span><span class="sky-sprite sky-moon"></span><span class="sky-sprite sky-cloud sky-cloud-back"></span><span class="sky-sprite sky-cloud sky-cloud-front"></span><span class="sky-sprite sky-ufo" hidden></span>';
    card.prepend(scene);
    const badge=document.createElement('p');badge.id='weather-condition';badge.className='weather-condition';badge.textContent='기상 정보 확인 중';card.querySelector('h2').after(badge);
    const calendar=document.createElement('p');calendar.id='weather-calendar-hint';calendar.className='weather-calendar-hint';calendar.hidden=true;card.querySelector('.weather-note').before(calendar);
  }
  function setWeather(current,mode='ready'){
    if(!card)return;const c=condition(current);card.dataset.sky=c.phase;card.dataset.tone=c.tone;
    document.getElementById('weather-condition').textContent=mode==='error'?'기상 정보 연결 안 됨':c.label+(c.phase==='unknown'?'':` · 현지 ${c.phase==='day'?'낮':'밤'}`);
    card.style.setProperty('--cloud-opacity',current&&Number.isFinite(current.cloud_cover)?String(.15+.7*current.cloud_cover/100):'.25');
  }
  function setCalendar(row,city){
    if(!card)return;const show=favorable(row),ufo=card.querySelector('.sky-ufo'),hint=document.getElementById('weather-calendar-hint');ufo.hidden=!show;hint.hidden=!show;
    if(show){const [year,month,day]=row.date.split('-');hint.textContent=`작은 UFO가 찾아왔어요 · 달력 ${city} ${year}.${month}.${day} · ${row.level==='very_high'?'매우 높음':'높음'} 등급의 재미용 표시`;}else hint.textContent='';
  }
  window.UFO_WEATHER_SKY={attach,setWeather,setCalendar,condition,favorable};
})();
