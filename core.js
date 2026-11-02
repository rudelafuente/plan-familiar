export const VERSION='0.2.0';
// Days before a date when it starts appearing as pending. Documents need time for an appointment.
export const WARN={dues:90,items:30};
export const BACKUP_DAYS=180;
export const DUE_KINDS=['DNI','Pasaporte','ITV','Seguro','Tarjeta sanitaria','Otro'];

// Single description of every record: drives validate() and the edit forms.
export const FIELDS={
  contacts:[{k:'name',label:'Nombre',req:true},{k:'role',label:'Quién es',hint:'Familia, vecina, colegio…'},{k:'phone',label:'Teléfono',type:'tel',req:true},{k:'note',label:'Nota'}],
  meeting:[{k:'label',label:'Cuándo',req:true,hint:'Si no podemos volver a casa'},{k:'place',label:'Dónde',req:true},{k:'note',label:'Nota'}],
  pickups:[{k:'child',label:'Niño o niña',req:true},{k:'place',label:'Dónde está',hint:'Colegio, extraescolar…'},{k:'first',label:'Recoge primero',req:true},{k:'second',label:'Si no puede',req:true},{k:'note',label:'Nota'}],
  items:[{k:'name',label:'Qué',req:true},{k:'place',label:'Dónde se guarda'},{k:'qty',label:'Cantidad'},{k:'expires',label:'Caduca',type:'date'},{k:'have',label:'Ya lo tenemos',type:'checkbox'}],
  dues:[{k:'name',label:'Qué',req:true,hint:'Sin números de documento'},{k:'kind',label:'Tipo',type:'select',options:DUE_KINDS},{k:'person',label:'De quién o de qué'},{k:'expires',label:'Vence',type:'date',req:true}],
  shutoffs:[{k:'power',label:'Luz',hint:'Dónde está el corte'},{k:'water',label:'Agua',hint:'Dónde está la llave'},{k:'gas',label:'Gas',hint:'Dónde está la llave'}],
};
// Official list: 112 Comunitat Valenciana, kit for at least 3 days.
export const STARTER=['Agua','Alimentos no perecederos','Cocina portátil no eléctrica','Productos de higiene','Linterna','Velas y cerillas','Radio a pilas','Pilas de repuesto','Cargador y batería para el móvil','Botiquín con medicinas esenciales','Dinero en efectivo'];

const pad=n=>String(n).padStart(2,'0');
export const today=(d=new Date())=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const noon=date=>Date.parse(`${date}T12:00:00Z`);
export const addDays=(date,days)=>new Date(noon(date)+days*864e5).toISOString().slice(0,10);
export const daysUntil=(date,from=today())=>Math.round((noon(date)-noon(from))/864e5);
export const isDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(noon(v))&&new Date(noon(v)).toISOString().slice(0,10)===v;
export const tel=v=>String(v??'').replace(/[^\d+]/g,'');
export const empty=()=>({version:1,contacts:[],meeting:[],pickups:[],items:[],dues:[],shutoffs:{power:'',water:'',gas:''},lastBackup:null});

function cleanField(field,value){
  if(field.type==='checkbox')return value===true;
  if(field.type==='date'){if(!value)return null;if(!isDate(value))throw Error(`Fecha no válida en «${field.label}».`);return value;}
  const text=typeof value==='string'?value.trim().slice(0,200):'';
  if(field.type==='tel'&&text&&tel(text).length<3)throw Error('Teléfono no válido.');
  return text;
}
function cleanEntry(col,raw){
  const out={};
  for(const f of FIELDS[col]){out[f.k]=cleanField(f,raw?.[f.k]);if(f.req&&!out[f.k])throw Error(`Falta «${f.label}».`);}
  return out;
}
// Only gate for the schema: saves and restores both pass through here.
export function validate(raw){
  if(!raw||typeof raw!=='object'||raw.version!==1)throw Error('Datos incompatibles.');
  const data=empty();
  for(const col of ['contacts','meeting','pickups','items','dues'])data[col]=(Array.isArray(raw[col])?raw[col]:[]).map(entry=>({id:typeof entry?.id==='string'&&entry.id?entry.id:crypto.randomUUID(),...cleanEntry(col,entry)}));
  data.shutoffs=cleanEntry('shutoffs',raw.shutoffs);
  data.lastBackup=isDate(raw.lastBackup)?raw.lastBackup:null;
  return data;
}

export function pending(data,now=today()){
  const entry=(col,x,detail)=>{const days=daysUntil(x.expires,now);return days<=WARN[col]?{id:x.id,col,name:x.name,detail,expires:x.expires,days}:null;};
  return [...data.dues.map(x=>entry('dues',x,[x.kind,x.person].filter(Boolean).join(' · '))),...data.items.filter(x=>x.have&&x.expires).map(x=>entry('items',x,x.place))].filter(Boolean).sort((a,b)=>a.days-b.days);
}
export function readiness(data,now=today()){
  const{power,water,gas}=data.shutoffs;
  return [
    {label:'Dos contactos con teléfono',ok:data.contacts.length>=2,view:'plan'},
    {label:'Dos puntos de encuentro',ok:data.meeting.length>=2,view:'plan'},
    {label:'Recogida de los niños decidida',ok:data.pickups.length>=1,view:'plan'},
    {label:'Cortes de luz, agua y gas localizados',ok:Boolean(power&&water&&gas),view:'plan'},
    {label:'Kit para 3 días en casa',ok:data.items.length>0&&data.items.every(x=>x.have),view:'aldia'},
    {label:'Copia cifrada reciente',ok:Boolean(data.lastBackup)&&daysUntil(data.lastBackup,now)>=-BACKUP_DAYS,view:'ajustes'},
  ];
}
export function addStarter(data){
  const seen=new Set(data.items.map(x=>x.name.toLowerCase()));
  return {...data,items:[...data.items,...STARTER.filter(n=>!seen.has(n.toLowerCase())).map(name=>({id:crypto.randomUUID(),name,place:'',qty:'',expires:null,have:false}))]};
}

const b64=bytes=>{let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s);};
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function keyFor(password,salt){const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:600000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
export async function encrypt(data,password){if(password.length<12)throw Error('Usa una contraseña de al menos 12 caracteres.');const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),key=await keyFor(password,salt);const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(validate(data))));return {format:'plan-familiar-encrypted',version:1,kdf:'PBKDF2-SHA256',iterations:600000,salt:b64(salt),iv:b64(iv),cipher:b64(new Uint8Array(cipher))};}
export async function decrypt(payload,password){if(payload?.format!=='plan-familiar-encrypted'||payload.version!==1||payload.iterations!==600000)throw Error('Formato de copia cifrada incompatible.');try{const salt=unb64(payload.salt),iv=unb64(payload.iv);if(salt.length!==16||iv.length!==12)throw Error();const key=await keyFor(password,salt);const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,unb64(payload.cipher));return validate(JSON.parse(new TextDecoder().decode(plain)));}catch{throw Error('No se puede abrir la copia. Contraseña incorrecta o archivo dañado.');}}
