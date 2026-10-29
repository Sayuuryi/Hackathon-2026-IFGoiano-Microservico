import {Engine,SamplerType,loadLiteRtLm} from '@litert-lm/core';
import {modelStream,status} from './model-store.js';
let engine,conversation,turns=0,epoch=0,persona='';
const originalFetch=globalThis.fetch.bind(globalThis);
// WASM is split into public files below the hosting asset size limit.
globalThis.fetch=async(input,init)=>{
 const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
 const absolute=new URL(url,location.href);
 if(absolute.origin===location.origin&&absolute.pathname.startsWith('/vendor/litert/')&&absolute.pathname.endsWith('.wasm')){
  const manifest=await originalFetch('/wasm-parts.json').then(r=>r.json());const parts=manifest[absolute.pathname];
  if(parts){let i=0;return new Response(new ReadableStream({async pull(controller){if(i===parts.length){controller.close();return;}try{const cache=await caches.open('ninho-runtime-v3'),path=parts[i++];const response=await cache.match(path)||await originalFetch(path);if(!response.ok)throw Error('Falta um arquivo de execução.');controller.enqueue(new Uint8Array(await response.arrayBuffer()));}catch(e){controller.error(e);}}}),{headers:{'Content-Type':'application/wasm'}});}
 }
 return originalFetch(input,init);
};
async function release(){epoch++;try{conversation?.cancel();}catch{}try{await conversation?.delete();}catch{}conversation=null;try{await engine?.delete();}catch{}engine=null;turns=0;}
self.onmessage=async({data})=>{
 const {id,type}=data;
 try{
  if(type==='load'){
   if(!(await status()).complete)throw Error('Prepare a IA neste aparelho antes de conversar.');
   await release();
   // In a classic worker Emscripten otherwise resolves WASM beside pet-worker.js.
   self.Module={locateFile:name=>new URL('/vendor/litert/'+name,self.location.origin).href};
   await loadLiteRtLm('/vendor/litert/');
   engine=await Engine.create({model:modelStream(),mainExecutorSettings:{maxNumTokens:2048}});
   self.postMessage({id,ok:true});return;
  }
  if(type==='reset'){await release();self.postMessage({id,ok:true});return;}
  if(type==='cancel'){conversation?.cancel();epoch++;self.postMessage({id,ok:true});return;}
  if(type==='reply'){
   if(!engine)throw Error('A IA ainda não está pronta.');const current=epoch;
   if(!conversation||turns>=6||persona!==data.prompt){await conversation?.delete();conversation=await engine.createConversation({preface:{messages:[{role:'system',content:data.prompt},...(data.context||[]).slice(-4).map(m=>({role:m.role==='user'?'user':'assistant',content:m.text.slice(0,350)}))],extra_context:{enable_thinking:false}},sessionConfig:{maxOutputTokens:160,samplerParams:{type:SamplerType.TOP_P,temperature:.65,p:.9,k:40}}});turns=0;persona=data.prompt;
   }
   const result=await conversation.sendMessage(data.text);turns++;
   const answer=(result.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('').trim();
   if(current!==epoch)return;if(!answer)throw Error('Não consegui formar uma resposta agora.');self.postMessage({id,ok:true,answer});return;
  }
  throw Error('Ação desconhecida.');
 }catch(e){self.postMessage({id,ok:false,diagnostic:type==='load'?String(e?.message||e).slice(0,600):undefined,error:type==='load'?'Não consegui preparar a IA neste aparelho. Confira a compatibilidade e os arquivos baixados.':'Não consegui responder agora. Tente novamente ou continue com uma atividade.'});}
};
