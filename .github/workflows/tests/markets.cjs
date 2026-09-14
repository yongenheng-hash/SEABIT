const assert=require('node:assert/strict'),M=require('../markets-core.js');
const s={id:'test',country:'US',category:'yield',frequency:'daily',unit:'%',status:'ok',observations:[{date:'2025-01-03',value:4},{date:'2025-01-10',value:4.25}]};
assert.equal(M.comparison(s,7).delta,25);
assert.equal(M.comparison(s,1).prior.date,'2025-01-03');
assert.equal(M.comparison({...s,observations:[s.observations[1]]},7).delta,null);
assert.equal(M.comparison({...s,category:'inflation',frequency:'monthly'},7).delta,.25);
assert.ok(Math.abs(M.comparison({...s,category:'fx'},7).delta-6.25)<1e-9);
assert.equal(M.comparison({...s,observations:[]}).last,null);
assert.equal(M.health({...s,status:'error'}),'Refresh failed · retained data');
const data={checked_at:'2025-01-11T00:00:00Z',series:[s]},snap=M.snapshot(data,'US',7);
// Serialize the snapshot as the cloud save does; later collection changes must not change it.
const saved=JSON.parse(JSON.stringify(snap));s.observations[1].value=8;assert.equal(saved.series[0].last.value,4.25);
assert.equal(M.shift('2025-01-01',7),'2024-12-25');
console.log('PASS: basis points, FX percentages, release comparisons, missing history, stale-source status, snapshot persistence.');
