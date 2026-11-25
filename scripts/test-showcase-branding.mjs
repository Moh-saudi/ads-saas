import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInThisContext} from 'node:vm';
const requireWeb=createRequire(new URL('../web/package.json',import.meta.url)),ts=requireWeb('typescript');
function load(path,mocks={}){const exports={};const js=ts.transpileModule(readFileSync(new URL('../web/'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;runInThisContext(`(function(exports,require){${js}\n})`)(exports,id=>{if(Object.hasOwn(mocks,id))return mocks[id];throw Error('Unexpected dependency '+id);});return exports;}
const host=load('lib/host.ts');const showcase=load('lib/showcase-host.ts',{'./host':host});
for(const h of ['ads-kappa-one.vercel.app','ADS-KAPPA-ONE.VERCEL.APP:443'])assert.equal(showcase.isShowcaseHost(h),true);
for(const h of ['client.example','ads-kappa-one.vercel.app.attacker.example','ads-kappa-one.vercel.app@attacker.example',''])assert.equal(showcase.isShowcaseHost(h),false);
const metadata=load('lib/share-metadata.ts');const demo=metadata.showcaseMetadata();assert.match(demo.title.absolute,/ميسك.*ديمو/);assert.equal(demo.openGraph.siteName,'ميسك — الشركة المطوّرة');assert.equal(demo.openGraph.images[0].url,'/media/brand/mesk-share.png');
const client=metadata.shareMetadata({name:'Customer brand',title:'Customer title',logo:'https://client.example/logo.png',origin:'https://client.example'});assert.equal(client.openGraph.siteName,'Customer brand');assert.equal(client.openGraph.images[0].url,'https://client.example/logo.png');
let activeHost='ads-kappa-one.vercel.app';const calls=[];
const action=load('app/enquiry-action.ts',{'next/headers':{headers:async()=>new Headers({host:activeHost})},'@/lib/host':host,'@/lib/showcase-host':showcase,'@/lib/env':{configured:true},'@/lib/supabase/server':{createClient:async()=>({rpc:async(name,args)=>{calls.push({name,args});return {error:null};}})}});
const form=new FormData();form.set('full_name','Demo lead');form.set('phone','01000000000');form.set('message','A valid campaign enquiry');
assert.equal((await action.requestQuote({ok:false,message:''},form)).ok,false);assert.equal(calls.length,0);
activeHost='client.example';assert.equal((await action.requestQuote({ok:false,message:''},form)).ok,true);assert.equal(calls.length,1);assert.equal(calls[0].name,'submit_enquiry');assert.equal(calls[0].args.p_host,'client.example');
const png=readFileSync(new URL('../web/public/media/brand/mesk-share.png',import.meta.url));assert.ok(png.length<100000);assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),400);
console.log('Showcase host isolation, developer branding, public logo and enquiry separation passed; customer enquiry behavior preserved.');
