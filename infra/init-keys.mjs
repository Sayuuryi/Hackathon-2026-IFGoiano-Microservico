import {generateKeyPairSync,createPublicKey} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync,chownSync,chmodSync} from 'node:fs';
const privatePath='/identity/private.pem',publicPath='/verify/public.pem';
let privateKey;
if(existsSync(privatePath))privateKey=readFileSync(privatePath,'utf8');
else{privateKey=generateKeyPairSync('rsa',{modulusLength:3072,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}}).privateKey;writeFileSync(privatePath,privateKey,{mode:0o600});}
const pub=createPublicKey(privateKey).export({type:'spki',format:'pem'});
writeFileSync(publicPath,pub,{mode:0o644});writeFileSync('/identity/public.pem',pub,{mode:0o644});
chownSync(privatePath,1000,1000);chmodSync(privatePath,0o600);
console.log('Chaves locais preparadas; somente a identidade recebe a chave privada.');
