import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInThisContext} from 'node:vm';
import * as imageRules from '../web/lib/asset-images.mjs';
export async function checkAssetPhotoUpload() {
 const requireWeb=createRequire(new URL('../web/package.json',import.meta.url));
 const ts=requireWeb('typescript');
 const code=ts.transpileModule(readFileSync(new URL('../web/lib/asset-photo-storage.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const helpers={};
 runInThisContext(`(function(exports,require){${code}\n})`)(helpers,(name)=>name==='server-only'?{}:name==='./asset-images.mjs'?imageRules:requireWeb(name));
 assert.equal(await helpers.prepareAssetPhoto(null),null);
 await assert.rejects(()=>helpers.prepareAssetPhoto(new File(['<script>bad</script>'],'photo.png',{type:'image/png'})),/PNG/);
 await assert.rejects(()=>helpers.prepareAssetPhoto(new File([new Uint8Array(imageRules.maxAssetImageBytes+1)],'large.png',{type:'image/png'})),/2/);
 const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jwZkAAAAASUVORK5CYII=','base64');
 const photo=await helpers.prepareAssetPhoto(new File([bytes],'original.png',{type:'image/png'}));
 let calls=0;
 const storage={storage:{from(bucket){assert.equal(bucket,'asset-photos');return {async upload(path,payload,options){calls++;assert.match(path,/^tenant\/asset\/[0-9a-f-]{36}\.png$/);assert.deepEqual(Buffer.from(payload),bytes);assert.equal(options.contentType,'image/png');assert.equal(options.upsert,false);return {error:null};}};}}};
 assert.equal((await helpers.storeAssetPhoto(storage,'tenant','asset',photo)).error,null);
 assert.equal(calls,1);
 const failing={storage:{from(){return {async upload(){return {error:{message:'Storage unavailable'}};}};}}};
 assert.equal((await helpers.storeAssetPhoto(failing,'tenant','asset',photo)).error.message,'Storage unavailable');
}
