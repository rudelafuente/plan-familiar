import {FIELDS,WARN,pending,readiness,tel,today} from './core.js';
import {GUIDE,REVIEWED} from './guide.js';

export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const fmt=date=>date?new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`)):'';
const TABS=[['ahora','Ahora'],['plan','Plan'],['aldia','Al día'],['guia','Guía'],['ajustes','Ajustes']];
const nav=view=>`<nav class="tabs" aria-label="Secciones">${TABS.map(([id,label])=>`<button data-action="nav" data-view="${id}"${id===view?' class="active" aria-current="page"':''}>${label}</button>`).join('')}</nav>`;
const page=(view,title,body)=>`<main class="shell"><h1>${title}</h1>${body}</main>${nav(view)}`;
const add=(col,label)=>`<button class="ghost" data-action="edit" data-col="${col}">+ ${label}</button>`;
const edit=(col,id)=>`<button class="link" data-action="edit" data-col="${col}" data-id="${esc(id)}">Editar</button>`;
const blank=text=>`<p class="muted">${text}</p>`;
const sms=phone=>`sms:${tel(phone)}?&body=${encodeURIComponent('Estoy bien. ')}`;
const row=(title,detail,side='')=>`<li class="row"><div><strong>${esc(title)}</strong>${detail?`<small>${esc(detail)}</small>`:''}</div>${side}</li>`;
const list=rows=>`<ul class="rows">${rows.join('')}</ul>`;
const when=days=>days<0?`Venció hace ${-days} ${-days===1?'día':'días'}`:days===0?'Vence hoy':`Vence en ${days} ${days===1?'día':'días'}`;
const dial=c=>`<span class="dial"><a class="btn" href="tel:${esc(tel(c.phone))}">Llamar</a><a class="btn soft" href="${esc(sms(c.phone))}">Mensaje</a></span>`;

export function ahora({data}){
  const due=pending(data),checks=readiness(data),left=checks.filter(c=>!c.ok);
  return page('ahora','Ahora',`<a class="sos" href="tel:112"><strong>Llamar al 112</strong><small>Solo si es una emergencia</small></a>
  <section><h2>Dónde nos encontramos</h2>${data.meeting.length?list(data.meeting.map(m=>row(m.place,[m.label,m.note].filter(Boolean).join(' · ')))):blank('Aún no hay puntos de encuentro.')}</section>
  <section><h2>Quién recoge a los niños</h2>${data.pickups.length?list(data.pickups.map(p=>row(p.child,`${p.first}. Si no puede: ${p.second}.${p.place?` ${p.place}.`:''}`))):blank('Aún no está decidido.')}</section>
  <section><h2>Contactos</h2>${data.contacts.length?list(data.contacts.map(c=>row(c.name,c.role,dial(c)))):blank('Aún no hay contactos.')}</section>
  <button class="wide" data-action="nav" data-view="guia">Qué hacer ahora</button>
  ${due.length?`<section><h2>Vence pronto</h2>${list(due.map(d=>row(d.name,`${when(d.days)}${d.detail?` · ${d.detail}`:''}`,edit(d.col,d.id))))}</section>`:''}
  ${left.length?`<section><h2>Falta por preparar</h2><p class="muted">${checks.length-left.length} de ${checks.length} listos.</p>${list(left.map(c=>`<li class="row"><button class="link" data-action="nav" data-view="${c.view}">${esc(c.label)}</button></li>`))}</section>`:''}`);
}
export function plan({data}){
  const s=data.shutoffs,spot=(label,v)=>row(label,v||'Sin indicar');
  return page('plan','Plan',`<section><h2>Contactos</h2>${data.contacts.length?list(data.contacts.map(c=>row(c.name,[c.role,c.phone].filter(Boolean).join(' · '),edit('contacts',c.id)))):blank('Incluye a alguien de fuera de Valencia: puede servir de enlace si aquí no hay línea.')}${add('contacts','Añadir contacto')}</section>
  <section><h2>Puntos de encuentro</h2>${data.meeting.length?list(data.meeting.map(m=>row(m.place,m.label,edit('meeting',m.id)))):blank('Elige uno cerca de casa y otro fuera del barrio, en una zona alta y lejos de cauces.')}${add('meeting','Añadir punto')}</section>
  <section><h2>Recogida de los niños</h2>${data.pickups.length?list(data.pickups.map(p=>row(p.child,`${p.first}, si no ${p.second}`,edit('pickups',p.id)))):blank('Decide quién va y quién le sustituye. Confirma con el centro que esa persona está autorizada.')}${add('pickups','Añadir recogida')}</section>
  <section><h2>Cortes de la casa</h2>${list([spot('Luz',s.power),spot('Agua',s.water),spot('Gas',s.gas)])}<button class="ghost" data-action="edit" data-col="shutoffs">Editar cortes</button></section>`);
}
export function aldia({data}){
  const now=today(),have=data.items.filter(x=>x.have).length;
  const dueSide=x=>edit('dues',x.id);
  const item=x=>`<li class="row"><label class="check"><input type="checkbox" data-action="toggle-have" data-id="${esc(x.id)}"${x.have?' checked':''}><span><strong>${esc(x.name)}</strong>${[x.qty,x.place,x.expires&&`caduca ${fmt(x.expires)}`].filter(Boolean).length?`<small>${esc([x.qty,x.place,x.expires&&`caduca ${fmt(x.expires)}`].filter(Boolean).join(' · '))}</small>`:''}</span></label>${edit('items',x.id)}</li>`;
  return page('aldia','Al día',`<section><h2>Documentos y vencimientos</h2><p class="muted">Avisa ${WARN.dues} días antes. Guarda solo la fecha, nunca el número del documento.</p>${data.dues.length?list([...data.dues].sort((a,b)=>a.expires.localeCompare(b.expires)).map(x=>row(x.name,[x.person,fmt(x.expires),x.expires<now&&'Vencido'].filter(Boolean).join(' · '),dueSide(x)))):blank('Sin vencimientos todavía.')}${add('dues','Añadir vencimiento')}</section>
  <section><h2>Kit de casa</h2><p class="muted">Para al menos 3 días. ${data.items.length?`${have} de ${data.items.length} listos.`:''}</p>${data.items.length?list(data.items.map(item)):blank('Puedes empezar con la lista oficial del 112.')}<div class="actions">${add('items','Añadir')}<button class="ghost" data-action="starter">Lista del 112</button></div></section>`);
}
export function guia(){
  return page('guia','Guía',`<p class="muted">Sigue siempre las instrucciones oficiales del momento. Esta guía no las sustituye.</p>${GUIDE.map(g=>`<details class="guide"><summary>${esc(g.title)}</summary><ol>${g.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><small>Fuente: <a href="${esc(g.source.url)}" rel="noopener noreferrer">${esc(g.source.label)}</a></small></details>`).join('')}<p class="muted"><small>Revisada el ${fmt(REVIEWED)}.</small></p>`);
}
export function ajustes({data,offlineReady,storageOK,version,local}){
  return page('ajustes','Ajustes',`<section><h2>${local?'Pasar al móvil':'Compartir el plan'}</h2><p class="muted">${local?'Guarda una copia cifrada y ábrela en el móvil desde Ajustes. Sustituirá todo lo que haya allí.':'Tus datos solo están en este móvil. Para pasarlos a otro, guarda una copia cifrada y ábrela allí.'}</p><p class="muted">Última copia: ${data.lastBackup?fmt(data.lastBackup):'ninguna'}.</p><div class="actions"><button class="ghost" data-action="backup">Guardar copia</button><label class="ghost file">Abrir copia<input type="file" data-action="restore-file"></label></div></section>
  <section><h2>En papel</h2><p class="muted">El móvil puede quedarse sin batería. Imprime una ficha y déjala en casa.</p><button class="ghost" data-action="sheet">Crear ficha</button></section>
  <section><h2>Estado</h2>${local?'<p class="muted">Edición local. Los cambios se guardan en plan.json.</p>':`<p class="muted">${storageOK?'Datos guardados en este dispositivo.':'No se puede guardar en este navegador.'} ${offlineReady?'Funciona sin conexión.':'El modo sin conexión aún no está listo.'}</p>`}<small class="muted">Versión ${esc(version)}.${local?'':' <a href="actualizar.html">Reparar actualización</a>'}</small></section>`);
}
function input(f,value){
  const id=`f-${f.k}`,hint=f.hint?` placeholder="${esc(f.hint)}"`:'',req=f.req?' required':'';
  if(f.type==='checkbox')return `<label class="check" for="${id}"><input id="${id}" name="${f.k}" type="checkbox"${value?' checked':''}><span>${esc(f.label)}</span></label>`;
  const control=f.type==='select'?`<select id="${id}" name="${f.k}">${f.options.map(o=>`<option${o===value?' selected':''}>${esc(o)}</option>`).join('')}</select>`:`<input id="${id}" name="${f.k}" type="${f.type??'text'}" value="${esc(value)}" maxlength="200"${hint}${req}>`;
  return `<label for="${id}">${esc(f.label)}</label>${control}`;
}
export const TITLES={contacts:'Contacto',meeting:'Punto de encuentro',pickups:'Recogida',items:'Kit de casa',dues:'Vencimiento',shutoffs:'Cortes de la casa'};
export const entryForm=(col,entry,id)=>`<h2>${TITLES[col]}</h2><form data-form="entry" data-col="${col}"${id?` data-id="${esc(id)}"`:''}>${FIELDS[col].map(f=>input(f,entry?.[f.k])).join('')}<button class="wide">Guardar</button>${id?'<button type="button" class="link danger" data-action="delete">Eliminar</button>':''}</form>`;
export const passwordForm=(form,title,text,button)=>`<h2>${title}</h2><p class="muted">${text}</p><form data-form="${form}"><label for="f-pass">Contraseña</label><input id="f-pass" name="password" type="password" minlength="${form==='backup'?12:1}" autocomplete="off" required><button class="wide">${button}</button></form>`;
export const fileReady=(title,text)=>`<h2>${title}</h2><p class="muted">${text}</p><button class="wide" data-action="save-file">Guardar archivo</button>`;
