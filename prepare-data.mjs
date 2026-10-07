import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const output=path.resolve(root,'../outputs');
const payload=JSON.parse(fs.readFileSync(path.join(output,'calendar_payload.json'),'utf8'));
const thresholds=JSON.parse(fs.readFileSync(path.join(output,'calendar_level_thresholds.json'),'utf8'));
function csv(name){const lines=fs.readFileSync(path.join(output,name),'utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/);const headers=lines.shift().split(',');return lines.map(line=>Object.fromEntries(line.split(',').map((value,i)=>[headers[i],value])));}
const evaluation=csv('calendar_predictions_2013.csv');
const metric=csv('model_comparison.csv').find(row=>row.model===payload.selected_model && row.split==='test_2013');
if(!metric || payload.calendar.length!==2190)throw new Error('Missing expected model or calendar rows');
const gradeRates=Object.fromEntries(thresholds.labels.map(label=>{const rows=evaluation.filter(row=>row.level===label);return [label,rows.reduce((sum,row)=>sum+Number(row.has_report),0)/rows.length];}));
const baseline=evaluation.reduce((sum,row)=>sum+Number(row.has_report),0)/evaluation.length;
for(const row of payload.calendar){if('has_report' in row || 'report_count' in row)throw new Error('Ground-truth columns in page data');if(!Number.isFinite(row.probability)||row.probability<0||row.probability>1)throw new Error('Invalid probability');if(!thresholds.labels.includes(row.level))throw new Error('Invalid grade');}
if(new Set(payload.calendar.map(row=>row.region_id+'/'+row.date)).size!==2190)throw new Error('Duplicate dates');
payload.stats={baseline,gradeRates,rocAuc:Number(metric.roc_auc),prAuc:Number(metric.pr_auc)};
payload.thresholds=thresholds;
fs.writeFileSync(path.join(root,'dist/data.js'),'window.UFO_DATA = '+JSON.stringify(payload)+';\n','utf8');
console.log(JSON.stringify({rows:payload.calendar.length,regions:payload.regions.length,stats:payload.stats}));
