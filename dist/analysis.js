/* Graphs are derived from existing CSV metrics; no fabricated performance values. */
(() => {
  'use strict';
  const data=window.UFO_DATA?.analysis;
  if(!data)return;
  const $=id=>document.getElementById(id);
  const colors=['#c0a9ef','#6c3ce9','#19a899','#e85b93'];
  const models=[...new Set(data.rolling.map(row=>row.model))];
  const pct=x=>(x*100).toFixed(1)+'%';
  const escape=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const text=(x,y,value,anchor='middle',size=15)=>`<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" fill="currentColor">${escape(value)}</text>`;
  const svg=(title,body,height=290)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 ${height}" role="img" aria-label="${escape(title)}" style="font-family:Malgun Gothic,system-ui,sans-serif"><title>${escape(title)}</title>${body}</svg>`;
  function axis(max,format){
    let out='';
    for(let i=0;i<=5;i++){
      const y=235-i*40;
      out+=`<line x1="64" y1="${y}" x2="580" y2="${y}" stroke="#bfb6d4" stroke-opacity=".55"/>`+text(54,y+5,format(max*i/5),'end',13);
    }
    return out;
  }
  function bars(labels,series,max,format,title,values=false){
    let out=text(64,18,title,'start',13)+axis(max,format),w=516/labels.length;
    for(let i=0;i<labels.length;i++){
      const cx=64+w*(i+.5);
      for(let j=0;j<series.length;j++){
        const value=series[j].values[i],height=value/max*200;
        const bw=Math.min(w*.65/series.length,42),x=cx+(j-series.length/2)*bw;
        out+=`<rect x="${x}" y="${235-height}" width="${Math.max(2,bw-3)}" height="${height}" rx="3" fill="${series[j].color}"><title>${escape((labels[i]??i+'시')+': '+series[j].name+' '+format(value))}</title></rect>`;
        if(values)out+=text(x+(bw-3)/2,228-height,format(value),'middle',12);
      }
      if(labels[i]!==null)out+=text(cx,259,labels[i],'middle',14);
    }
    return svg(title,out);
  }
  const average=(model,key)=>{const rows=data.rolling.filter(r=>r.model===model);return rows.reduce((s,r)=>s+r[key],0)/rows.length;};
  $('rolling-kpi').textContent=average('M2_seasonality_history','pr_auc').toFixed(3);
  function comparison(){
    const metric=$('metric-select').value,pr=metric==='pr_auc';
    const valid=models.map(m=>average(m,metric));
    const test=models.map(m=>data.metrics.find(r=>r.model===m && r.split==='test_2013')[metric]);
    $('comparison-chart').innerHTML=bars(['M1','M2','M3','M4'],[{name:'시간순 검증 평균',values:valid,color:'#6c3ce9'},{name:'2013년 시험',values:test,color:'#19a899'}],pr?.25:1,x=>x.toFixed(3),`${pr?'PR-AUC(AP)':'ROC-AUC'} 모델 비교`,true);
    const key=pr?'PR-AUC(AP)':'ROC-AUC';
    $('comparison-insight').textContent=`${key} 기준 M2의 검증 평균은 ${valid[1].toFixed(3)}이고, 2013년 시험 점수는 ${test[1].toFixed(3)}입니다. 시험에서는 M3가 ${test[2].toFixed(3)}으로 M2보다 높았습니다. 변수를 더 많이 넣는다고 검증 평균이 항상 좋아지지는 않았습니다.`;
  }
  $('metric-select').addEventListener('change',comparison);
  comparison();
  let lines=text(64,18,'PR-AUC(AP) · 시기별 신고율은 점선','start',13)+axis(.25,x=>x.toFixed(2));
  const periods=[...new Set(data.rolling.map(r=>r.validation_period))];
  periods.forEach((p,i)=>{lines+=text(110+i*210,260,p==='2012-2012'?'2012':p);});
  lines+=`<polyline points="${periods.map((p,i)=>[110+i*210,235-data.rolling.find(r=>r.validation_period===p).positive_rate/.25*200].join(',')).join(' ')}" fill="none" stroke="#887da0" stroke-width="2" stroke-dasharray="5 5"/>`;
  models.forEach((m,i)=>{
    const points=periods.map((p,j)=>[110+j*210,235-data.rolling.find(r=>r.model===m && r.validation_period===p).pr_auc/.25*200]);
    lines+=`<polyline points="${points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${colors[i]}" stroke-width="${i===1?4:2.5}"/>`;
    points.forEach(([x,y],j)=>{const value=data.rolling.find(r=>r.model===m && r.validation_period===periods[j]).pr_auc;lines+=`<circle cx="${x}" cy="${y}" r="5" fill="${colors[i]}"><title>${m.slice(0,2)} ${periods[j]}: ${value.toFixed(4)}</title></circle>`;});
  });
  $('rolling-chart').innerHTML=svg('시기별 모델 PR-AUC(AP), 세 검증 구간',lines);
  $('rolling-legend').innerHTML=models.map((m,i)=>`<span><i style="background:${colors[i]}"></i>${m.slice(0,2)}</span>`).join('')+'<span>점선: 구간별 신고일 비율</span>';
  const cal=data.calibration;
  $('calibration-chart').innerHTML=bars(cal.map((_,i)=>`구간 ${i+1}`),[{name:'평균 예측',values:cal.map(r=>r.mean_predicted_probability),color:'#6c3ce9'},{name:'실제 보고율',values:cal.map(r=>r.actual_report_rate),color:'#19a899'}],.25,pct,'2011~2012 검증 확률 진단',true);
  const last=cal.at(-1);
  $('calibration-insight').textContent=`가장 높은 구간은 평균 예측 ${pct(last.mean_predicted_probability)}, 실제 보고율 ${pct(last.actual_report_rate)}로 ${(last.absolute_gap*100).toFixed(1)}%p의 과소 예측이 있었습니다. 각 구간의 표본은 ${Math.min(...cal.map(r=>r.rows))}~${Math.max(...cal.map(r=>r.rows))}개 지역-날짜입니다.`;
  let lastRegion;
  function update(region){
    if(region===lastRegion)return;
    lastRegion=region;
    const pattern=data.patterns[region],city={R01:'Seattle',R02:'Los Angeles',R03:'Brooklyn (NYC)',R04:'Chicago',R05:'Irvine',R06:'San Francisco'}[region];
    document.querySelectorAll('.analysis-region').forEach(el=>el.textContent=city+' · 2000–2010');
    const rates=pattern.monthly,peak=rates.indexOf(Math.max(...rates)),min=rates.indexOf(Math.min(...rates));
    $('monthly-chart').innerHTML=bars(rates.map((_,i)=>(i+1)+'월'),[{name:'보고일 비율',values:rates,color:'#6c3ce9'}],Math.max(.05,Math.ceil(Math.max(...rates)/.05)*.05),pct,city+' 월별 실제 보고일 비율');
    $('monthly-insight').textContent=`${city}에서는 ${peak+1}월의 보고일 비율이 ${pct(rates[peak])}로 가장 높고, ${min+1}월이 ${pct(rates[min])}로 가장 낮았습니다. 보고가 없던 날도 분모에 포함해 단순 월별 신고 건수와 구분했습니다.`;
    const hours=pattern.hours,top=hours.indexOf(Math.max(...hours));
    $('hour-chart').innerHTML=bars(hours.map((_,i)=>i%4===0?i+'시':null),[{name:'보고 건수',values:hours,color:'#19a899'}],Math.ceil(Math.max(...hours)/50)*50,x=>String(Math.round(x)),city+' 기록 시각별 보고 건수');
    $('hour-insight').textContent=`총 ${pattern.total_reports.toLocaleString()}건 중 ${String(top).padStart(2,'0')}시대가 ${hours[top].toLocaleString()}건(${pct(hours[top]/pattern.total_reports)})으로 가장 많았습니다. 단위는 보고 건수이며, 날짜별 출현 확률이 아닙니다.`;
    let shapeBody=text(125,18,'알려진 모양 전체 표본 중 비중','start',13);
    const names={light:'빛',circle:'원형',triangle:'삼각형',fireball:'불덩어리',sphere:'구형',disk:'원반',oval:'타원',other:'기타',formation:'편대'};
    pattern.shapes.forEach((s,i)=>{
      const y=43+i*45,share=s.count/pattern.known_shapes;
      shapeBody+=text(110,y+7,(names[s.shape]||s.shape),'end',15)+`<rect x="125" y="${y-11}" width="${share*1000}" height="28" rx="4" fill="#6c3ce9"><title>${escape(s.shape)}: ${s.count}건</title></rect>`+text(135+share*1000,y+8,pct(share),'start',14);
    });
    $('shape-chart').innerHTML=svg(city+' 알려진 모양 중 상위 5개 비중',shapeBody);
    const shape=pattern.shapes[0];
    $('shape-insight').textContent=`알려진 모양 ${pattern.known_shapes.toLocaleString()}건 중 가장 흔한 ${names[shape.shape]||shape.shape}(${shape.shape})은 ${shape.count.toLocaleString()}건, ${pct(shape.count/pattern.known_shapes)}입니다. 모양 미상 보고는 제외했습니다. 지역-월 표본이 30건 미만이면 상세 카드에 ‘표본 적음’을 표시합니다.`;
  }
  document.querySelectorAll('.chart-download').forEach(button=>button.addEventListener('click',()=>{
    const original=$(button.dataset.chart).querySelector('svg');
    const clone=original.cloneNode(true);
    clone.setAttribute('width','1200');clone.setAttribute('height','580');
    const ink=getComputedStyle(original).color;
    clone.querySelectorAll('[fill="currentColor"]').forEach(el=>el.setAttribute('fill',ink));
    const background=document.createElementNS('http://www.w3.org/2000/svg','rect');
    background.setAttribute('width','600');background.setAttribute('height','290');background.setAttribute('fill',getComputedStyle(button.closest('.card')).backgroundColor);
    clone.insertBefore(background,clone.firstChild);
    const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=button.dataset.chart+'-'+(lastRegion||'all')+'.svg';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }));
  window.UFO_ANALYSIS={update};
})();
