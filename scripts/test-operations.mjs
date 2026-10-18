import assert from "node:assert/strict";
import { invoiceTotals } from "../web/lib/invoice-calculations.mjs";
export async function testOperations({
  db,
  sql,
  as,
  ok,
  rejects,
  id,
  t1,
  t2,
  d1,
  d2,
  d3,
  a1,
  a2,
  admin,
  inspector,
  other,
  p1,
  upstream,
}) {
  const hr = id(81),
    keeper = id(82),
    e1 = id(101),
    e2 = id(102),
    w1 = id(111),
    w2 = id(112),
    w3 = id(113),
    it = id(121),
    it2 = id(122),
    supplier = id(131),
    work = id(141);
  await db.exec("reset role");
  await sql(`insert into auth.users(id) values('${hr}'),('${keeper}')`);
  await sql(
    `insert into profiles(id,tenant_id,role,scope_district_id) values('${hr}','${t1}','hr','${d1}'),('${keeper}','${t1}','storekeeper','${d1}')`,
  );
  await as(admin);
  await sql(
    `insert into employees(id,tenant_id,profile_id,code,full_name,department,job_title,district_id,hire_date,base_salary) values('${e1}','${t1}','${inspector}','E1','Technician','Operations','Installer','${d1}',current_date-100,9000),('${e2}','${t1}',null,'E2','Other Employee','HR','Manager','${d2}',current_date-100,15000)`,
  );
  await sql(
    `insert into warehouses(id,tenant_id,code,name,district_id) values('${w1}','${t1}','WH1','W1','${d1}'),('${w2}','${t1}','WH2','W2','${d2}')`,
  );
  await sql(
    `insert into inventory_items(id,tenant_id,sku,name,reorder_level) values('${it}','${t1}','SKU1','Brackets',5),('${it2}','${t1}','SKU2','Lights',2)`,
  );
  await sql(
    `insert into parties(id,tenant_id,type,name) values('${supplier}','${t1}','supplier','Supplier')`,
  );
  await sql(
    `insert into work_orders(id,tenant_id,ref_no,asset_id,title,assigned_employee_id,status,due_date,created_by) values('${work}','${t1}','WO1','${a1}','Repair','${e1}','assigned',current_date+2,'${admin}')`,
  );
  await as(other);
  await sql(
    `insert into warehouses(id,tenant_id,code,name,district_id) values('${w3}','${t2}','WH3','W3','${d3}')`,
  );
  await as(inspector);
  await ok("employee salary RLS exposes only own file", async () => {
    const r = await sql("select id,base_salary from employees");
    assert.equal(r.rows.length, 1);
    assert.equal(r.rows[0].id, e1);
  });
  await ok("public staff directory omits salary columns", async () => {
    const r = await sql("select * from employee_directory()");
    assert.equal(r.rows.length, 1);
    assert.ok(!Object.hasOwn(r.rows[0], "base_salary"));
  });
  await ok("inspector cannot change salaries", async () => {
    const r = await sql(
      `update employees set base_salary=99000 where id='${e1}' returning id`,
    );
    assert.equal(r.rows.length, 0);
    assert.equal(
      Number(
        (await sql(`select base_salary from employees where id='${e1}'`))
          .rows[0].base_salary,
      ),
      9000,
    );
  });
  await as(hr);
  await ok("HR district scope hides employees in other districts", async () =>
    assert.equal((await sql("select * from employees")).rows.length, 1),
  );
  await as(keeper);
  const move = (
    kind,
    ref,
    from,
    to,
    qty,
    cost = 0,
    ret = "null",
    workid = "null",
  ) =>
    `select move_stock('${kind}','${ref}','${it}',${from ? `'${from}'` : "null"},${to ? `'${to}'` : "null"},${qty},${cost},'Documented stock movement',null,${workid},${ret}) id`;
  const balance = async (w = w1) =>
    Number(
      (
        await sql(
          `select quantity from v_stock_balances where item_id='${it}' and warehouse_id='${w}'`,
        )
      ).rows[0]?.quantity || 0,
    );
  await ok("stock receipt creates quantity and value", async () => {
    await sql(move("receipt", "R1", null, w1, 10, 100));
    assert.equal(await balance(), 10);
  });
  await ok("weighted-average cost is calculated from receipts", async () => {
    await sql(move("receipt", "R2", null, w1, 5, 200));
    const r = (
      await sql(`select * from v_stock_balances where warehouse_id='${w1}'`)
    ).rows[0];
    assert.equal(Number(r.inventory_value), 2000);
    assert.ok(Math.abs(Number(r.average_cost) - 133.3333) < 0.0001);
  });
  const issued = (
    await sql(move("issue", "I1", w1, null, 3, 9999, "null", `'${work}'`))
  ).rows[0].id;
  await ok(
    "stock issue ignores client price and uses weighted cost",
    async () => {
      const r = (
        await sql(`select unit_cost from stock_movements where id='${issued}'`)
      ).rows[0];
      assert.ok(Math.abs(Number(r.unit_cost) - 133.3333) < 0.0001);
      assert.equal(await balance(), 12);
    },
  );
  await rejects(
    "stock cannot become negative",
    move("issue", "BAD", w1, null, 9999),
    /INSUFFICIENT_STOCK/,
  );
  await rejects(
    "scoped keeper cannot transfer outside district",
    move("transfer", "BAD2", w1, w2, 2),
    /WAREHOUSE_OUT_OF_SCOPE/,
  );
  await rejects(
    "cross-tenant warehouse rejected",
    move("transfer", "BAD3", w1, w3, 1),
    /WAREHOUSE_OUT_OF_SCOPE/,
  );
  await rejects(
    "stock ledger cannot be edited directly",
    `update stock_movements set quantity=100 where id='${issued}'`,
    /permission denied/,
  );
  await as(admin);
  await ok("warehouse transfer updates both sides atomically", async () => {
    await sql(move("transfer", "T1", w1, w2, 2));
    assert.equal(await balance(), 10);
    assert.equal(await balance(w2), 2);
  });
  await ok(
    "return linked to issue restores stock at original cost",
    async () => {
      await sql(move("return", "RET1", null, w1, 1, 0, `'${issued}'`));
      assert.equal(await balance(), 11);
    },
  );
  await rejects(
    "return cannot exceed issued quantity",
    move("return", "BADRET", null, w1, 3, 0, `'${issued}'`),
    /INVALID_STOCK_RETURN/,
  );
  await rejects(
    "return without source issue is denied",
    move("return", "BADRET2", null, w1, 1),
    /INVALID_STOCK_RETURN/,
  );
  await as(keeper);
  const po = (
    await sql(
      `select create_purchase('PO1','${supplier}','${w1}',current_date,current_date+3,'[{"item_id":"${it}","quantity":3,"unit_cost":250}]','Purchase test') id`,
    )
  ).rows[0].id;
  await ok("purchase receiving increases stock once", async () => {
    await sql(`select receive_purchase('${po}')`);
    assert.equal(await balance(), 14);
  });
  await rejects(
    "duplicate purchase receipt rejected",
    `select receive_purchase('${po}')`,
    /PURCHASE_ALREADY_PROCESSED/,
  );
  await rejects(
    "keeper cannot post supplier invoice",
    `select invoice_purchase('${po}','SUP1',current_date+30)`,
    /FORBIDDEN/,
  );
  await as(admin);
  const pi = (
    await sql(`select invoice_purchase('${po}','SUP1',current_date+30) id`)
  ).rows[0].id;
  await ok("supplier invoice amount matches purchase lines", async () =>
    assert.equal(
      Number(
        (await sql(`select amount from invoices where id='${pi}'`)).rows[0]
          .amount,
      ),
      750,
    ),
  );
  await rejects(
    "duplicate purchase invoice rejected",
    `select invoice_purchase('${po}','SUP2',current_date+30)`,
    /unique constraint/,
  );
  await ok("goods received clearing account clears after invoice", async () =>
    assert.equal(
      Number(
        (await sql(`select balance from v_trial_balance where code='2200'`))
          .rows[0].balance,
      ),
      0,
    ),
  );
  await as(inspector);
  await ok("assigned employee can start and complete work", async () => {
    await sql(
      `select progress_work_order('${work}','in_progress','Work started')`,
    );
    await sql(
      `select progress_work_order('${work}','completed','Repair and testing completed')`,
    );
    assert.equal(
      (await sql(`select status from work_orders where id='${work}'`)).rows[0]
        .status,
      "completed",
    );
  });
  await rejects(
    "completed work cannot be restarted arbitrarily",
    `select progress_work_order('${work}','in_progress','Start again')`,
    /INVALID_WORK_TRANSITION/,
  );
  await ok("inspection creates linked incident for damaged asset", async () => {
    await sql(
      `select record_inspection('${a1}','damaged','manual',null,'Damaged mount identified',null,null)`,
    );
    assert.equal((await sql("select * from inspections")).rows.length, 1);
  });
  await rejects(
    "unregistered tag cannot confirm an inspection",
    `select record_inspection('${a1}','good','qr','fake-tag','Inspection test',null,null)`,
    /INVALID_ASSET_TAG/,
  );
  await ok("employee clocks attendance using server time", async () => {
    await sql(`select clock_attendance('${e1}','in')`);
    assert.equal(
      (await sql(`select * from attendance where employee_id='${e1}'`)).rows
        .length,
      1,
    );
  });
  await rejects(
    "duplicate open attendance rejected",
    `select clock_attendance('${e1}','in')`,
    /ATTENDANCE_ALREADY_OPEN/,
  );
  await rejects(
    "employee cannot clock another employee",
    `select clock_attendance('${e2}','in')`,
    /FORBIDDEN/,
  );
  await ok("clock out closes the attendance record", async () => {
    await sql(`select clock_attendance('${e1}','out')`);
    assert.ok(
      (await sql(`select check_out from attendance where employee_id='${e1}'`))
        .rows[0].check_out,
    );
  });
  const leave = (
    await sql(
      `select request_leave('${e1}',current_date+5,current_date+7,'annual','Personal leave request') id`,
    )
  ).rows[0].id;
  await rejects(
    "employee cannot approve own leave",
    `select decide_leave('${leave}',true,'Approved')`,
    /FORBIDDEN/,
  );
  await as(hr);
  await ok("HR can approve an in-scope leave", async () => {
    await sql(`select decide_leave('${leave}',true,'Manager approved')`);
    assert.equal(
      (await sql(`select status from leave_requests where id='${leave}'`))
        .rows[0].status,
      "approved",
    );
  });
  const overlap = (
    await sql(
      `select request_leave('${e1}',current_date+6,current_date+8,'annual','Overlapping leave') id`,
    )
  ).rows[0].id;
  await rejects(
    "approved leave intervals cannot overlap",
    `select decide_leave('${overlap}',true,'Approved')`,
    /exclusion constraint|conflicting key/,
  );
  await as(admin);
  const cash = (await sql(`select id from v_cash_balances where kind='cash'`))
      .rows[0].id,
    bank = (await sql(`select id from v_cash_balances where kind='bank'`))
      .rows[0].id;
  const acct = async (code) =>
    (await sql(`select id from ledger_accounts where code='${code}'`)).rows[0]
      .id;
  const income = await acct("4100"),
    expense = await acct("5000");
  const cashBalance = async (c = cash) =>
    Number(
      (await sql(`select balance from v_cash_balances where id='${c}'`)).rows[0]
        .balance,
    );
  const before = await cashBalance();
  await ok(
    "direct income posts balanced entries and increases cash",
    async () => {
      await sql(
        `select create_cash_transaction('income','CASH-IN','${cash}',null,'${income}',20000,current_date,'Direct revenue',null,null)`,
      );
      assert.equal(await cashBalance(), before + 20000);
    },
  );
  await ok("expense posts once and reduces cash", async () => {
    await sql(
      `select create_cash_transaction('expense','CASH-OUT','${cash}',null,'${expense}',5000,current_date,'Office expenses',null,null)`,
    );
    assert.equal(await cashBalance(), before + 15000);
  });
  await rejects(
    "unfunded cash expense is denied",
    `select create_cash_transaction('expense','BAD-CASH','${cash}',null,'${expense}',999999,current_date,'Impossible expense',null,null)`,
    /INSUFFICIENT_CASH/,
  );
  await ok(
    "cash transfer is excluded from income and expense totals",
    async () => {
      const sum = Number(
        (await sql("select sum(income-expense) total from v_monthly_cashflow"))
          .rows[0].total,
      );
      await sql(
        `select create_cash_transaction('transfer','CASH-TRANSFER','${cash}','${bank}',null,1000,current_date,'Bank deposit',null,null)`,
      );
      assert.equal(
        Number(
          (
            await sql(
              "select sum(income-expense) total from v_monthly_cashflow",
            )
          ).rows[0].total,
        ),
        sum,
      );
      assert.equal(await cashBalance(bank), 1000);
    },
  );
  await rejects(
    "opening balance cannot be posted after account activity",
    `select create_cash_transaction('opening','BAD-OPEN','${cash}',null,null,1000,current_date,'Opening balance',null,null)`,
    /OPENING_BALANCE_ALREADY_USED/,
  );
  const pay = (
    await sql(
      `insert into payroll_items(tenant_id,employee_id,period,base_amount,bonus,deductions) values('${t1}','${e1}',date_trunc('month',current_date)::date,9000,500,100) returning id`,
    )
  ).rows[0].id;
  await as(inspector);
  await rejects(
    "employee cannot self-approve payroll",
    `select settle_payroll('${pay}','approve',null,current_date)`,
    /INVALID_PAYROLL_TRANSITION/,
  );
  await as(hr);
  await ok("HR approval posts salary accrual", async () => {
    await sql(`select settle_payroll('${pay}','approve',null,current_date)`);
    assert.equal(
      (await sql(`select status from payroll_items where id='${pay}'`)).rows[0]
        .status,
      "approved",
    );
  });
  await rejects(
    "HR cannot pay payroll without finance role",
    `select settle_payroll('${pay}','pay','${cash}',current_date)`,
    /INVALID_PAYROLL_TRANSITION/,
  );
  await as(admin);
  const salaryBefore = await cashBalance();
  await ok("salary payment reduces cash by approved net amount", async () => {
    await sql(`select settle_payroll('${pay}','pay','${cash}',current_date)`);
    assert.equal(await cashBalance(), salaryBefore - 9400);
  });
  await rejects(
    "salary cannot be paid twice",
    `select settle_payroll('${pay}','pay','${cash}',current_date)`,
    /INVALID_PAYROLL_TRANSITION/,
  );
  await ok("all posted journals balance", async () =>
    assert.equal(
      (
        await sql(
          "select entry_id from journal_lines group by entry_id having sum(debit-credit)<>0",
        )
      ).rows.length,
      0,
    ),
  );
  await ok("trial balance debit equals credit", async () => {
    const r = (
      await sql("select sum(debit) d,sum(credit) c from v_trial_balance")
    ).rows[0];
    assert.equal(Number(r.d), Number(r.c));
  });
  await rejects(
    "application cannot forge a journal header",
    `insert into journal_entries(tenant_id,ref_no,entry_date,description,source_kind,source_id) values('${t1}','FAKE',current_date,'Fake','manual',gen_random_uuid())`,
    /permission denied/,
  );
  await ok("financial and operational changes are audited", async () =>
    assert.ok((await sql("select * from audit_events")).rows.length > 10),
  );
  await as(other);
  await ok(
    "other company sees no warehouse, employee or cash records of tenant A",
    async () => {
      assert.equal(
        (await sql(`select * from employees where tenant_id='${t1}'`)).rows
          .length,
        0,
      );
      assert.equal(
        (await sql(`select * from cash_transactions where tenant_id='${t1}'`))
          .rows.length,
        0,
      );
      assert.equal(
        (await sql(`select * from stock_movements where tenant_id='${t1}'`))
          .rows.length,
        0,
      );
    },
  );
  await as(null, "anon");
  await ok("public website accepts a bounded enquiry", async () =>
    sql(
      `select submit_enquiry('a.test','Website visitor','01012345678','visitor@example.com','Please send an advertising quote','A1')`,
    ),
  );
  await sql(
    `select submit_enquiry('a.test','Website visitor','01012345678',null,'Another quote request',null)`,
  );
  await sql(
    `select submit_enquiry('a.test','Website visitor','01012345678',null,'Another quote request',null)`,
  );
  await rejects(
    "enquiry rate limit prevents repeated submissions",
    `select submit_enquiry('a.test','Website visitor','01012345678',null,'Spam repeated request',null)`,
    /ENQUIRY_RATE_LIMIT/,
  );
  await rejects(
    "anonymous website visitors cannot read private enquiries",
    "select * from enquiries",
    /permission denied/,
  );
  await as(admin);
  await ok(
    "HR user picker is tenant scoped and excludes private auth fields",
    async () => {
      const r = (await sql("select * from tenant_user_directory()")).rows;
      assert.ok(r.some((p) => p.id === inspector));
      assert.ok(!r.some((p) => p.id === other));
      assert.deepEqual(Object.keys(r[0]).sort(), ["full_name", "id", "role"]);
    },
  );
  await as(inspector);
  await ok("general employees cannot enumerate login accounts", async () =>
    assert.equal(
      (await sql("select * from tenant_user_directory()")).rows.length,
      0,
    ),
  );
  await as(hr);
  await ok(
    "manual attendance handles overnight shift in tenant timezone",
    async () => {
      await sql(
        `select manual_attendance('${e1}',current_date-2,'22:00','06:00','Approved night shift correction')`,
      );
      const r = (
        await sql(
          `select extract(epoch from check_out-check_in)/3600 hours from attendance where employee_id='${e1}' and work_date=current_date-2`,
        )
      ).rows[0];
      assert.equal(Number(r.hours), 8);
    },
  );
  await as(admin);
  await ok(
    "hosted explicit defaults cannot expose private RPC to anon",
    async () =>
      assert.equal(
        (
          await sql(
            "select has_function_privilege('anon','record_invoice_payment(uuid,numeric,date,text,uuid)','execute') allowed",
          )
        ).rows[0].allowed,
        false,
      ),
  );
  await ok(
    "anonymous and authenticated users cannot truncate company data",
    async () => {
      assert.equal(
        (
          await sql(
            "select has_table_privilege('anon','tenants','truncate') allowed",
          )
        ).rows[0].allowed,
        false,
      );
      assert.equal(
        (
          await sql(
            "select has_table_privilege('authenticated','profiles','truncate') allowed",
          )
        ).rows[0].allowed,
        false,
      );
    },
  );

  const contract = (
    await sql(
      `select contract_id from contract_lines where asset_id='${a1}' and status='active' limit 1`,
    )
  ).rows[0].contract_id;
  const installment = (
    await sql(
      `select schedule_installment('${contract}',null,'${p1}','INST-TEST',current_date+7,1250) id`,
    )
  ).rows[0].id;
  await ok(
    "installment invoicing preserves party amount and due date",
    async () => {
      const r = (
        await sql(`select issue_installment_invoice('${installment}') id`)
      ).rows[0];
      const inv = (await sql(`select * from invoices where id='${r.id}'`))
        .rows[0];
      assert.equal(inv.party_id, p1);
      assert.equal(Number(inv.amount), 1250);
      assert.equal(inv.contract_id, contract);
    },
  );
  await rejects(
    "installment cannot be invoiced twice",
    `select issue_installment_invoice('${installment}')`,
    /INSTALLMENT_ALREADY_INVOICED/,
  );
  await rejects(
    "upstream installment cannot name an unrelated party",
    `select schedule_installment(null,'${upstream}','${p1}','BAD-UP-INST',current_date+7,100)`,
    /INVALID_UPSTREAM_PARTY/,
  );

  const settlementCash = (
    await sql(
      "select create_cash_account('1099','Backdate test account','cash') id",
    )
  ).rows[0].id;
  await sql(
    `select create_cash_transaction('opening','TEST-OPEN','${settlementCash}',null,null,200,current_date-10,'Opening test funds',null,null)`,
  );
  await sql(
    `select create_cash_transaction('expense','TEST-LATER','${settlementCash}',null,'${expense}',150,current_date-1,'Recorded later expense',null,null)`,
  );
  await rejects(
    "backdated spending cannot overdraw a later cash balance",
    `select create_cash_transaction('expense','TEST-BACKDATED','${settlementCash}',null,'${expense}',100,current_date-5,'Backdated expense',null,null)`,
    /INSUFFICIENT_CASH/,
  );
  await ok("cash may be spent after latest ledger date when funded", async () =>
    sql(
      `select create_cash_transaction('expense','TEST-TODAY','${settlementCash}',null,'${expense}',25,current_date,'Funded expense today',null,null)`,
    ),
  );
  await rejects(
    "invoice cannot fabricate a cash asset balance",
    `select create_itemized_invoice('${supplier}','payable','BAD-CASH-INV',current_date,current_date+7,null,'${(await sql(`select ledger_account_id from cash_accounts where id='${cash}'`)).rows[0].ledger_account_id}','[{"description":"Bad category","quantity":1,"unit_price":100,"discount":0,"tax_rate":0}]')`,
    /CONTROL_ACCOUNT_REQUIRES_WORKFLOW/,
  );
  const national = id(171);
  await sql(
    `insert into parties(id,tenant_id,type,name) values('${national}','${t1}','master_concessionaire','National test')`,
  );
  await ok(
    "upstream agreement captures its entitled payment party",
    async () => {
      const r = (
        await sql(
          `select create_upstream_agreement('UP-PARTIES',current_date+1000,current_date+1100,'per_asset',1200,'[{"asset_id":"${a1}","monthly_cost":100}]',null,'${national}') id`,
        )
      ).rows[0];
      assert.equal(
        (
          await sql(
            `select master_party_id from upstream_contracts where id='${r.id}'`,
          )
        ).rows[0].master_party_id,
        national,
      );
      assert.ok(
        (
          await sql(
            `select schedule_installment(null,'${r.id}','${national}','UP-INST',current_date+1000,100) id`,
          )
        ).rows[0].id,
      );
    },
  );
  const itemized = (
    await sql(
      `select create_itemized_invoice('${p1}','receivable','TAX-TEST',current_date,current_date+30,null,null,'[{"description":"Advertising rental","quantity":2,"unit_price":100,"discount":10,"tax_rate":14}]') id`,
    )
  ).rows[0].id;
  await ok(
    "itemized invoice totals match stored rows and separate tax ledger",
    async () => {
      const r = (
        await sql(
          `select net_total,tax_total,amount,journal_entry_id from invoices where id='${itemized}'`,
        )
      ).rows[0];
      assert.equal(Number(r.net_total), 190);
      assert.equal(Number(r.tax_total), 26.6);
      assert.equal(Number(r.amount), 216.6);
      assert.equal(
        (
          await sql(
            `select * from journal_lines where entry_id='${r.journal_entry_id}'`,
          )
        ).rows.length,
        3,
      );
      assert.equal(
        Number(
          (
            await sql(
              `select sum(net_amount+tax_amount) total from invoice_lines where invoice_id='${itemized}'`,
            )
          ).rows[0].total,
        ),
        216.6,
      );
    },
  );
  await ok(
    "invoice calculations use persisted quantity and price precision",
    async () => {
      const r = (
        await sql(
          `select create_itemized_invoice('${p1}','receivable','PRECISION-TEST',current_date,current_date+1,null,null,'[{"description":"Precision test","quantity":1.00049,"unit_price":1.00515,"discount":0,"tax_rate":0}]') id`,
        )
      ).rows[0];
      assert.equal(
        Number(
          (await sql(`select amount from invoices where id='${r.id}'`)).rows[0]
            .amount,
        ),
        Number(
          (
            await sql(
              `select sum(net_amount+tax_amount) total from invoice_lines where invoice_id='${r.id}'`,
            )
          ).rows[0].total,
        ),
      );
    },
  );
  await rejects(
    "negative invoice discount is rejected",
    `select create_itemized_invoice('${p1}','receivable','BAD-TAX',current_date,current_date+1,null,null,'[{"description":"Invalid tax","quantity":1,"unit_price":100,"discount":-1,"tax_rate":14}]')`,
    /INVALID_INVOICE_LINE/,
  );
  const equity = await acct("3000");
  await ok("invoice preview matches PostgreSQL decimal rounding at half-cent boundaries", async () => {
    for (const [quantity,unit_price,discount,tax_rate] of [["1","1.005","0","14"],["2","100","10","14"],["3.0005","0.55555","0.01","14.125"],["0.125","123.4567","0.02","20"],["1e3",".05","0","0"]]) {
      const expected = (await sql(`select round(round($1::numeric,3)*round($2::numeric,4)-round($3::numeric,2),2) net,round(round(round($1::numeric,3)*round($2::numeric,4)-round($3::numeric,2),2)*round($4::numeric,2)/100,2) tax`,[quantity,unit_price,discount,tax_rate])).rows[0];
      const actual = invoiceTotals([{quantity,unit_price,discount,tax_rate}]);
      assert.equal(actual.net,Number(expected.net)); assert.equal(actual.tax,Number(expected.tax));
    }
  });
  await ok("invoice preview totals already-rounded lines without floating-point drift", async () => {
    assert.deepEqual(invoiceTotals(Array.from({length:3},()=>({quantity:"1",unit_price:"0.1",discount:"0",tax_rate:"0"}))),{net:0.3,tax:0,total:0.3});
  });
  await ok("invoice preview rejects excess discount invalid numeric and total overflow", async () => {
    const line = {quantity:"1",unit_price:"100",discount:"101",tax_rate:"14"};
    assert.equal(invoiceTotals([line]),null);
    assert.equal(invoiceTotals([{...line,quantity:"NaN"}]),null);
    assert.equal(invoiceTotals([{...line,quantity:"100000000000000",discount:"0"}]),null);
  });
  const adjusting = (lines) =>
    `select create_adjustment_journal('ADJ-TEST',current_date,'Approved non-cash correction','${JSON.stringify(lines)}')`;
  await ok(
    "balanced non-cash adjustment posts through controlled RPC",
    async () => {
      await sql(
        adjusting([
          { account: expense, debit: 25 },
          { account: equity, credit: 25 },
        ]),
      );
    },
  );
  await rejects(
    "unbalanced adjustment is rejected",
    adjusting([
      { account: expense, debit: 25 },
      { account: equity, credit: 20 },
    ]),
    /UNBALANCED_JOURNAL/,
  );
  await rejects(
    "cash ledger requires its cash transaction workflow",
    adjusting([
      {
        account: (
          await sql(
            `select ledger_account_id from cash_accounts where id='${cash}'`,
          )
        ).rows[0].ledger_account_id,
        debit: 25,
      },
      { account: equity, credit: 25 },
    ]),
    /CONTROL_ACCOUNT_REQUIRES_WORKFLOW/,
  );
  await ok(
    "administrative depreciation respects original cost ceiling",
    async () => {
      await sql(
        `update assets set cost=12000,install_date=current_date-interval '10 years',useful_life_months=24 where id='${a1}'`,
      );
      const r = (
        await sql(`select * from v_asset_depreciation where id='${a1}'`)
      ).rows[0];
      assert.equal(Number(r.monthly_depreciation), 500);
      assert.equal(Number(r.accumulated_depreciation), 12000);
    },
  );
  await rejects(
    "asset with active lease cannot be retired",
    `update assets set status='retired' where id='${a1}'`,
    /ASSET_HAS_ACTIVE_LEASES/,
  );
  await ok(
    "cancelling a contract releases its active asset reservations and records reason",
    async () => {
      await sql(
        `select cancel_customer_contract('${contract}','Customer approved cancellation')`,
      );
      assert.equal(
        (
          await sql(
            `select * from contract_lines where contract_id='${contract}' and status='active'`,
          )
        ).rows.length,
        0,
      );
      assert.equal(
        (
          await sql(
            `select status from customer_contracts where id='${contract}'`,
          )
        ).rows[0].status,
        "cancelled",
      );
      assert.ok(
        (
          await sql(
            `select * from audit_events where record_id='${contract}' and operation='CANCEL_REASON'`,
          )
        ).rows.length,
      );
    },
  );
  await rejects(
    "cancelled contract cannot gain new scheduled invoice",
    `select schedule_installment('${contract}',null,'${p1}','BAD-CANCELLED',current_date,10)`,
    /INVALID_CONTRACT_INSTALLMENT/,
  );
  await ok("retired asset remains in register with history but leaves operational KPIs and public catalog", async () => {
    const count = Number((await sql("select total_assets from v_kpis")).rows[0].total_assets);
    await sql(`update assets set status='retired',notes='Approved retirement' where id='${a1}'`);
    const row = (await sql(`select * from v_asset_register where id='${a1}'`)).rows[0];
    assert.equal(row.live_status, "retired");
    assert.equal(Number(row.cost), 12000);
    assert.equal(Number((await sql("select total_assets from v_kpis")).rows[0].total_assets), count - 1);
    assert.equal((await sql(`select * from contract_lines where asset_id='${a1}'`)).rows.length > 0, true);
    assert.equal((await sql("select code from public_catalog('a.test') where code='A1'")).rows.length, 0);
  });
  await rejects("retired asset cannot acquire a new reservation", `select create_customer_contract('${p1}','RETIRED',current_date+5,current_date+10,'[{"asset_id":"${a1}","monthly_price":2000}]')`, /ASSET_RETIRED|ASSET_OUT_OF_SCOPE/);
  await rejects("direct reservation writes also enforce retired asset lifecycle", `update contract_lines set status='active' where contract_id='${contract}' and asset_id='${a1}'`, /ASSET_RETIRED/);
  await as(other);
  await ok("asset register does not leak archived assets across tenants", async () => assert.equal((await sql(`select * from v_asset_register where id='${a1}'`)).rows.length, 0));
  await as(null, "anon");
  await rejects("anonymous visitors cannot read asset register", "select * from v_asset_register", /permission denied/);
  await as(inspector);
  await ok("inspector cannot reactivate retired assets", async () => assert.equal((await sql(`update assets set status='active' where id='${a1}' returning id`)).rows.length, 0));
  await as(admin);
  await ok("authorized reactivation restores availability and preserves audit", async () => {
    await sql(`update assets set status='active' where id='${a1}'`);
    assert.equal((await sql(`select live_status from v_asset_register where id='${a1}'`)).rows[0].live_status, "vacant");
    assert.ok((await sql(`select * from audit_events where table_name='assets' and record_id='${a1}' and operation='UPDATE'`)).rows.length >= 2);
    await sql(`select create_customer_contract('${p1}','REACTIVATED',current_date+5,current_date+10,'[{"asset_id":"${a1}","monthly_price":2000}]')`);
  });
  await ok(
    "journal balance remains valid after tax installments and adjustments",
    async () =>
      assert.equal(
        (
          await sql(
            "select entry_id from journal_lines group by entry_id having sum(debit-credit)<>0",
          )
        ).rows.length,
        0,
      ),
  );
}
