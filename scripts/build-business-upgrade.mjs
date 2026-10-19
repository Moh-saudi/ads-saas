import {readFile,writeFile} from 'node:fs/promises';
const dir=new URL('../supabase/migrations/',import.meta.url);
const body=async name=>(await readFile(new URL(name,dir),'utf8')).replace(/^begin;\s*$/gim,'').replace(/^commit;\s*$/gim,'');
const collection=await body('20261019093000_collection_methods.sql');
const names=['20261019130000_license_contract_periods.sql','20261019133000_link_asset_preparation.sql','20261019140000_location_pricing.sql','20261019143000_receipt_references.sql'];
const chunks=await Promise.all(names.map(async name=>`-- SOURCE: ${name}\n${await body(name)}`));
await writeFile(new URL('../supabase_business_upgrade_20261019.sql',import.meta.url),`-- Existing installations through asset photos/location migration. Run ONCE in Supabase SQL Editor.\n-- Atomic upgrade: no demo writes, historical contracts are retained.\nbegin;\ndo $install_collection$\nbegin\n if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='payments' and column_name='payment_method') then\n  execute $collection_sql$\n${collection}\n$collection_sql$;\n elsif to_regprocedure('public.record_invoice_payment_with_method(uuid,numeric,date,text,uuid,text)') is null then\n  raise exception 'INCOMPLETE_COLLECTION_UPGRADE: finish the collection methods migration first';\n end if;\nend $install_collection$;\n${chunks.join('\n\n')}\ncommit;\n`);
console.log('Wrote supabase_business_upgrade_20261019.sql (optionally installs collection methods, then four workflow migrations).');
