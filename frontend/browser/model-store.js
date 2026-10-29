import { sha256 } from '@noble/hashes/sha2.js';
export const MODEL={id:'gemma4-e2b-41c5569',name:'Gemma 4 E2B',bytes:2008432640,hash:'a53a59001894c58e6bdb5b9b227709f91a2e3e556baa7d85acf9c55402ba5cf5',url:'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/41c5569623a7c189d6eec3e5225260c58cedbce7/gemma-4-E2B-it-gpu.litertlm'};
const CHUNK=8*1024*1024;
let opened;
export function database(){return opened||=new Promise((resolve,reject)=>{const r=indexedDB.open('ninho-device-v3',1);r.onupgradeneeded=()=>{for(const n of ['chunks','meta','private'])r.result.createObjectStore(n);};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('Este aparelho não permitiu guardar os arquivos.'));});}
export async function get(store,key){const db=await database();return new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function put(store,key,value){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Não consegui salvar o arquivo.'));});}
export async function remove(store,key){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
export async function status(){const m=await get('meta',MODEL.id);return m||{bytes:0,complete:false};}
export async function deleteModel(){const db=await database();await new Promise((resolve,reject)=>{const tx=db.transaction(['chunks','meta'],'readwrite');tx.objectStore('chunks').clear();tx.objectStore('meta').delete(MODEL.id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
export function modelStream(){let offset=0;return new ReadableStream({async pull(controller){if(offset>=MODEL.bytes){controller.close();return;}try{const data=await get('chunks',MODEL.id+'|'+offset);if(!data)throw Error('Falta uma parte do modelo. Prepare seu companheiro novamente.');offset+=data.byteLength;controller.enqueue(new Uint8Array(data));}catch(e){controller.error(e);}}});}
async function verify(signal,progress){const digest=sha256.create();let offset=0;while(offset<MODEL.bytes){signal?.throwIfAborted();const data=await get('chunks',MODEL.id+'|'+offset);if(!data)throw Error('O download ficou incompleto.');digest.update(new Uint8Array(data));offset+=data.byteLength;progress?.({stage:'verifying',bytes:offset,total:MODEL.bytes});}const actual=Array.from(digest.digest(),x=>x.toString(16).padStart(2,'0')).join('');if(actual!==MODEL.hash){await deleteModel();throw Error('Os arquivos não passaram na conferência. Tente baixar novamente.');}await put('meta',MODEL.id,{bytes:MODEL.bytes,complete:true,hash:actual});}
export async function prepareModel({signal,progress,file}={}){
 let meta=await status();if(meta.complete)return meta;
 if(file&&file.size!==MODEL.bytes)throw Error('Escolha o arquivo Gemma 4 E2B indicado, com 2.008.432.640 bytes.');
 const estimate=await navigator.storage?.estimate?.();
 if(estimate?.quota&&estimate.quota-(estimate.usage||0)<MODEL.bytes-meta.bytes+150*1024*1024)throw Error('Falta espaço para preparar este companheiro. Libere cerca de 2,2 GB e tente novamente.');
 let offset=Math.max(0,meta.bytes||0),reader;
 if(file)reader=file.slice(offset).stream().getReader();
 else{
  const response=await fetch(MODEL.url,{signal,headers:offset?{Range:'bytes='+offset+'-'}:{},credentials:'omit',referrerPolicy:'no-referrer'});
  if(!response.ok)throw Error('O arquivo da IA não respondeu. Tente novamente ou escolha o arquivo já baixado.');
  if(offset&&response.status!==206){await deleteModel();offset=0;}
  if(response.status===206&&!response.headers.get('content-range')?.startsWith('bytes '+offset+'-'))throw Error('Não consegui retomar esse arquivo. Remova o download e tente de novo.');
  if(!response.body)throw Error('Este navegador não permite baixar esse arquivo.');reader=response.body.getReader();
 }
 let buffer=new Uint8Array(Math.min(CHUNK,MODEL.bytes-offset)),used=0;
 const abort=()=>reader.cancel().catch(()=>{});signal?.addEventListener('abort',abort,{once:true});
 try{for(;;){signal?.throwIfAborted();const {value,done}=await reader.read();if(done)break;let cursor=0;while(cursor<value.length){if(offset+used>=MODEL.bytes)throw Error('O arquivo recebido tem um tamanho inesperado.');const size=Math.min(buffer.length-used,value.length-cursor);buffer.set(value.subarray(cursor,cursor+size),used);used+=size;cursor+=size;if(used===buffer.length){await put('chunks',MODEL.id+'|'+offset,buffer.buffer);offset+=used;await put('meta',MODEL.id,{bytes:offset,complete:false});used=0;buffer=new Uint8Array(Math.min(CHUNK,MODEL.bytes-offset));}progress?.({stage:'downloading',bytes:offset+used,total:MODEL.bytes});}}signal?.throwIfAborted();if(offset!==MODEL.bytes)throw Error('O download parou antes de terminar. Você pode retomá-lo.');}
 finally{signal?.removeEventListener('abort',abort);await reader.cancel().catch(()=>{});}
 await verify(signal,progress);return await status();
}
export async function cacheRuntime(signal,progress){
 if(!('serviceWorker'in navigator))throw Error('Este navegador não permite preparar o Ninho offline.');
 const registration=await navigator.serviceWorker.getRegistration('/');
 if(!registration)await navigator.serviceWorker.register('/sw.js',{scope:'/'});
 await navigator.serviceWorker.ready;
 const list=await fetch('/runtime-assets.json',{signal}).then(r=>{if(!r.ok)throw Error('Não consegui preparar os arquivos de voz e conversa.');return r.json();});
 const cache=await caches.open('ninho-runtime-v3');let n=0;
 for(const path of list){signal?.throwIfAborted();if(!await cache.match(path)||(!path.startsWith('/vendor/')&&navigator.onLine)){const response=await fetch(path,{signal});if(!response.ok)throw Error('Um arquivo do Ninho não terminou de baixar.');await cache.put(path,response);}progress?.({stage:'runtime',bytes:++n,total:list.length});}
}
