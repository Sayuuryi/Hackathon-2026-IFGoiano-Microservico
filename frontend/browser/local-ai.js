export {MODEL,status,prepareModel,deleteModel,cacheRuntime,get,put,remove} from './model-store.js';
let worker,serial=0;
const requests=new Map();
export function stop(){worker?.terminate();worker=null;for(const {reject,timer} of requests.values()){clearTimeout(timer);reject(Error('Conversa interrompida.'));}requests.clear();}
export function call(type,payload={}){
 // LiteRT's published loader uses importScripts, which requires a classic worker.
 if(!worker){worker=new Worker('/assets/pet-worker.js');worker.onmessage=({data})=>{const pending=requests.get(data.id);if(!pending)return;clearTimeout(pending.timer);requests.delete(data.id);if(data.diagnostic)console.warn('Ninho local engine: '+data.diagnostic);data.ok?pending.resolve(data):pending.reject(Error(data.error));};worker.onerror=()=>stop();}
 return new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{stop();reject(Error('Este aparelho demorou mais que o esperado. Você pode tentar novamente.'));},type==='load'?180000:90000);requests.set(id,{resolve,reject,timer});worker.postMessage({id,type,...payload});});
}
