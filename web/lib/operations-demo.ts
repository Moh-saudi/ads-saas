import { emptyOperations, type OperationsData } from "./operations-types";
export function operationsDemo(): OperationsData {
  const day = (offset: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  const today = day(0),
    month = today.slice(0, 7) + "-01";
  const employees = [
    {
      id: "e1",
      code: "EMP-001",
      full_name: "محمود علي",
      department: "التشغيل الميداني",
      job_title: "فني تركيب",
      district_id: "d1",
      status: "active",
      phone: "01000000001",
      email: "field@example.com",
      hire_date: "2025-03-01",
      base_salary: 9000,
      profile_id: "user1",
    },
    {
      id: "e2",
      code: "EMP-002",
      full_name: "سارة أحمد",
      department: "الحسابات",
      job_title: "محاسب",
      district_id: "d1",
      status: "active",
      phone: "01000000002",
      email: "finance@example.com",
      hire_date: "2025-07-01",
      base_salary: 12000,
      profile_id: "user2",
    },
    {
      id: "e3",
      code: "EMP-003",
      full_name: "حسن محمد",
      department: "المخازن",
      job_title: "أمين مخزن",
      district_id: "d2",
      status: "active",
      phone: "01000000003",
      email: null,
      hire_date: "2026-01-01",
      base_salary: 8500,
      profile_id: "user3",
    },
  ];
  const accounts = [
    ["1000", "الخزينة النقدية", "asset"],
    ["1010", "الحساب البنكي", "asset"],
    ["1100", "ذمم المعلنين", "asset"],
    ["1400", "مخزون المعدات", "asset"],
    ["2000", "ذمم الموردين", "liability"],
    ["2100", "رواتب مستحقة", "liability"],
    ["3000", "حقوق الملكية", "equity"],
    ["4000", "إيراد الإعلانات", "revenue"],
    ["5000", "مصروفات تشغيلية", "expense"],
    ["5100", "مصروف الرواتب", "expense"],
    ["5200", "مصروف الصيانة", "expense"],
  ].map(([code, name, kind]) => ({
    id: `gl${code}`,
    code,
    name,
    kind,
    active: true,
  }));
  const cashTransactions: OperationsData["cashTransactions"] = [];
  for (let m = 5; m >= 0; m--) {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - m, 1);
    const date = d.toISOString().slice(0, 10);
    const add = (kind: string, amount: number, category: string, n: number) =>
      cashTransactions.push({
        id: `tx${m}-${n}`,
        ref_no: `CS-${m}${n}`,
        cash_account_id: "cash1",
        target_cash_account_id: null,
        kind,
        category_account_id: category,
        amount,
        transaction_date: date,
        description:
          kind === "receipt"
            ? "تحصيل إيجارات المعلنين"
            : kind === "salary"
              ? "صرف رواتب الفريق"
              : "مصروف تشغيل وتركيب",
        asset_id: kind === "expense" ? "a0" : null,
        work_order_id: kind === "expense" ? "w1" : null,
      });
    add("receipt", 76000 + (5 - m) * 6500, "gl4000", 1);
    add("expense", 17000 + (m % 3) * 3200, "gl5000", 2);
    add("salary", 29500, "gl5100", 3);
    add("expense", 3500 + (m % 2) * 1700, "gl5200", 4);
  }
  const cashflow = Array.from(
    new Set(cashTransactions.map((t) => t.transaction_date.slice(0, 7))),
  )
    .sort()
    .map((m) => ({
      month: m + "-01",
      income: cashTransactions
        .filter((t) => t.transaction_date.startsWith(m) && t.kind === "receipt")
        .reduce((s, t) => s + t.amount, 0),
      expense: cashTransactions
        .filter((t) => t.transaction_date.startsWith(m) && t.kind !== "receipt")
        .reduce((s, t) => s + t.amount, 0),
    }));
  const journals = cashTransactions.map((t) => ({
    id: `j${t.id}`,
    ref_no: `GL-${t.ref_no}`,
    entry_date: t.transaction_date,
    description: t.description,
    source_kind: "cash",
  }));
  const journalLines = cashTransactions.flatMap((t) => [
    {
      id: `jl${t.id}a`,
      entry_id: `j${t.id}`,
      account_id: "gl1000",
      debit: t.kind === "receipt" ? t.amount : 0,
      credit: t.kind === "receipt" ? 0 : t.amount,
    },
    {
      id: `jl${t.id}b`,
      entry_id: `j${t.id}`,
      account_id: t.category_account_id!,
      debit: t.kind === "receipt" ? 0 : t.amount,
      credit: t.kind === "receipt" ? t.amount : 0,
    },
  ]);
  const trialBalance = accounts.map((a) => {
    const ls = journalLines.filter((l) => l.account_id === a.id),
      debit = ls.reduce((s, l) => s + l.debit, 0),
      credit = ls.reduce((s, l) => s + l.credit, 0);
    return { ...a, debit, credit, balance: debit - credit };
  });
  return {
    ...emptyOperations,
    tenantUsers: [{id:"demo",full_name:"أحمد محمود",role:"admin"},{id:"user1",full_name:"محمود علي",role:"supervisor"},{id:"user2",full_name:"سارة أحمد",role:"accountant"},{id:"user3",full_name:"حسن محمد",role:"storekeeper"}],
    employees,
    employeeDirectory: employees,
    accounts,
    cashTransactions,
    cashflow,
    journals,
    journalLines,
    trialBalance,
    installments: [
      {id:"ins2",customer_contract_id:null,upstream_contract_id:"u1",party_id:"authority1",ref_no:"UP-INST-001",due_date:day(20),amount:39600,invoice_id:null},
      {
        id: "ins1",
        customer_contract_id: "c1",
        upstream_contract_id: null,
        party_id: "p1",
        ref_no: "INST-001",
        due_date: day(10),
        amount: 27000,
        invoice_id: null,
      },
    ],
    contractLines: [
      {
        id: "cl1",
        contract_id: "c1",
        asset_id: "a4",
        start_date: day(-60),
        end_date: day(25),
        monthly_price: 5500,
        status: "active",
      },
      {
        id: "cl2",
        contract_id: "c2",
        asset_id: "a8",
        start_date: day(-15),
        end_date: day(120),
        monthly_price: 6500,
        status: "active",
      },
    ],
    cashAccounts: [
      {
        id: "cash1",
        name: "الخزينة الرئيسية",
        kind: "cash",
        ledger_account_id: "gl1000",
        balance: trialBalance.find((a) => a.code === "1000")!.balance,
        allow_overdraft: false,
      },
      {
        id: "cash2",
        name: "حساب البنك",
        kind: "bank",
        ledger_account_id: "gl1010",
        balance: 0,
        allow_overdraft: false,
      },
    ],
    attendance: employees.map((e, i) => ({
      id: `att${i}`,
      employee_id: e.id,
      work_date: today,
      check_in: today + `T0${6 + i}:00:00Z`,
      check_out: i === 2 ? null : today + "T14:00:00Z",
      notes: null,
    })),
    leaves: [
      {
        id: "leave1",
        employee_id: "e1",
        start_date: day(4),
        end_date: day(6),
        kind: "annual",
        reason: "إجازة شخصية",
        status: "pending",
        decision_note: null,
      },
    ],
    warehouses: [
      {
        id: "wh1",
        code: "WH-01",
        name: "مخزن التجمع",
        district_id: "d1",
        address: "التجمع الخامس",
        active: true,
      },
      {
        id: "wh2",
        code: "WH-02",
        name: "مخزن الشروق",
        district_id: "d2",
        address: "مدينة الشروق",
        active: true,
      },
    ],
    items: [
      {
        id: "it1",
        sku: "ST-001",
        name: "حامل لافتة مجلفن",
        unit: "قطعة",
        reorder_level: 10,
        active: true,
      },
      {
        id: "it2",
        sku: "ST-002",
        name: "بنر مطبوع",
        unit: "متر مربع",
        reorder_level: 30,
        active: true,
      },
      {
        id: "it3",
        sku: "ST-003",
        name: "كشاف LED",
        unit: "قطعة",
        reorder_level: 5,
        active: true,
      },
    ],
    stockBalances: [
      {
        item_id: "it1",
        warehouse_id: "wh1",
        item_name: "حامل لافتة مجلفن",
        warehouse_name: "مخزن التجمع",
        sku: "ST-001",
        unit: "قطعة",
        quantity: 42,
        average_cost: 650,
        inventory_value: 27300,
        reorder_level: 10,
        low_stock: false,
      },
      {
        item_id: "it2",
        warehouse_id: "wh1",
        item_name: "بنر مطبوع",
        warehouse_name: "مخزن التجمع",
        sku: "ST-002",
        unit: "متر مربع",
        quantity: 24,
        average_cost: 180,
        inventory_value: 4320,
        reorder_level: 30,
        low_stock: true,
      },
      {
        item_id: "it3",
        warehouse_id: "wh2",
        item_name: "كشاف LED",
        warehouse_name: "مخزن الشروق",
        sku: "ST-003",
        unit: "قطعة",
        quantity: 18,
        average_cost: 400,
        inventory_value: 7200,
        reorder_level: 5,
        low_stock: false,
      },
    ],
    stockMoves: [
      {id:"sm3",ref_no:"ST-IN-002",item_id:"it2",from_warehouse_id:null,to_warehouse_id:"wh1",quantity:24,unit_cost:180,kind:"receipt",asset_id:null,work_order_id:null,notes:"استلام بنر مطبوع",created_at:day(-5)+"T08:00:00Z",return_of:null},
      {id:"sm4",ref_no:"ST-IN-003",item_id:"it3",from_warehouse_id:null,to_warehouse_id:"wh2",quantity:20,unit_cost:400,kind:"receipt",asset_id:null,work_order_id:null,notes:"استلام كشافات",created_at:day(-5)+"T08:00:00Z",return_of:null},
      {id:"sm5",ref_no:"ST-OUT-002",item_id:"it3",from_warehouse_id:"wh2",to_warehouse_id:null,quantity:2,unit_cost:400,kind:"issue",asset_id:"a8",work_order_id:"w3",notes:"تركيب إضاءة الحملة",created_at:day(-2)+"T08:00:00Z",return_of:null},
      {
        id: "sm1",
        ref_no: "ST-IN-001",
        item_id: "it1",
        from_warehouse_id: null,
        to_warehouse_id: "wh1",
        quantity: 50,
        unit_cost: 650,
        kind: "receipt",
        asset_id: null,
        work_order_id: null,
        notes: "استلام دفعة حوامل",
        created_at: day(-3) + "T08:00:00Z",
        return_of: null,
      },
      {
        id: "sm2",
        ref_no: "ST-OUT-001",
        item_id: "it1",
        from_warehouse_id: "wh1",
        to_warehouse_id: null,
        quantity: 8,
        unit_cost: 650,
        kind: "issue",
        asset_id: "a0",
        work_order_id: "w1",
        notes: "صرف لتركيب حوامل",
        created_at: day(-1) + "T08:00:00Z",
        return_of: null,
      },
    ],
    purchases: [
      {id:"po2",ref_no:"PO-002",supplier_id:"supplier1",warehouse_id:"wh2",ordered_on:day(-8),expected_on:day(-5),status:"received",notes:"استلمت كشافات إضاءة الحملة"},
      {
        id: "po1",
        ref_no: "PO-001",
        supplier_id: "supplier1",
        warehouse_id: "wh1",
        ordered_on: day(-2),
        expected_on: day(3),
        status: "ordered",
        notes: "توريد حوامل وكشافات",
      },
    ],
    purchaseLines: [
      {id:"pl3",purchase_id:"po2",item_id:"it3",quantity:20,unit_cost:400},
      {
        id: "pl1",
        purchase_id: "po1",
        item_id: "it1",
        quantity: 30,
        unit_cost: 650,
      },
      {
        id: "pl2",
        purchase_id: "po1",
        item_id: "it3",
        quantity: 10,
        unit_cost: 400,
      },
    ],
    workOrders: [
      {id:"w3",ref_no:"WO-003",asset_id:"a8",title:"تركيب خامة حملة آفاق وإضاءتها",description:"تركيب كشافين وفحص الإضاءة",assigned_employee_id:"e1",priority:"normal",status:"completed",due_date:day(-2),completed_at:day(-2)+"T14:00:00Z",resolution:"تم التركيب وفحص الإضاءة وتسليم الموقع"},
      {
        id: "w1",
        ref_no: "WO-001",
        asset_id: "a0",
        title: "استبدال حامل وإعادة تثبيت اللافتة",
        description: "فحص التثبيت ومعالجة نقاط الصدأ",
        assigned_employee_id: "e1",
        priority: "high",
        status: "in_progress",
        due_date: day(2),
        completed_at: null,
        resolution: null,
      },
      {
        id: "w2",
        ref_no: "WO-002",
        asset_id: "a3",
        title: "صيانة الإضاءة",
        description: "تغيير وحدة LED",
        assigned_employee_id: "e1",
        priority: "normal",
        status: "assigned",
        due_date: day(5),
        completed_at: null,
        resolution: null,
      },
    ],
    inspections: [
      {
        id: "check1",
        asset_id: "a0",
        condition: "needs_maintenance",
        method: "qr",
        tag_uid: "MD-0101-QR",
        notes: "الحامل يحتاج إعادة تثبيت",
        checked_at: day(-1) + "T10:00:00Z",
        inspector_id: "demo",
      },
    ],
    payroll: employees.map((e, i) => ({
      id: `pay${i}`,
      employee_id: e.id,
      period: month,
      base_amount: e.base_salary,
      bonus: i === 0 ? 500 : 0,
      deductions: 0,
      net_amount: e.base_salary + (i === 0 ? 500 : 0),
      status: i === 0 ? "draft" : i === 1 ? "approved" : "paid",
      notes: null,
      paid_on: i === 2 ? today : null,
    })),
    enquiries: [
      {id:"lead2",full_name:"شركة النخبة — مثال",phone:"01100000000",email:"elite@example.com",message:"طلب حملة على طريق السويس لمدة شهرين",asset_code:"MD-0109",status:"contacted",notes:"تم التواصل لإعداد العرض",created_at:day(-2)+"T09:00:00Z"},
      {
        id: "lead1",
        full_name: "عميل تجريبي",
        phone: "01000000000",
        email: "lead@example.com",
        message: "نرغب في عرض سعر لحملة لمدة ثلاثة أشهر بالتجمع الخامس.",
        asset_code: "MD-0101",
        status: "new",
        notes: null,
        created_at: today + "T09:00:00Z",
      },
    ],
    reminders: [
      {
        id: "rem1",
        contract_id: "c1",
        party_id: "p1",
        days_before: 30,
        renewal_date: day(30),
        status: "pending",
        provider_message_id: null,
        last_error: null,
        created_at: today + "T08:00:00Z",
      },
    ],
    audit: [
      {id:"aud2",actor_id:"user1",table_name:"assets",record_id:"a8",operation:"ASSET_LOCATION",created_at:day(-2)+"T10:00:00Z",changes:{reason:"تأكيد نقطة التركيب الميداني",after:{latitude:30.051,longitude:31.458}}},
      {
        id: "aud1",
        actor_id: "demo",
        table_name: "work_orders",
        record_id: "w1",
        operation: "UPDATE",
        created_at: today + "T10:00:00Z",
        changes: { status: "in_progress" },
      },
    ],
    assetTags: [
      {
        id: "tag1",
        asset_id: "a0",
        kind: "qr",
        uid: "MD-0101-QR",
        active: true,
      },
    ],
  };
}
