import {VERSION,FIELDS,empty,today,validate,encrypt,decrypt,addStarter} from './core.js';
import {read,write} from './storage.js';
import {ahora,plan,aldia,guia,ajustes,entryForm,passwordForm,fileReady} from './views.js';
import {sheetHTML} from './report.js';

const $=s=>document.querySelector(s);
const VIEWS={ahora,plan,aldia,guia,ajustes};
let data=empty(),view='ahora',storageOK=true,offlineReady=false,pendingFile=null,restorePayload=null,afterSave=null,busy=false;

function render(){$('#app').innerHTML=VIEWS[view]({data,offlineReady,storageOK,version:VERSION});}
let toastTimer;function toast(message){$('#notice').textContent=message;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#notice').textContent='',5500);}
function modal(content){const m=$('#modal');m.innerHTML=`<button class="close" aria-label="Cerrar" data-action="close">×</button>${content}<div id="modal-error" role="alert"></div>`;if(!m.open)m.showModal();}
const closeModal=()=>$('#modal').close();
const fail=e=>{const box=$('#modal').open&&$('#modal-error');if(box)box.textContent=e.message;else toast(e.message);};
async function save(next){if(!storageOK)throw Error('No se puede guardar en este navegador.');const valid=validate(next);await write(valid);data=valid;render();}
const entryOf=(col,id)=>id?data[col].find(x=>x.id===id):col==='shutoffs'?data.shutoffs:null;
function offerFile(file,title,text,done=null){pendingFile=file;afterSave=done;modal(fileReady(title,text));}
async function saveFile(){
  if(navigator.canShare?.({files:[pendingFile]}))await navigator.share({files:[pendingFile],title:pendingFile.name});
  else{const url=URL.createObjectURL(pendingFile),a=document.createElement('a');a.href=url;a.download=pendingFile.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  if(afterSave)await afterSave();
  closeModal();toast('Comprueba que el archivo está donde lo has guardado.');
}
const ACTIONS={
  nav(el){view=el.dataset.view;render();scrollTo(0,0);},
  close:closeModal,
  edit(el){const{col,id}=el.dataset;modal(entryForm(col,entryOf(col,id),id));},
  async delete(){const f=$('#modal form');if(!confirm('¿Eliminar este dato?'))return;const{col,id}=f.dataset;await save({...data,[col]:data[col].filter(x=>x.id!==id)});closeModal();},
  async starter(){await save(addStarter(data));toast('Lista añadida. Marca lo que ya tengáis.');},
  backup(){modal(passwordForm('backup','Guardar copia','Mínimo 12 caracteres. Sin la contraseña no se puede recuperar.','Cifrar copia'));},
  sheet(){offerFile(new File([sheetHTML(data)],`plan-familiar-ficha-${today()}.html`,{type:'text/html'}),'Ficha lista','El archivo no va cifrado: incluye teléfonos y nombres. Ábrelo para imprimirlo y no lo subas a ningún sitio público.');},
  'save-file':saveFile,
};
document.addEventListener('click',async e=>{
  const el=e.target.closest('[data-action]');
  if(!el||el.matches('input')||busy)return;
  busy=true;
  try{await ACTIONS[el.dataset.action]?.(el);}catch(err){if(err.name!=='AbortError')fail(err);}finally{busy=false;}
});
document.addEventListener('submit',async e=>{
  e.preventDefault();
  const form=e.target,button=form.querySelector('button:not([type=button])'),values=Object.fromEntries(new FormData(form));
  button.disabled=true;$('#modal-error').textContent='';
  try{await SUBMIT[form.dataset.form](form,values);}catch(err){fail(err);}finally{button.disabled=false;}
});
const SUBMIT={
  async entry(form,values){
    const{col,id}=form.dataset;
    for(const f of FIELDS[col])if(f.type==='checkbox')values[f.k]=f.k in values;
    if(col==='shutoffs')await save({...data,shutoffs:values});
    else if(id)await save({...data,[col]:data[col].map(x=>x.id===id?{id,...values}:x)});
    else await save({...data,[col]:[...data[col],{id:crypto.randomUUID(),...values}]});
    closeModal();
  },
  async backup(form,{password}){
    const payload=await encrypt(data,password);
    offerFile(new File([JSON.stringify(payload)],`plan-familiar-${today()}.json`,{type:'application/json'}),'Copia cifrada','Guárdala en Archivos o pásala al otro móvil. La contraseña se comparte aparte.',()=>save({...data,lastBackup:today()}));
  },
  async restore(form,{password}){
    const next=await decrypt(restorePayload,password);
    if(!confirm('Esta copia sustituirá todo lo que hay en este móvil. ¿Continuar?'))return;
    await save(next);restorePayload=null;closeModal();toast('Copia restaurada.');
  },
};
document.addEventListener('change',async e=>{
  const el=e.target;
  if(el.dataset.action==='toggle-have'){try{await save({...data,items:data.items.map(x=>x.id===el.dataset.id?{...x,have:el.checked}:x)});}catch(err){toast(err.message);render();}}
  if(el.dataset.action==='restore-file'&&el.files[0]){try{restorePayload=JSON.parse(await el.files[0].text());modal(passwordForm('restore','Abrir copia','Sustituirá todo lo que hay en este móvil.','Abrir'));}catch{toast('Ese archivo no es una copia del plan.');}el.value='';}
});
document.addEventListener('visibilitychange',async()=>{if(document.visibilityState!=='visible'||$('#modal').open||!storageOK)return;try{const stored=await read();data=stored?validate(stored):empty();render();}catch(e){toast(e.message);}});
function showUpdate(reg){if($('#app-update'))return;const b=document.createElement('button');b.id='app-update';b.className='update-banner';b.textContent='Nueva versión disponible · Actualizar';b.onclick=()=>{b.disabled=true;navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});reg.waiting?.postMessage({type:'SKIP_WAITING'});};document.body.append(b);}
async function init(){
  try{const stored=await read();data=stored?validate(stored):empty();}catch(e){storageOK=false;toast(e.message);}
  render();
  navigator.storage?.persist?.().catch(()=>{});
  if(!('serviceWorker'in navigator))return;
  try{const reg=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});const offer=()=>{if(reg.waiting&&navigator.serviceWorker.controller)showUpdate(reg);};offer();reg.addEventListener('updatefound',()=>{reg.installing?.addEventListener('statechange',offer);});await navigator.serviceWorker.ready;offlineReady=true;render();}
  catch{toast('No se ha preparado el modo sin conexión. Vuelve a abrir con internet.');}
}
init();
