import {esc,fmt} from './views.js';
import {today} from './core.js';

const items=rows=>rows.length?`<ul>${rows.map(r=>`<li>${r}</li>`).join('')}</ul>`:'<p>Sin completar.</p>';
// Standalone page, so its style cannot rely on the app's stylesheet.
export function sheetHTML(data){
  const s=data.shutoffs;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Plan familiar</title><style>body{font:15px/1.4 system-ui,sans-serif;color:#111;max-width:720px;margin:24px auto;padding:0 16px}h1{font-size:26px;margin:0}h2{font-size:17px;margin:18px 0 4px;border-bottom:1px solid #111}ul{margin:0;padding-left:18px}p{margin:4px 0}.sos{font-size:22px;font-weight:700}</style></head><body><h1>Plan familiar</h1><p>Actualizado el ${esc(fmt(today()))}</p><p class="sos">Emergencia: 112</p>
<h2>Dónde nos encontramos</h2>${items(data.meeting.map(m=>`<strong>${esc(m.place)}</strong>: ${esc(m.label)}${m.note?` (${esc(m.note)})`:''}`))}
<h2>Quién recoge a los niños</h2>${items(data.pickups.map(p=>`<strong>${esc(p.child)}</strong>${p.place?` en ${esc(p.place)}`:''}: ${esc(p.first)}. Si no puede: ${esc(p.second)}.${p.note?` ${esc(p.note)}`:''}`))}
<h2>Contactos</h2>${items(data.contacts.map(c=>`<strong>${esc(c.name)}</strong>${c.role?` (${esc(c.role)})`:''}: ${esc(c.phone)}${c.note?`. ${esc(c.note)}`:''}`))}
<h2>Cortes de la casa</h2><p>Luz: ${esc(s.power)||'sin indicar'}</p><p>Agua: ${esc(s.water)||'sin indicar'}</p><p>Gas: ${esc(s.gas)||'sin indicar'}</p>
<h2>En una inundación</h2><ul><li>Si la casa es segura, no salgas.</li><li>No bajes a sótanos ni garajes y evita los ascensores.</li><li>No cruces nunca zonas inundadas.</li><li>Sube a una zona alta y sigue a las autoridades.</li></ul></body></html>`;
}
