begin;
-- Historical records remain readable; new electronic receipts must identify the transfer.
alter table public.payments add constraint electronic_payment_reference
 check(payment_method not in ('bank_transfer','instapay','vodafone_cash','card') or nullif(trim(reference),'') is not null) not valid;
commit;
