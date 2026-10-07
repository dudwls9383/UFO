import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('dist/data.js',import.meta.url),'utf8'),sandbox);
const d=sandbox.window.UFO_DATA;
assert.equal(d.calendar.length,10956);
assert.equal(d.regions.length,6);
assert.equal(new Set(d.calendar.map(r=>r.region_id+'/'+r.date)).size,10956);
for(const region of d.regions){
  const records=d.calendar.filter(r=>r.region_id===region.region_id).sort((a,b)=>a.date.localeCompare(b.date));
  assert.equal(records.length,1826);
  assert.equal(records[0].date,'2026-01-01');
  assert.equal(records.at(-1).date,'2030-12-31');
  for(let i=0;i<records.length;i++){
    const r=records[i];
    assert.equal(r.date,new Date(Date.UTC(2026,0,1+i)).toISOString().slice(0,10));
    assert(r.probability>=0 && r.probability<=1);
    assert(!('has_report' in r) && !('report_count' in r));
    const grade=d.thresholds.labels[d.thresholds.thresholds.filter(t=>r.probability>t).length];
    assert.equal(r.level,grade);
    assert.equal(r.year,Number(r.date.slice(0,4)));
    assert.equal(r.month,Number(r.date.slice(5,7)));
    assert(Number.isFinite(r.top_hour) && r.top_hour>=0 && r.top_hour<=23);
  }
}
assert.equal(d.analysis.metrics.length,10);
assert.equal(d.analysis.rolling.length,15);
assert(d.analysis.metrics.some(r=>r.model==='M5_random_forest'));
assert.equal(d.analysis.calibration.length,5);
for(const region of d.regions){
  const p=d.analysis.patterns[region.region_id];
  assert.equal(p.hours.reduce((s,n)=>s+n,0),p.total_reports);
  assert.equal(p.monthly.length,12);
  assert(p.shapes.every(s=>s.count<=p.known_shapes));
}
const html=fs.readFileSync(new URL('dist/index.html',import.meta.url),'utf8');
assert(!html.includes('2013년 백테스트 시연'));
for(const name of ['app','analysis','experience-main','weather-sky'])new vm.Script(fs.readFileSync(new URL(`dist/${name}.js`,import.meta.url),'utf8'));
const e=d.experience;
assert.equal(e.shape.candidates.length,11);
assert.equal(e.shape.class_scores.slice(0,5).reduce((sum,r)=>sum+r.support,0),8708);
assert(e.shape.best_validation.accuracy<.7);
assert.equal(e.time.hours.reduce((sum,n)=>sum+n,0),80332);
assert.equal(e.map.cells.reduce((sum,c)=>sum+c[2],0),e.map.rows);
assert.equal(e.duration.scatter.length,650);
assert(e.duration.scatter.every(p=>p.every(Number.isFinite)&&p[0]<=86400));
assert(fs.existsSync(new URL('dist/assets/shape-specimens.png',import.meta.url)));
assert(fs.existsSync(new URL('dist/assets/weather-sprites-v4.png',import.meta.url)));
const weatherSandbox={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('dist/weather-sky.js',import.meta.url),'utf8'),weatherSandbox);
const sky=weatherSandbox.window.UFO_WEATHER_SKY;
for(const level of d.thresholds.labels)assert.equal(sky.favorable({level}),['high','very_high'].includes(level));
assert.equal(sky.favorable(null),false);
assert.equal(sky.condition(null).phase,'unknown');
assert.equal(sky.condition({is_day:1,weather_code:0,cloud_cover:0}).phase,'day');
assert.equal(sky.condition({is_day:0,weather_code:3,cloud_cover:95}).tone,'cloudy');
assert.equal(sky.condition({is_day:1,weather_code:61,cloud_cover:95}).label,'비');
assert(fs.readFileSync(new URL('dist/weather-sky.css',import.meta.url),'utf8').includes('prefers-reduced-motion:reduce'));
console.log('PASS: all 10,956 dates, leap day, bounds, grades, no future labels, charts, syntax.');
