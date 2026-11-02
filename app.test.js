import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {VERSION,STARTER,empty,today,addDays,daysUntil,isDate,tel,validate,pending,readiness,addStarter,encrypt,decrypt} from './core.js';
import {ahora,plan,aldia,guia,ajustes,entryForm} from './views.js';
import {GUIDE} from './guide.js';
import {sheetHTML} from './report.js';

const evil='<img src=x onerror=alert(1)>';
const state=data=>({data,offlineReady:true,storageOK:true,version:VERSION});
const sample=()=>validate({...empty(),
  contacts:[{name:'Tía',role:'Familia',phone:'+34 600 000 000'},{name:'Vecina',phone:'600 000 001'}],
  meeting:[{label:'Cerca',place:'Plaza'},{label:'Lejos',place:'Parque'}],
  pickups:[{child:'Peque',first:'Mamá',second:'Tía'}],
  items:[{name:'Agua',have:true,expires:addDays(today(),10)},{name:'Radio'}],
  dues:[{name:'DNI',kind:'DNI',person:'Mamá',expires:addDays(today(),-1)},{name:'ITV',kind:'ITV',expires:addDays(today(),400)}],
  shutoffs:{power:'Entrada',water:'Cocina',gas:'Terraza'}});

test('Every view renders with empty and filled data',()=>{for(const data of [empty(),sample()])for(const view of [ahora,plan,aldia,guia,ajustes]){const html=view(state(data));assert.ok(html.length>200);assert.ok(!/undefined|NaN|null|false/.test(html.replace(/<[^>]+>/g,'')));}});
test('User text is escaped in views, forms and the sheet',()=>{const data=validate({...empty(),contacts:[{name:evil,phone:'600000000',role:evil}],meeting:[{label:evil,place:evil}],pickups:[{child:evil,first:evil,second:evil}],items:[{name:evil,place:evil}],dues:[{name:evil,expires:today()}]});for(const html of [ahora,plan,aldia].map(v=>v(state(data))).concat(sheetHTML(data),entryForm('contacts',data.contacts[0],data.contacts[0].id)))assert.ok(!html.includes('<img'));});
test('Local editing changes the settings text and hides the repair link',()=>{const html=ajustes({...state(empty()),local:true});assert.match(html,/plan\.json/);assert.ok(!html.includes('actualizar.html'));assert.ok(ajustes(state(empty())).includes('actualizar.html'));});
test('Dates are strict',()=>{assert.ok(isDate('2028-02-29'));assert.ok(!isDate('2027-02-29'));assert.ok(!isDate('02/03/2027'));assert.equal(daysUntil('2026-03-30','2026-03-28'),2);assert.throws(()=>validate({...empty(),dues:[{name:'x',expires:'mañana'}]}),/Fecha/);});
test('Required fields and phones are enforced',()=>{assert.throws(()=>validate({...empty(),contacts:[{name:'x'}]}),/Teléfono/);assert.throws(()=>validate({...empty(),contacts:[{name:'x',phone:'ab'}]}),/no válido/);assert.equal(tel('+34 600-000 000'),'+34600000000');assert.throws(()=>validate({version:2}),/incompatibles/);});
test('Validate keeps ids and restores defaults for missing fields',()=>{const a=sample();assert.deepEqual(validate(a),a);assert.deepEqual(validate({version:1}),empty());});
test('Pending lists overdue and upcoming dates, soonest first, and skips missing kit',()=>{const now=today(),data=validate({...sample(),items:[{name:'Agua',have:true,expires:addDays(now,10)},{name:'Latas',have:false,expires:addDays(now,1)},{name:'Pilas',have:true,expires:addDays(now,31)}]});assert.deepEqual(pending(data).map(x=>x.name),['DNI','Agua']);});
test('Warning windows stop exactly at their limit',()=>{const now=today(),names=d=>pending(d).map(x=>x.name),base={...empty(),dues:[{name:'A',expires:addDays(now,90)},{name:'B',expires:addDays(now,91)}]};assert.deepEqual(names(validate(base)),['A']);});
test('Readiness needs each part of the plan, and an old backup does not count',()=>{const data=sample();assert.equal(readiness(empty()).filter(c=>c.ok).length,0);const left=readiness(data).filter(c=>!c.ok).map(c=>c.label);assert.equal(left.length,2);assert.ok(!readiness({...data,lastBackup:addDays(today(),-181)}).at(-1).ok);assert.ok(readiness({...data,lastBackup:addDays(today(),-180)}).at(-1).ok);});
test('The official list never marks anything as owned and is not duplicated',()=>{const once=addStarter(validate({...empty(),items:[{name:'agua',have:true}]}));assert.equal(once.items.length,STARTER.length);assert.equal(once.items.filter(x=>x.have).length,1);assert.equal(addStarter(once).items.length,once.items.length);});
test('Encrypted copies round trip and reject a wrong password',async()=>{const data=sample(),copy=await encrypt(data,'contraseña-larga');assert.ok(!JSON.stringify(copy).includes('Vecina'));assert.deepEqual(await decrypt(copy,'contraseña-larga'),data);await assert.rejects(decrypt(copy,'otra-contraseña'),/No se puede abrir/);await assert.rejects(encrypt(data,'corta'),/12 caracteres/);await assert.rejects(decrypt({format:'lua-encrypted',version:1,iterations:600000},'x'),/incompatible/);});
test('Every guide section has steps and an official source',()=>{for(const g of GUIDE){assert.ok(g.steps.length>0);assert.match(g.source.url,/^https:\/\/www\.(112cv\.gva|proteccioncivil|aemet)\.es\//);}});
test('Version and service worker assets stay in sync',async()=>{const sw=await readFile('sw.js','utf8'),pkg=JSON.parse(await readFile('package.json','utf8'));assert.equal(sw.match(/VERSION='(.*?)'/)[1],VERSION);assert.equal(pkg.version,VERSION);const assets=JSON.parse(sw.match(/const ASSETS=(\[.*?\]);/)[1].replace(/'/g,'"'));for(const asset of assets.filter(a=>a!=='./'))await access(asset);for(const file of ['app.js','views.js','report.js','guide.js','core.js','storage.js'])for(const [,dep] of (await readFile(file,'utf8')).matchAll(/from '\.\/(.*?)'/g))assert.ok(assets.includes(`./${dep}`),dep);assert.ok(assets.includes('./app.js'));});
test('The content security policy stays closed',async()=>{const html=await readFile('index.html','utf8');assert.match(html,/default-src 'self'; script-src 'self'; style-src 'self'/);assert.match(html,/connect-src 'self'/);assert.ok(!/ style="/.test(html));assert.ok(!/ style="/.test(await readFile('views.js','utf8')));});
