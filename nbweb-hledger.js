// NbWeb-hledger — plain-text accounting with domain knowledge
// Chart of accounts wizard, Canadian tax mappings, journal health, account autocomplete.
// AGPL v3 — https://github.com/linuxcaffe/nbweb-hledger
(() => {

// ── Utilities ────────────────────────────────────────────────────────────────

function _esc(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Province configuration ────────────────────────────────────────────────────

const _PROVINCES = {
    AB: { label: 'Alberta',           regime: 'gst',     gst: 5,   pst: 0,    hst: 0    },
    BC: { label: 'British Columbia',  regime: 'gst_pst', gst: 5,   pst: 7,    hst: 0    },
    MB: { label: 'Manitoba',          regime: 'gst_pst', gst: 5,   pst: 7,    hst: 0    },
    NB: { label: 'New Brunswick',     regime: 'hst',     gst: 0,   pst: 0,    hst: 15   },
    NL: { label: 'Newfoundland',      regime: 'hst',     gst: 0,   pst: 0,    hst: 15   },
    NS: { label: 'Nova Scotia',       regime: 'hst',     gst: 0,   pst: 0,    hst: 15   },
    NT: { label: 'Northwest Terr.',   regime: 'gst',     gst: 5,   pst: 0,    hst: 0    },
    NU: { label: 'Nunavut',           regime: 'gst',     gst: 5,   pst: 0,    hst: 0    },
    ON: { label: 'Ontario',           regime: 'hst',     gst: 0,   pst: 0,    hst: 13   },
    PE: { label: 'PEI',               regime: 'hst',     gst: 0,   pst: 0,    hst: 15   },
    QC: { label: 'Quebec',            regime: 'gst_qst', gst: 5,   pst: 0,    hst: 0,   qst: 9.975 },
    SK: { label: 'Saskatchewan',      regime: 'gst_pst', gst: 5,   pst: 6,    hst: 0    },
    YT: { label: 'Yukon',             regime: 'gst',     gst: 5,   pst: 0,    hst: 0    },
};

// ── Chart of accounts domain packs ───────────────────────────────────────────

function _personalAccounts(opts, province) {
    const prov = _PROVINCES[province] || _PROVINCES.BC;
    const a = [];

    // Assets
    a.push({ account: 'Assets', type: 'asset' });
    if (opts.chequing)
        a.push({ account: 'Assets:Bank:Chequing', type: 'asset',
                 desc: 'Day-to-day chequing account' });
    if (opts.savings)
        a.push({ account: 'Assets:Bank:Savings', type: 'asset',
                 desc: 'High-interest savings' });
    a.push({ account: 'Assets:Cash', type: 'asset',
             desc: 'Physical cash on hand' });
    if (opts.tfsa)
        a.push({ account: 'Assets:Investments:TFSA', type: 'asset',
                 desc: 'Tax-Free Savings Account — contributions after-tax, growth and withdrawals tax-free' });
    if (opts.rrsp)
        a.push({ account: 'Assets:Investments:RRSP', type: 'asset',
                 desc: 'Registered Retirement Savings Plan — contributions tax-deductible, withdrawals taxable income' });
    if (opts.fhsa)
        a.push({ account: 'Assets:Investments:FHSA', type: 'asset',
                 desc: 'First Home Savings Account — tax-deductible contributions, tax-free withdrawal for first home purchase' });
    if (opts.investments)
        a.push({ account: 'Assets:Investments:Taxable', type: 'asset',
                 desc: 'Non-registered investments — capital gains and dividends are taxable' });
    if (opts.mortgage)
        a.push({ account: 'Assets:Property:Home', type: 'asset',
                 desc: 'Fair market value of primary residence (optional, for net worth tracking)' });

    // Liabilities
    a.push({ account: 'Liabilities', type: 'liability' });
    if (opts.credit_card)
        a.push({ account: 'Liabilities:CreditCard', type: 'liability' });
    if (opts.mortgage)
        a.push({ account: 'Liabilities:Loan:Mortgage', type: 'liability',
                 desc: 'Outstanding mortgage principal balance' });
    if (opts.auto_loan)
        a.push({ account: 'Liabilities:Loan:Auto', type: 'liability' });

    // Equity
    a.push({ account: 'Equity', type: 'equity' });
    a.push({ account: 'Equity:OpeningBalances', type: 'equity',
             desc: 'Use once to establish initial balances when starting hledger' });

    // Income
    a.push({ account: 'Income', type: 'income' });
    a.push({ account: 'Income:Employment:Salary',  type: 'income', cra_t1: '10100', cra_label: 'Employment income' });
    a.push({ account: 'Income:Employment:Bonus',   type: 'income', cra_t1: '10100', cra_label: 'Employment income (bonus)' });
    if (opts.investments) {
        a.push({ account: 'Income:Investments:Dividends:Eligible',   type: 'income', cra_t1: '12000', cra_label: 'Taxable amount of eligible dividends' });
        a.push({ account: 'Income:Investments:Dividends:Ineligible', type: 'income', cra_t1: '12010', cra_label: 'Taxable amount of ineligible dividends' });
        a.push({ account: 'Income:Investments:CapitalGains',         type: 'income', cra_t1: '13200', cra_label: 'Taxable capital gains' });
        a.push({ account: 'Income:Investments:Interest',             type: 'income', cra_t1: '12100', cra_label: 'Interest and other investment income' });
    }
    if (opts.rental)
        a.push({ account: 'Income:Rental', type: 'income', cra_t1: '12599', cra_label: 'Gross rental income' });
    a.push({ account: 'Income:Other', type: 'income' });

    // Expenses — Housing
    a.push({ account: 'Expenses', type: 'expense' });
    if (opts.mortgage) {
        a.push({ account: 'Expenses:Housing:Mortgage:Interest',   type: 'expense',
                 desc: 'Interest portion of mortgage payment' });
        a.push({ account: 'Expenses:Housing:Mortgage:Principal',  type: 'expense',
                 desc: 'Principal repayment — not a tax expense; reduces Liabilities:Loan:Mortgage' });
    } else {
        a.push({ account: 'Expenses:Housing:Rent', type: 'expense' });
    }
    a.push({ account: 'Expenses:Housing:Strata',            type: 'expense' });
    a.push({ account: 'Expenses:Housing:Utilities:Hydro',   type: 'expense' });
    a.push({ account: 'Expenses:Housing:Utilities:Gas',     type: 'expense' });
    a.push({ account: 'Expenses:Housing:Utilities:Internet',type: 'expense' });
    a.push({ account: 'Expenses:Housing:Utilities:Phone',   type: 'expense' });
    a.push({ account: 'Expenses:Housing:Maintenance',       type: 'expense' });
    a.push({ account: 'Expenses:Housing:Insurance',         type: 'expense' });
    a.push({ account: 'Expenses:Housing:PropertyTax',       type: 'expense' });

    // Food, transport, health, personal
    a.push({ account: 'Expenses:Food:Groceries',         type: 'expense' });
    a.push({ account: 'Expenses:Food:Dining',            type: 'expense' });
    a.push({ account: 'Expenses:Transport:Fuel',         type: 'expense' });
    a.push({ account: 'Expenses:Transport:Insurance',    type: 'expense' });
    a.push({ account: 'Expenses:Transport:Maintenance',  type: 'expense' });
    a.push({ account: 'Expenses:Transport:Transit',      type: 'expense' });
    a.push({ account: 'Expenses:Health:Insurance',       type: 'expense' });
    a.push({ account: 'Expenses:Health:Dental',          type: 'expense' });
    a.push({ account: 'Expenses:Health:Prescriptions',   type: 'expense' });
    a.push({ account: 'Expenses:Health:Fitness',         type: 'expense' });
    a.push({ account: 'Expenses:Personal:Clothing',      type: 'expense' });
    a.push({ account: 'Expenses:Personal:Grooming',      type: 'expense' });
    a.push({ account: 'Expenses:Entertainment:Streaming',type: 'expense' });
    a.push({ account: 'Expenses:Entertainment:Events',   type: 'expense' });
    a.push({ account: 'Expenses:Entertainment:Hobbies',  type: 'expense' });
    a.push({ account: 'Expenses:Education:Tuition',      type: 'expense', cra_t1: '32300', cra_label: 'Tuition fees' });
    a.push({ account: 'Expenses:Education:Books',        type: 'expense' });
    a.push({ account: 'Expenses:Childcare',              type: 'expense', cra_t1: '21400', cra_label: 'Child care expenses' });
    a.push({ account: 'Expenses:Gifts:Charitable',       type: 'expense', cra_t1: '34900', cra_label: 'Donations and gifts' });
    a.push({ account: 'Expenses:Gifts:Personal',         type: 'expense' });

    // Taxes
    a.push({ account: 'Expenses:Taxes:Federal',   type: 'expense' });
    a.push({ account: 'Expenses:Taxes:Provincial', type: 'expense' });
    a.push({ account: 'Expenses:Taxes:CPP',        type: 'expense', cra_t1: '30800', cra_label: 'CPP or QPP contributions through employment' });
    a.push({ account: 'Expenses:Taxes:EI',         type: 'expense', cra_t1: '31200', cra_label: 'Employment insurance premiums' });

    a.push({ account: 'Expenses:Banking:Fees',   type: 'expense' });
    a.push({ account: 'Expenses:Subscriptions',  type: 'expense' });
    a.push({ account: 'Expenses:Uncategorised',  type: 'expense',
             desc: 'Temporary holding account — review and re-categorise monthly, should always net zero at close' });

    return a;
}

function _smallbizAccounts(opts, province) {
    const prov = _PROVINCES[province] || _PROVINCES.BC;
    const a = [];

    // Assets
    a.push({ account: 'Assets', type: 'asset' });
    a.push({ account: 'Assets:Bank:Business:Chequing', type: 'asset',
             desc: 'Primary business chequing — keep separate from personal' });
    if (opts.savings)
        a.push({ account: 'Assets:Bank:Business:Savings', type: 'asset' });
    a.push({ account: 'Assets:AccountsReceivable', type: 'asset',
             desc: 'Amounts owed by clients — invoice date, not payment date' });
    if (opts.petty_cash)
        a.push({ account: 'Assets:PettyCash', type: 'asset' });

    // Tax asset accounts — regime-dependent
    if (prov.regime === 'hst') {
        a.push({ account: 'Assets:HST:InputTaxCredits', type: 'asset',
                 desc: `HST paid on business purchases (ITCs) — ${prov.hst}% in ${_PROVINCES[province]?.label || province}` });
    } else if (prov.regime === 'gst_pst') {
        a.push({ account: 'Assets:GST:InputTaxCredits', type: 'asset',
                 desc: 'GST paid on business purchases (ITCs) — 5% federal, recoverable' });
        a.push({ account: 'Assets:PST:Paid', type: 'asset',
                 desc: `PST paid on purchases — ${prov.pst}% in ${_PROVINCES[province]?.label || province}. NOT recoverable — expense it here` });
    } else if (prov.regime === 'gst_qst') {
        a.push({ account: 'Assets:GST:InputTaxCredits', type: 'asset', desc: 'GST ITCs — 5% federal' });
        a.push({ account: 'Assets:QST:InputTaxCredits', type: 'asset', desc: 'QST ITCs — 9.975% Quebec' });
    } else {
        a.push({ account: 'Assets:GST:InputTaxCredits', type: 'asset', desc: 'GST paid on business purchases (ITCs) — 5% federal' });
    }

    // Liabilities
    a.push({ account: 'Liabilities', type: 'liability' });
    a.push({ account: 'Liabilities:AccountsPayable', type: 'liability',
             desc: 'Amounts owed to suppliers — invoice date, not payment date' });
    if (opts.credit_card)
        a.push({ account: 'Liabilities:CreditCard:Business', type: 'liability' });
    if (opts.line_of_credit)
        a.push({ account: 'Liabilities:Loan:BusinessLine', type: 'liability' });
    a.push({ account: 'Liabilities:DeferredRevenue', type: 'liability',
             desc: 'Pre-payments received for work not yet delivered' });

    // Tax liability accounts — regime-dependent
    if (prov.regime === 'hst') {
        a.push({ account: 'Liabilities:HST:Collected', type: 'liability',
                 desc: `HST collected from clients — ${prov.hst}%. Remit quarterly or annually to CRA` });
        a.push({ account: 'Liabilities:HST:Owing', type: 'liability',
                 desc: 'Net HST remittance = HST:Collected minus Assets:HST:InputTaxCredits' });
    } else if (prov.regime === 'gst_pst') {
        a.push({ account: 'Liabilities:GST:Collected', type: 'liability', desc: 'GST collected from clients — 5%' });
        a.push({ account: 'Liabilities:GST:Owing',     type: 'liability', desc: 'Net GST = Collected minus ITCs. Remit to CRA' });
    } else if (prov.regime === 'gst_qst') {
        a.push({ account: 'Liabilities:GST:Collected', type: 'liability', desc: 'GST collected — 5%' });
        a.push({ account: 'Liabilities:GST:Owing',     type: 'liability' });
        a.push({ account: 'Liabilities:QST:Collected', type: 'liability', desc: 'QST collected — 9.975%' });
        a.push({ account: 'Liabilities:QST:Owing',     type: 'liability' });
    } else {
        a.push({ account: 'Liabilities:GST:Collected', type: 'liability', desc: 'GST collected — 5%' });
        a.push({ account: 'Liabilities:GST:Owing',     type: 'liability' });
    }

    // Equity
    a.push({ account: 'Equity', type: 'equity' });
    a.push({ account: 'Equity:Owner:Equity',    type: 'equity' });
    a.push({ account: 'Equity:Owner:Draws',     type: 'equity',
             desc: 'Owner withdrawals — not an expense, reduces equity' });
    a.push({ account: 'Equity:RetainedEarnings',type: 'equity' });
    a.push({ account: 'Equity:OpeningBalances', type: 'equity' });

    // Income
    a.push({ account: 'Income', type: 'income' });
    a.push({ account: 'Income:Services:Consulting', type: 'income', cra_t2125: '8000', cra_label: 'Gross professional fees' });
    if (opts.retainer)
        a.push({ account: 'Income:Services:Retainer', type: 'income', cra_t2125: '8000' });
    if (opts.products)
        a.push({ account: 'Income:Products:Sales', type: 'income', cra_t2125: '8000', cra_label: 'Gross sales' });
    a.push({ account: 'Income:Reimbursements', type: 'income',
             desc: 'Expense pass-through billed to clients — not revenue, nets to zero' });

    // Expenses
    a.push({ account: 'Expenses', type: 'expense' });
    a.push({ account: 'Expenses:Professional:Legal',       type: 'expense', cra_t2125: '8860', cra_label: 'Legal, accounting, other professional fees' });
    a.push({ account: 'Expenses:Professional:Accounting',  type: 'expense', cra_t2125: '8860' });
    a.push({ account: 'Expenses:Professional:Contractors', type: 'expense', cra_t2125: '8860' });
    a.push({ account: 'Expenses:Office:Supplies',          type: 'expense', cra_t2125: '8810', cra_label: 'Office expenses' });
    a.push({ account: 'Expenses:Software:Subscriptions',   type: 'expense', cra_t2125: '8810' });
    a.push({ account: 'Expenses:Software:Licences',        type: 'expense', cra_t2125: '8810' });
    a.push({ account: 'Expenses:Marketing:Advertising',    type: 'expense', cra_t2125: '8520', cra_label: 'Advertising' });
    a.push({ account: 'Expenses:Marketing:WebHosting',     type: 'expense', cra_t2125: '8810' });
    a.push({ account: 'Expenses:Meals:Entertainment',      type: 'expense', cra_t2125: '8523',
             desc: 'Meals and entertainment — track gross amount; CRA allows 50% deduction. Do NOT net it here.' });
    a.push({ account: 'Expenses:Travel:Accommodation',     type: 'expense', cra_t2125: '9270', cra_label: 'Travel expenses' });
    a.push({ account: 'Expenses:Travel:Airfare',           type: 'expense', cra_t2125: '9270' });
    a.push({ account: 'Expenses:Travel:Meals',             type: 'expense', cra_t2125: '9270',
             desc: 'Meals while travelling — 50% deductible, same as Entertainment:Meals' });
    if (opts.home_office) {
        a.push({ account: 'Expenses:HomeOffice:Utilities', type: 'expense', cra_t2125: '9220', cra_label: 'Business-use-of-home expenses' });
        a.push({ account: 'Expenses:HomeOffice:Internet',  type: 'expense', cra_t2125: '9220' });
        a.push({ account: 'Expenses:HomeOffice:Rent',      type: 'expense', cra_t2125: '9220' });
    }
    if (opts.auto) {
        a.push({ account: 'Expenses:Auto:Fuel',         type: 'expense', cra_t2125: '9281', cra_label: 'Motor vehicle expenses' });
        a.push({ account: 'Expenses:Auto:Insurance',    type: 'expense', cra_t2125: '9281' });
        a.push({ account: 'Expenses:Auto:Maintenance',  type: 'expense', cra_t2125: '9281',
                 desc: 'Track business-use percentage separately; apply to all auto accounts at year end' });
    }
    if (opts.payroll) {
        a.push({ account: 'Expenses:Wages:Gross',        type: 'expense', cra_t2125: '9060', cra_label: 'Salaries, wages, benefits' });
        a.push({ account: 'Expenses:Wages:CPP:Employer', type: 'expense', cra_t2125: '9060' });
        a.push({ account: 'Expenses:Wages:EI:Employer',  type: 'expense', cra_t2125: '9060' });
    }
    if (opts.cca) {
        a.push({ account: 'Expenses:CCA:Class8',  type: 'expense', cra_t2125: '9936',
                 desc: 'CCA Class 8 — office furniture & equipment (20% declining balance)' });
        a.push({ account: 'Expenses:CCA:Class10', type: 'expense', cra_t2125: '9936',
                 desc: 'CCA Class 10 — automotive (30% declining balance)' });
        a.push({ account: 'Expenses:CCA:Class50', type: 'expense', cra_t2125: '9936',
                 desc: 'CCA Class 50 — computer hardware post-2018 (55% declining balance)' });
    }
    a.push({ account: 'Expenses:Banking:Fees',  type: 'expense', cra_t2125: '8710', cra_label: 'Interest and bank charges' });
    a.push({ account: 'Expenses:Uncategorised', type: 'expense',
             desc: 'Temporary — should net zero after monthly review' });

    return a;
}

// ── Personal annex (shared by Service and Sales) ─────────────────────────────

function _personalAnnexAccounts(opts) {
    const a = [];
    a.push({ account: 'Assets:Bank:Personal:Chequing', type: 'asset',
             desc: 'Personal chequing — receives Owner:Draws from business' });
    if (opts.savings)
        a.push({ account: 'Assets:Bank:Personal:Savings', type: 'asset' });
    if (opts.rrsp)
        a.push({ account: 'Assets:Investments:RRSP', type: 'asset',
                 desc: 'RRSP — contributions reduce T1 taxable income; withdrawals are income' });
    if (opts.tfsa)
        a.push({ account: 'Assets:Investments:TFSA', type: 'asset',
                 desc: 'TFSA — after-tax contributions; growth and withdrawals tax-free' });
    if (opts.fhsa)
        a.push({ account: 'Assets:Investments:FHSA', type: 'asset',
                 desc: 'FHSA — tax-deductible contributions; tax-free withdrawal for first home' });
    if (opts.charitable)
        a.push({ account: 'Expenses:Personal:Charitable', type: 'expense',
                 cra_t1: '34900', cra_label: 'Donations and gifts' });
    if (opts.medical)
        a.push({ account: 'Expenses:Personal:Medical', type: 'expense',
                 cra_t1: '33099', cra_label: 'Medical expenses' });
    if (opts.childcare)
        a.push({ account: 'Expenses:Personal:Childcare', type: 'expense',
                 cra_t1: '21400', cra_label: 'Child care expenses' });
    a.push({ account: 'Expenses:Taxes:CPP:SelfEmployed', type: 'expense',
             cra_t1: '31000', cra_label: 'CPP contributions on self-employment income — both halves' });
    a.push({ account: 'Expenses:Taxes:IncomeTax:Installments', type: 'expense',
             desc: 'Quarterly income tax installments — not deductible; tracked for T1 reconciliation' });
    return a;
}

// ── Service pack — Independent Contractor ────────────────────────────────────

function _serviceAccounts(opts, province) {
    const prov = _PROVINCES[province] || _PROVINCES.BC;
    const a = [];

    // Assets
    a.push({ account: 'Assets', type: 'asset' });
    a.push({ account: 'Assets:Bank:Business:Chequing', type: 'asset',
             desc: 'Primary business chequing — keep separate from personal' });
    if (opts.savings)
        a.push({ account: 'Assets:Bank:Business:Savings', type: 'asset' });
    a.push({ account: 'Assets:AccountsReceivable', type: 'asset',
             desc: 'Amounts invoiced but not yet paid — invoice date, not payment date' });
    if (opts.wip)
        a.push({ account: 'Assets:WIP', type: 'asset',
                 desc: 'Billable work completed but not yet invoiced — clears when invoice is raised' });

    if (prov.regime === 'hst')
        a.push({ account: 'Assets:HST:InputTaxCredits', type: 'asset',
                 desc: `HST paid on business purchases (ITCs) — ${prov.hst}%` });
    else if (prov.regime === 'gst_pst') {
        a.push({ account: 'Assets:GST:InputTaxCredits', type: 'asset', desc: 'GST ITCs — 5% federal' });
        a.push({ account: 'Assets:PST:Paid', type: 'asset',
                 desc: `PST paid — ${prov.pst}%. NOT recoverable — expense it here` });
    } else if (prov.regime === 'gst_qst') {
        a.push({ account: 'Assets:GST:InputTaxCredits', type: 'asset', desc: 'GST ITCs — 5%' });
        a.push({ account: 'Assets:QST:InputTaxCredits', type: 'asset', desc: 'QST ITCs — 9.975%' });
    } else {
        a.push({ account: 'Assets:GST:InputTaxCredits', type: 'asset', desc: 'GST ITCs — 5% federal' });
    }

    // Liabilities
    a.push({ account: 'Liabilities', type: 'liability' });
    a.push({ account: 'Liabilities:AccountsPayable', type: 'liability' });
    if (opts.credit_card)
        a.push({ account: 'Liabilities:CreditCard:Business', type: 'liability' });
    if (opts.retainer)
        a.push({ account: 'Liabilities:DeferredRevenue:Retainer', type: 'liability',
                 desc: 'Retainer received but not yet earned — a debt, not income, until work is delivered' });

    if (prov.regime === 'hst') {
        a.push({ account: 'Liabilities:HST:Collected', type: 'liability',
                 desc: `HST collected from clients — ${prov.hst}%. Remit to CRA` });
        a.push({ account: 'Liabilities:HST:Owing', type: 'liability' });
    } else if (prov.regime === 'gst_pst') {
        a.push({ account: 'Liabilities:GST:Collected', type: 'liability', desc: 'GST collected — 5%' });
        a.push({ account: 'Liabilities:GST:Owing', type: 'liability' });
    } else if (prov.regime === 'gst_qst') {
        a.push({ account: 'Liabilities:GST:Collected', type: 'liability', desc: 'GST collected — 5%' });
        a.push({ account: 'Liabilities:GST:Owing', type: 'liability' });
        a.push({ account: 'Liabilities:QST:Collected', type: 'liability', desc: 'QST collected — 9.975%' });
        a.push({ account: 'Liabilities:QST:Owing', type: 'liability' });
    } else {
        a.push({ account: 'Liabilities:GST:Collected', type: 'liability', desc: 'GST collected — 5%' });
        a.push({ account: 'Liabilities:GST:Owing', type: 'liability' });
    }

    // Equity
    a.push({ account: 'Equity', type: 'equity' });
    a.push({ account: 'Equity:Owner:Equity',     type: 'equity' });
    a.push({ account: 'Equity:Owner:Draws',      type: 'equity',
             desc: 'Transfers to personal chequing — not an expense, reduces equity' });
    a.push({ account: 'Equity:RetainedEarnings', type: 'equity' });
    a.push({ account: 'Equity:OpeningBalances',  type: 'equity' });

    // Income
    a.push({ account: 'Income', type: 'income' });
    a.push({ account: 'Income:Services:Hourly',    type: 'income', cra_t2125: '8000', cra_label: 'Gross professional fees' });
    a.push({ account: 'Income:Services:FixedFee',  type: 'income', cra_t2125: '8000' });
    if (opts.retainer)
        a.push({ account: 'Income:Services:Retainer', type: 'income', cra_t2125: '8000',
                 desc: 'Earned portion of retainer — released from Liabilities:DeferredRevenue:Retainer' });
    a.push({ account: 'Income:Services:Consulting', type: 'income', cra_t2125: '8000' });
    a.push({ account: 'Income:Reimbursements', type: 'income',
             desc: 'Expense pass-through billed to clients — not revenue; must net zero at close' });
    a.push({ account: 'Income:Interest', type: 'income' });

    // Expenses
    a.push({ account: 'Expenses', type: 'expense' });
    if (opts.contractors)
        a.push({ account: 'Expenses:Professional:Contractors', type: 'expense',
                 cra_t2125: '8860', cra_label: 'Legal, accounting, other professional fees',
                 desc: 'T4A required for any contractor paid $500+ in the calendar year' });
    a.push({ account: 'Expenses:Professional:Legal',       type: 'expense', cra_t2125: '8860' });
    a.push({ account: 'Expenses:Professional:Accounting',  type: 'expense', cra_t2125: '8860' });
    a.push({ account: 'Expenses:Professional:Insurance:EO', type: 'expense', cra_t2125: '8690',
             cra_label: 'Insurance',
             desc: 'Errors & omissions / professional liability — often required by clients' });
    a.push({ account: 'Expenses:Professional:Dues', type: 'expense', cra_t2125: '8760',
             cra_label: 'Dues and subscriptions',
             desc: 'Professional association memberships, trade licences' });
    a.push({ account: 'Expenses:Office:Supplies',        type: 'expense', cra_t2125: '8810', cra_label: 'Office expenses' });
    a.push({ account: 'Expenses:Software:Subscriptions', type: 'expense', cra_t2125: '8810' });
    a.push({ account: 'Expenses:Software:Licences',      type: 'expense', cra_t2125: '8810' });
    a.push({ account: 'Expenses:Marketing:Advertising',  type: 'expense', cra_t2125: '8520', cra_label: 'Advertising' });
    a.push({ account: 'Expenses:Marketing:WebHosting',   type: 'expense', cra_t2125: '8810' });
    a.push({ account: 'Expenses:Meals:Entertainment', type: 'expense', cra_t2125: '8523',
             desc: 'Track gross amount — CRA allows 50% deduction. Do NOT net it here.' });
    a.push({ account: 'Expenses:Travel:Accommodation',   type: 'expense', cra_t2125: '9270', cra_label: 'Travel expenses' });
    a.push({ account: 'Expenses:Travel:Airfare',         type: 'expense', cra_t2125: '9270' });
    a.push({ account: 'Expenses:Travel:Meals',           type: 'expense', cra_t2125: '9270',
             desc: 'Meals while travelling — 50% deductible, same rule as Entertainment' });
    a.push({ account: 'Expenses:Travel:LocalTransport',  type: 'expense', cra_t2125: '9270' });
    a.push({ account: 'Expenses:Training:Courses', type: 'expense', cra_t2125: '8760',
             desc: 'Professional development — fully deductible when related to current business' });
    a.push({ account: 'Expenses:Training:Books',   type: 'expense', cra_t2125: '8760' });
    if (opts.home_office) {
        a.push({ account: 'Expenses:HomeOffice:Utilities', type: 'expense', cra_t2125: '9220', cra_label: 'Business-use-of-home expenses' });
        a.push({ account: 'Expenses:HomeOffice:Internet',  type: 'expense', cra_t2125: '9220' });
        a.push({ account: 'Expenses:HomeOffice:Rent',      type: 'expense', cra_t2125: '9220',
                 desc: 'Business-use % of rent — calculate at year-end and post adjusting entry' });
    }
    if (opts.auto) {
        a.push({ account: 'Expenses:Auto:Fuel',        type: 'expense', cra_t2125: '9281', cra_label: 'Motor vehicle expenses' });
        a.push({ account: 'Expenses:Auto:Insurance',   type: 'expense', cra_t2125: '9281' });
        a.push({ account: 'Expenses:Auto:Maintenance', type: 'expense', cra_t2125: '9281',
                 desc: 'Track business-use % separately; apply to all auto accounts at year-end' });
    }
    if (opts.cca) {
        a.push({ account: 'Expenses:CCA:Class8',  type: 'expense', cra_t2125: '9936', cra_label: 'CCA',
                 desc: 'Class 8 — office furniture & equipment (20% declining balance)' });
        a.push({ account: 'Expenses:CCA:Class50', type: 'expense', cra_t2125: '9936',
                 desc: 'Class 50 — computer hardware post-2018 (55% declining balance)' });
    }
    a.push({ account: 'Expenses:Banking:Fees',  type: 'expense', cra_t2125: '8710', cra_label: 'Interest and bank charges' });
    a.push({ account: 'Expenses:Uncategorised', type: 'expense',
             desc: 'Temporary — review and re-categorise monthly; must net zero at close' });

    // Personal annex
    if (opts.personal_annex)
        a.push(..._personalAnnexAccounts(opts));

    return a;
}

// ── Sales pack — Resale Shop ──────────────────────────────────────────────────

// Seed facts for known marketplace platforms. Kept as a small hand-maintained
// table (not fetched live) so the wizard has no runtime dependency on a
// specific reference notebook existing — see claude:nbweb-hledger_plugin_design.md
// "Platforms are data, not hardcoded accounts". The human-readable version of
// the same facts, with prose and sourcing, lives in acct_ref:platforms/ — keep
// the two in sync by hand when a platform's policy is re-verified.
const _SALES_KNOWN_PLATFORMS = {
    etsy: {
        label: 'Etsy', account: 'Etsy', platform_category: 'marketplace',
        gst_hst: 'collects-all', cra_seller_info_return: true,
        clearing_account: 'Assets:Payment:Stripe', typical_lag_days: 2,
        last_verified: '2026-07-14',
        source_url: 'https://www.etsy.com/legal/taxes/canada/',
        note: 'Etsy has collected and remitted GST/HST on Canadian marketplace orders since ' +
              'July 1, 2022, on all Canadian orders regardless of the seller’s own registration ' +
              'status. Verify current policy at source_url before relying on this for a real filing.',
    },
    ebay: {
        label: 'eBay', account: 'eBay', platform_category: 'marketplace',
        gst_hst: 'collects-nonregistrant-only', cra_seller_info_return: true,
        clearing_account: 'Assets:Payment:Stripe', typical_lag_days: 2,
        last_verified: '2026-07-14',
        source_url: 'https://www.ebay.ca/help/selling/fees-credits-invoices/taxes-import-charges-sellers?id=4805',
        note: 'Lower confidence than the Etsy seed — eBay’s obligation is generally tied to the ' +
              'seller’s own registration status rather than a blanket policy. Could not confirm ' +
              'eBay’s current seller-facing behaviour directly; verify in eBay’s own seller tax ' +
              'settings before trusting this for a registered seller’s real postings.',
    },
    facebook_marketplace: {
        label: 'Facebook Marketplace', account: 'FacebookMarketplace', platform_category: 'unverified',
        gst_hst: 'unverified', cra_seller_info_return: true,
        clearing_account: '', typical_lag_days: null,
        last_verified: '2026-07-14', source_url: '',
        note: 'Weakest-sourced of the three seeds — no research done on Meta’s GST/HST collection ' +
              'policy. Also structurally different: a lot of Marketplace activity never routes payment ' +
              'through the platform at all (local pickup, cash/e-transfer arranged off-platform), in ' +
              'which case it behaves like an ordinary in-person self-collected sale, not a marketplace one.',
    },
};

// Every selected platform/channel that should get its own Income:Sales:<X> +
// Expenses:Platform:<X> pair — known seeded platforms (checkbox) plus one
// free-text "other" platform. In-person and wholesale are handled separately
// (below) since they're not marketplaces and carry no platform policy.
function _salesPlatformSelections(opts) {
    const selected = [];
    for (const [id, seed] of Object.entries(_SALES_KNOWN_PLATFORMS)) {
        if (opts[id]) selected.push({ id, known: true, ...seed });
    }
    const otherName = String(opts.other_platform_name || '').trim();
    if (otherName)
        selected.push({ id: 'other_platform', known: false, label: otherName,
                         account: otherName.replace(/[^\w]+/g, '') });
    return selected;
}

function _salesAccounts(opts, province) {
    const prov      = _PROVINCES[province] || _PROVINCES.BC;
    const platforms = _salesPlatformSelections(opts);
    const a = [];

    // Assets
    a.push({ account: 'Assets', type: 'asset' });
    a.push({ account: 'Assets:Bank:Business:Chequing', type: 'asset',
             desc: 'Primary business chequing — keep separate from personal' });
    if (opts.savings)
        a.push({ account: 'Assets:Bank:Business:Savings', type: 'asset' });
    a.push({ account: 'Assets:Inventory', type: 'asset',
             desc: 'Sum of cost bases of all unsold items — reduced by COGS on each sale' });
    if (platforms.length)
        a.push({ account: 'Assets:Payment:Stripe', type: 'asset',
                 desc: 'Clearing account — balance should reach zero on each payout (~2 days)' });
    if (opts.paypal)
        a.push({ account: 'Assets:Payment:PayPal', type: 'asset',
                 desc: 'Clearing account — transfer to chequing on each payout' });
    if (opts.etransfer)
        a.push({ account: 'Assets:Payment:ETransfer', type: 'asset' });

    if (prov.regime === 'hst')
        a.push({ account: 'Assets:HST:InputTaxCredits', type: 'asset',
                 desc: `HST paid on business purchases (ITCs) — ${prov.hst}%` });
    else if (prov.regime === 'gst_pst') {
        a.push({ account: 'Assets:GST:InputTaxCredits', type: 'asset', desc: 'GST ITCs — 5% federal' });
        a.push({ account: 'Assets:PST:Paid', type: 'asset',
                 desc: `PST — ${prov.pst}% — on equipment/supplies/other non-resale expenses; ` +
                       `genuinely non-recoverable, gets expensed. NOT the same as PST on inventory ` +
                       `bought for resale, which is normally exempt at source via a resale ` +
                       `certificate/PST vendor permit and shouldn't be paid in the first place.` });
    } else if (prov.regime === 'gst_qst') {
        a.push({ account: 'Assets:GST:InputTaxCredits', type: 'asset', desc: 'GST ITCs — 5%' });
        a.push({ account: 'Assets:QST:InputTaxCredits', type: 'asset', desc: 'QST ITCs — 9.975%' });
    } else {
        a.push({ account: 'Assets:GST:InputTaxCredits', type: 'asset', desc: 'GST ITCs — 5% federal' });
    }

    // Liabilities
    a.push({ account: 'Liabilities', type: 'liability' });
    if (opts.consignment)
        a.push({ account: 'Liabilities:AccountsPayable', type: 'liability',
                 desc: 'Consignment payouts owing to item owners. Tracks the payout only — the ' +
                       'item-ledger acquired/sold automation below assumes owned inventory, so who ' +
                       'owes GST/HST on a consigned sale (shop vs. original owner) needs working out ' +
                       'by hand; see CRA\'s Consigned Goods guidance.' });
    if (opts.credit_card)
        a.push({ account: 'Liabilities:CreditCard:Business', type: 'liability' });
    if (opts.gift_cards)
        a.push({ account: 'Liabilities:GiftCards', type: 'liability',
                 desc: 'Gift cards sold but not yet redeemed — a debt, not income' });

    if (prov.regime === 'hst') {
        a.push({ account: 'Liabilities:HST:Collected', type: 'liability',
                 desc: `HST collected on sales — ${prov.hst}%. Remit to CRA` });
        a.push({ account: 'Liabilities:HST:Owing', type: 'liability' });
    } else if (prov.regime === 'gst_pst') {
        a.push({ account: 'Liabilities:GST:Collected', type: 'liability', desc: 'GST collected — 5%' });
        a.push({ account: 'Liabilities:GST:Owing', type: 'liability' });
    } else if (prov.regime === 'gst_qst') {
        a.push({ account: 'Liabilities:GST:Collected', type: 'liability', desc: 'GST collected — 5%' });
        a.push({ account: 'Liabilities:GST:Owing', type: 'liability' });
        a.push({ account: 'Liabilities:QST:Collected', type: 'liability', desc: 'QST collected — 9.975%' });
        a.push({ account: 'Liabilities:QST:Owing', type: 'liability' });
    } else {
        a.push({ account: 'Liabilities:GST:Collected', type: 'liability', desc: 'GST collected — 5%' });
        a.push({ account: 'Liabilities:GST:Owing', type: 'liability' });
    }

    // Equity
    a.push({ account: 'Equity', type: 'equity' });
    a.push({ account: 'Equity:Owner:Equity',     type: 'equity' });
    a.push({ account: 'Equity:Owner:Draws',      type: 'equity',
             desc: 'Transfers to personal chequing — not an expense, reduces equity' });
    a.push({ account: 'Equity:RetainedEarnings', type: 'equity' });
    a.push({ account: 'Equity:OpeningBalances',  type: 'equity' });

    // Income
    a.push({ account: 'Income', type: 'income' });
    for (const p of platforms) {
        const incomeAcct  = `Income:Sales:${p.account}`;
        const expenseAcct = `Expenses:Platform:${p.account}`;
        const entry = { account: incomeAcct, type: 'income', cra_t2125: '8000', cra_label: 'Gross sales',
                         platform_sibling: expenseAcct };
        if (p.known) {
            Object.assign(entry, {
                platform_category: p.platform_category,
                tax_collection_gst_hst: p.gst_hst,
                cra_seller_info_return: p.cra_seller_info_return,
                payout_clearing_account: p.clearing_account,
                payout_typical_lag_days: p.typical_lag_days,
                last_verified: p.last_verified,
                source_url: p.source_url,
                platform_note: p.note,
            });
        }
        entry.credential_ref = '';   // pointer to an nb-web encrypted note, never a secret itself — fill in by hand
        a.push(entry);
    }
    if (opts.in_person)
        a.push({ account: 'Income:Sales:InPerson', type: 'income', cra_t2125: '8000' });
    if (opts.wholesale)
        a.push({ account: 'Income:Sales:Wholesale', type: 'income', cra_t2125: '8000' });
    if (!platforms.length && !opts.in_person && !opts.wholesale)
        a.push({ account: 'Income:Sales', type: 'income', cra_t2125: '8000', cra_label: 'Gross sales' });
    if (platforms.length)
        a.push({ account: 'Income:Shipping:Recovered', type: 'income',
                 desc: 'Shipping charged to buyer — compare against Expenses:Shipping:Outbound' });
    a.push({ account: 'Income:Reimbursements', type: 'income',
             desc: 'Expense pass-through — must net zero at close' });

    // COGS — its own top-level group for clarity
    a.push({ account: 'Expenses:COGS', type: 'expense', cra_t2125: '8320', cra_label: 'Cost of goods sold',
             desc: 'Cost basis of items sold — posted simultaneously with each sale; offsets Assets:Inventory' });

    // Operating expenses
    a.push({ account: 'Expenses', type: 'expense' });
    if (platforms.length) {
        a.push({ account: 'Expenses:Shipping:Outbound',  type: 'expense', cra_t2125: '8810' });
        a.push({ account: 'Expenses:Shipping:Packaging', type: 'expense', cra_t2125: '8810',
                 desc: 'Boxes, tissue, tape, labels' });
        for (const p of platforms) {
            a.push({ account: `Expenses:Platform:${p.account}`, type: 'expense', cra_t2125: '8520',
                     desc: `${p.label} listing + transaction fees`,
                     platform_sibling: `Income:Sales:${p.account}` });
        }
    }
    if (opts.paypal)
        a.push({ account: 'Expenses:Platform:PayPal', type: 'expense', cra_t2125: '8520' });
    a.push({ account: 'Expenses:Photography',       type: 'expense', cra_t2125: '8810',
             desc: 'Listing photos — CCA Class 50 if a camera was purchased' });
    a.push({ account: 'Expenses:Sourcing:Travel',   type: 'expense', cra_t2125: '9270' });
    a.push({ account: 'Expenses:Sourcing:MarketFees', type: 'expense', cra_t2125: '8810',
             desc: 'Estate sale / market entry and table fees' });
    a.push({ account: 'Expenses:Sourcing:Supplies', type: 'expense', cra_t2125: '8810',
             desc: 'Tags, hangers, display materials' });
    a.push({ account: 'Expenses:Marketing:Advertising',  type: 'expense', cra_t2125: '8520', cra_label: 'Advertising' });
    a.push({ account: 'Expenses:Marketing:WebHosting',   type: 'expense', cra_t2125: '8810' });
    if (opts.storage)
        a.push({ account: 'Expenses:Storage', type: 'expense', cra_t2125: '8810' });
    a.push({ account: 'Expenses:Professional:Accounting', type: 'expense', cra_t2125: '8860', cra_label: 'Legal, accounting, other fees' });
    a.push({ account: 'Expenses:Banking:Fees', type: 'expense', cra_t2125: '8710', cra_label: 'Interest and bank charges' });
    if (opts.cca) {
        a.push({ account: 'Expenses:CCA:Class8',  type: 'expense', cra_t2125: '9936', cra_label: 'CCA',
                 desc: 'Class 8 — display fixtures, shelving (20% declining balance)' });
        a.push({ account: 'Expenses:CCA:Class50', type: 'expense', cra_t2125: '9936',
                 desc: 'Class 50 — computer, camera post-2018 (55% declining balance)' });
    }
    a.push({ account: 'Expenses:Inventory:WriteDown', type: 'expense',
             desc: 'Items donated, discarded, or damaged — reduces Assets:Inventory' });
    a.push({ account: 'Expenses:Uncategorised', type: 'expense',
             desc: 'Temporary — must net zero at close' });

    // Personal annex
    if (opts.personal_annex)
        a.push(..._personalAnnexAccounts(opts));

    return a;
}

const _COA_DOMAINS = {
    personal: {
        label: 'Personal Finance',
        options: [
            { id: 'chequing',    label: 'Chequing account',            default: true  },
            { id: 'savings',     label: 'Savings account',             default: true  },
            { id: 'tfsa',        label: 'TFSA',                        default: false },
            { id: 'rrsp',        label: 'RRSP',                        default: false },
            { id: 'fhsa',        label: 'FHSA (First Home Savings)',   default: false },
            { id: 'investments', label: 'Non-registered investments',  default: false },
            { id: 'credit_card', label: 'Credit card',                 default: false },
            { id: 'mortgage',    label: 'Mortgage',                    default: false },
            { id: 'auto_loan',   label: 'Auto loan',                   default: false },
            { id: 'rental',      label: 'Rental income',               default: false },
        ],
        build: _personalAccounts,
    },
    smallbiz: {
        label: 'Small Business',
        options: [
            { id: 'savings',        label: 'Business savings account',  default: false },
            { id: 'petty_cash',     label: 'Petty cash',                default: false },
            { id: 'credit_card',    label: 'Business credit card',      default: true  },
            { id: 'line_of_credit', label: 'Business line of credit',   default: false },
            { id: 'retainer',       label: 'Retainer income',           default: false },
            { id: 'products',       label: 'Product sales',             default: false },
            { id: 'home_office',    label: 'Home office deduction',     default: false },
            { id: 'auto',           label: 'Business vehicle',          default: false },
            { id: 'payroll',        label: 'Employees / payroll',       default: false },
            { id: 'cca',            label: 'Capital cost allowance',    default: false },
        ],
        build: _smallbizAccounts,
    },
    service: {
        label: 'Service — Independent Contractor',
        options: [
            { id: 'savings',        label: 'Business savings account',  default: false },
            { id: 'credit_card',    label: 'Business credit card',      default: true  },
            { id: 'retainer',       label: 'Retainer income',           default: false },
            { id: 'contractors',    label: 'Subcontractors (T4A)',       default: false },
            { id: 'wip',            label: 'Track WIP',                 default: false },
            { id: 'home_office',    label: 'Home office deduction',     default: false },
            { id: 'auto',           label: 'Business vehicle',          default: false },
            { id: 'cca',            label: 'Capital cost allowance',    default: false },
            { id: 'personal_annex', label: 'Personal annex (T1)',       default: true  },
            { id: 'rrsp',           label: '↳ RRSP',                    default: false },
            { id: 'tfsa',           label: '↳ TFSA',                    default: false },
            { id: 'fhsa',           label: '↳ FHSA',                    default: false },
            { id: 'charitable',     label: '↳ Charitable donations',    default: false },
            { id: 'medical',        label: '↳ Medical expenses',        default: false },
            { id: 'childcare',      label: '↳ Childcare',               default: false },
        ],
        build: _serviceAccounts,
    },
    sales: {
        label: 'Sales — Resale Shop',
        options: [
            { id: 'savings',        label: 'Business savings account',  default: false },
            { id: 'credit_card',    label: 'Business credit card',      default: false },
            { id: 'etsy',                 label: 'Etsy',                                        default: true  },
            { id: 'ebay',                 label: 'eBay',                                        default: false },
            { id: 'facebook_marketplace', label: 'Facebook Marketplace',                        default: false },
            { id: 'other_platform_name',  label: 'Other platform:',  type: 'text',
              placeholder: 'name — blank tax fields, fill in by hand' },
            { id: 'in_person',      label: 'In-person sales (markets)', default: false },
            { id: 'wholesale',      label: 'Wholesale channel',         default: false },
            { id: 'paypal',         label: 'PayPal',                    default: false },
            { id: 'etransfer',      label: 'e-Transfer',                default: false },
            { id: 'consignment',    label: 'Consignment / payouts',     default: false },
            { id: 'gift_cards',     label: 'Gift cards',                default: false },
            { id: 'storage',        label: 'Storage costs',             default: false },
            { id: 'cca',            label: 'Equipment / CCA',           default: false },
            { id: 'personal_annex', label: 'Personal annex (T1)',       default: true  },
            { id: 'rrsp',           label: '↳ RRSP',                    default: false },
            { id: 'tfsa',           label: '↳ TFSA',                    default: false },
            { id: 'fhsa',           label: '↳ FHSA',                    default: false },
            { id: 'charitable',     label: '↳ Charitable donations',    default: false },
            { id: 'medical',        label: '↳ Medical expenses',        default: false },
        ],
        build: _salesAccounts,
    },
};

// ── Account autocomplete ──────────────────────────────────────────────────────

let _accountCache = {};   // notebook → {ts, accounts}

async function _getAccounts(notebook) {
    const now = Date.now();
    const hit = _accountCache[notebook];
    if (hit && now - hit.ts < 60000) return hit.accounts;
    try {
        const d = await fetch(`/api/hledger/accounts?notebook=${encodeURIComponent(notebook)}`).then(r => r.json());
        const accounts = d.accounts || [];
        _accountCache[notebook] = { ts: now, accounts };
        return accounts;
    } catch (_) { return []; }
}

// ── Journal health ────────────────────────────────────────────────────────────

async function _journalHealth(notebook) {
    try {
        const [cfg, stats] = await Promise.all([
            fetch(`/api/hledger/config?notebook=${encodeURIComponent(notebook)}`).then(r => r.json()),
            fetch(`/api/hledger-query?q=${encodeURIComponent(`-f ${notebook} stats`)}`).then(r => r.json()).catch(() => null),
        ]);
        return { config: cfg.config, journal: cfg.journal, journal_ok: cfg.journal_ok, stats };
    } catch (_) { return null; }
}

let _bkPanelMode = localStorage.getItem('nb-hl-panel-mode') || 'bookkeeper';

// ── Account note generation ───────────────────────────────────────────────────

// Slug matching api_create_note: re.sub(r'[^\w]+', '_', title).strip('_').lower()
function _accountSlug(accountPath) {
    return accountPath.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '').toLowerCase();
}

// Returns the {{content}} portion for a single account — desc, parent link, CRA info.
// Does NOT include term: links or codeblocks; those live in the template.
function _accountContent(acct, allAccounts, notebook) {
    const parentPath = acct.account.includes(':')
        ? acct.account.split(':').slice(0, -1).join(':') : null;
    const lines = [];
    if (acct.desc) lines.push(acct.desc, '');
    if (parentPath && notebook) {
        const slug = _accountSlug(parentPath);
        lines.push(`**Parent:** [[${notebook}:accounting/accounts/${slug}.md]]`, '');
    }
    const children = allAccounts.filter(a => {
        if (!a.account.startsWith(acct.account + ':')) return false;
        return !a.account.slice(acct.account.length + 1).includes(':');
    });
    if (children.length && notebook) {
        const links = children.map(c =>
            `[[${notebook}:accounting/accounts/${_accountSlug(c.account)}.md]]`
        ).join(' · ');
        lines.push(`**Sub-accounts:** ${links}`, '');
    }
    if (acct.cra_t1) {
        const url = 'https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package.html';
        const label = acct.cra_label ? ` — ${acct.cra_label}` : '';
        lines.push(`**CRA T1 line ${acct.cra_t1}**${label}`);
        lines.push(`<a href="term:xdg-open ${url}">T1 General Guide</a>`, '');
    } else if (acct.cra_t2125) {
        const url = 'https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t2125.html';
        const label = acct.cra_label ? ` — ${acct.cra_label}` : '';
        lines.push(`**CRA T2125 line ${acct.cra_t2125}**${label}`);
        lines.push(`<a href="term:xdg-open ${url}">T2125 form</a>`, '');
    }
    if (acct.platform_sibling && notebook) {
        const slug = _accountSlug(acct.platform_sibling);
        lines.push(`[[${notebook}:accounting/accounts/${slug}.md]] — the other side of this same platform.`, '');
    }
    if (acct.platform_note) {
        lines.push(acct.platform_note, '');
        if (acct.source_url) lines.push(`<a href="term:xdg-open ${acct.source_url}">Source</a>`, '');
    }
    return lines.join('\n').trimEnd();
}

// Build frontmatter only — body comes from the template.
function _accountFrontmatter(acct) {
    const fm = ['---', `title: "${acct.account}"`, 'type: account',
                `hledger_account: "${acct.account}"`];
    if (acct.type)      fm.push(`account_type: "${acct.type}"`);
    if (acct.cra_label) fm.push(`cra_label: "${acct.cra_label}"`);
    if (acct.cra_t1)    fm.push(`cra_line_t1: "${acct.cra_t1}"`);
    if (acct.cra_t2125) fm.push(`cra_line_t2125: "${acct.cra_t2125}"`);
    if (acct.platform_category) fm.push(`platform_category: ${acct.platform_category}`);
    if (acct.tax_collection_gst_hst) fm.push('tax_collection:', `  gst_hst: ${acct.tax_collection_gst_hst}`);
    if (acct.cra_seller_info_return !== undefined)
        fm.push('reporting:', `  cra_seller_info_return: ${acct.cra_seller_info_return}`);
    if (acct.payout_clearing_account || acct.payout_typical_lag_days != null) {
        fm.push('payout:');
        if (acct.payout_clearing_account) fm.push(`  clearing_account: "${acct.payout_clearing_account}"`);
        if (acct.payout_typical_lag_days != null) fm.push(`  typical_lag_days: ${acct.payout_typical_lag_days}`);
    }
    if (acct.credential_ref !== undefined) fm.push(`credential_ref: "${acct.credential_ref}"`);
    if (acct.last_verified) fm.push(`last_verified: ${acct.last_verified}`);
    if (acct.source_url)    fm.push(`source_url: "${acct.source_url}"`);
    fm.push('---');
    return fm.join('\n');
}

function _expandAccountTree(accounts) {
    const byPath = new Map(accounts.map(a => [a.account, a]));
    const extra  = [];
    for (const acct of accounts) {
        const parts = acct.account.split(':');
        for (let i = 1; i < parts.length; i++) {
            const ancestor = parts.slice(0, i).join(':');
            if (!byPath.has(ancestor)) {
                byPath.set(ancestor, { account: ancestor, type: acct.type });
                extra.push({ account: ancestor, type: acct.type });
            }
        }
    }
    // Insert ancestors before their children so parent notes exist first
    const sorted = [...extra, ...accounts];
    sorted.sort((a, b) => a.account.localeCompare(b.account));
    return sorted;
}

async function _createAccountNotes(notebook, accounts, journalPath, progressCb) {
    let created = 0;
    let errors  = 0;
    accounts = _expandAccountTree(accounts);

    // Always (re)write the account template so the current hl fence and folder path are in effect.
    const noteTemplate = [
        '---',
        'title: "{{title}}"',
        'type: account',
        'hledger_account: "{{title}}"',
        '---',
        '## {{title}}',
        '',
        '{{content}}',
        '',
        '```hl',
        'reg {{title}}',
        '```',
    ].join('\n');
    try {
        await fetch('/api/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scope:    'local',
                notebook: notebook,
                name:     'account',
                content:  noteTemplate,
            }),
        });
    } catch (_) {}
    try {
        await fetch('/api/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scope:    'annotation',
                notebook: notebook,
                content:  '## Private details\n\nInstitution: \nAccount number: \nOnline banking: \nNotes: \n',
            }),
        });
    } catch (_) {}

    // Fetch the account template once — all notes are built from it.
    // Falls back to a minimal inline body if the template is missing.
    let tplBody = null;
    try {
        const tplList = await fetch(`/api/templates?notebook=${encodeURIComponent(notebook)}`).then(r => r.json());
        const tplMeta = (tplList.templates || []).find(t => t.name === 'account' && t.scope === 'local');
        if (tplMeta?.path) {
            const tplData = await fetch(`/api/template?path=${encodeURIComponent(tplMeta.path)}`).then(r => r.json());
            tplBody = tplData.content || null;
        }
    } catch (_) {}

    for (const acct of accounts) {
        try {
            const content = _accountContent(acct, accounts, notebook);
            let noteText;
            if (tplBody) {
                // Substitute {{title}} and {{content}} into the template.
                // Frontmatter is rebuilt from scratch so CRA fields are included.
                const bodyPart = tplBody
                    .replace(/^---[\s\S]*?---\n?/, '')   // strip template's own FM
                    .replace(/\{\{title\}\}/g, acct.account)
                    .replace(/\{\{content\}\}/g, content);
                noteText = _accountFrontmatter(acct) + '\n' + bodyPart;
            } else {
                // Minimal fallback if template missing
                noteText = _accountFrontmatter(acct) + '\n## ' + acct.account.split(':').pop() + '\n\n' + content;
            }
            const r = await fetch('/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notebook, folder: 'accounting/accounts', title: acct.account, template_content: noteText }),
            });
            if (r.ok) { created++; } else { errors++; }
        } catch (_) { errors++; }
        if (progressCb) progressCb(created, errors, accounts.length);
    }
    return { created, errors };
}

// ── CoA wizard UI ─────────────────────────────────────────────────────────────

function _buildCoaWizard(el, notebook, config) {
    const domains  = Object.entries(_COA_DOMAINS);
    const provinces = Object.entries(_PROVINCES);

    el.innerHTML = `
        <div class="nb-plugin-section nb-hl-coa-wizard">
            <div class="nb-plugin-section-title">Chart of Accounts Setup — <code>${_esc(notebook)}</code></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
                <label style="font-size:12px;color:var(--text-dim)">Domain</label>
                <select id="nb-hl-domain" class="nb-scope-select">
                    ${domains.map(([id, d]) =>
                        `<option value="${id}">${_esc(d.label)}</option>`).join('')}
                </select>
                <label style="font-size:12px;color:var(--text-dim)">Province</label>
                <select id="nb-hl-province" class="nb-scope-select">
                    ${provinces.map(([code, p]) =>
                        `<option value="${code}"${code === (config?.province || 'ON') ? ' selected' : ''}>${_esc(p.label)}</option>`).join('')}
                </select>
            </div>
            <div id="nb-hl-coa-opts" style="display:grid;grid-template-columns:1fr 1fr;gap:2px 16px;margin-bottom:10px;font-size:13px"></div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                <button id="nb-hl-coa-preview" class="nb-tool-btn">Preview accounts</button>
                <button id="nb-hl-coa-generate" class="nb-tool-btn nb-btn-primary">Generate accounts.journal</button>
                <button id="nb-hl-coa-notes" class="nb-tool-btn">Create account notes</button>
                <button id="nb-hl-coa-rebuild" class="nb-tool-btn" style="color:var(--orange,#e07b39)" title="Delete all type:account notes from this notebook">✕ Delete all accounts</button>
                <span id="nb-hl-coa-status" style="font-size:12px;color:var(--text-dim)"></span>
            </div>
            <pre id="nb-hl-coa-preview-text" style="display:none;font-size:11px;max-height:200px;overflow-y:auto;
                 background:var(--bg-alt,#1a1a1a);padding:8px;border-radius:4px;margin-top:8px;color:var(--text-dim)"></pre>
            <div id="nb-hl-coa-result" style="display:none;margin-top:8px"></div>
        </div>`;

    const domainSel    = el.querySelector('#nb-hl-domain');
    const provinceSel  = el.querySelector('#nb-hl-province');
    const optsEl       = el.querySelector('#nb-hl-coa-opts');
    const previewBtn   = el.querySelector('#nb-hl-coa-preview');
    const generateBtn  = el.querySelector('#nb-hl-coa-generate');
    const createNotesBtn = el.querySelector('#nb-hl-coa-notes');
    const rebuildBtn   = el.querySelector('#nb-hl-coa-rebuild');
    const statusEl     = el.querySelector('#nb-hl-coa-status');
    const previewText  = el.querySelector('#nb-hl-coa-preview-text');
    const resultEl     = el.querySelector('#nb-hl-coa-result');
    let _lastAccounts  = [];

    // Remember the wizard's domain + checkbox/text state per notebook (same
    // pattern as _bkPanelMode's localStorage use above) so reopening Setup in
    // the same notebook restores what was there before, instead of always
    // resetting to each option's hardcoded default.
    const _domainKey   = () => `nb-hl-coa-domain:${notebook}`;
    const _optsKey      = domainId => `nb-hl-coa-opts:${notebook}:${domainId}`;
    const _loadSavedOpts = domainId => {
        try { return JSON.parse(localStorage.getItem(_optsKey(domainId)) || '{}'); }
        catch (_) { return {}; }
    };

    function getOpts() {
        const opts = {};
        optsEl.querySelectorAll('input[type=checkbox]').forEach(cb => {
            opts[cb.dataset.id] = cb.checked;
        });
        optsEl.querySelectorAll('input[type=text]').forEach(inp => {
            opts[inp.dataset.id] = inp.value.trim();
        });
        return opts;
    }

    function saveOpts() {
        try { localStorage.setItem(_optsKey(domainSel.value), JSON.stringify(getOpts())); }
        catch (_) {}
    }

    function buildAccounts() {
        const domain   = _COA_DOMAINS[domainSel.value];
        const province = provinceSel.value;
        const opts     = getOpts();
        return domain?.build(opts, province) || [];
    }

    function renderOpts() {
        const domain = _COA_DOMAINS[domainSel.value];
        if (!domain) return;
        const saved = _loadSavedOpts(domainSel.value);
        optsEl.innerHTML = domain.options.map(opt => opt.type === 'text'
            ? `<label style="display:flex;gap:6px;align-items:center;padding:2px 0">
                <span>${_esc(opt.label)}</span>
                <input type="text" data-id="${opt.id}" placeholder="${_esc(opt.placeholder || '')}"
                       value="${_esc(saved[opt.id] ?? '')}"
                       style="flex:1;font-size:12px;background:var(--bg-alt,#1a1a1a);color:inherit;
                              border:1px solid var(--border,#333);border-radius:3px;padding:2px 6px">
               </label>`
            : `<label style="display:flex;gap:6px;align-items:center;cursor:pointer;padding:2px 0">
                <input type="checkbox" data-id="${opt.id}"${(saved[opt.id] ?? opt.default) ? ' checked' : ''}>
                <span>${_esc(opt.label)}</span>
            </label>`
        ).join('');
    }

    optsEl.addEventListener('change', saveOpts);
    optsEl.addEventListener('input',  saveOpts);

    // Restore the last-used domain for this notebook, if any.
    const savedDomain = localStorage.getItem(_domainKey());
    if (savedDomain && _COA_DOMAINS[savedDomain]) domainSel.value = savedDomain;

    domainSel.addEventListener('change', () => {
        try { localStorage.setItem(_domainKey(), domainSel.value); } catch (_) {}
        renderOpts();
        previewText.style.display = 'none'; resultEl.style.display = 'none';
    });
    renderOpts();

    previewBtn.addEventListener('click', () => {
        const accounts = buildAccounts();
        previewText.textContent = accounts.map(a => `account ${a.account}`).join('\n');
        previewText.style.display = 'block';
        statusEl.textContent = `${accounts.length} accounts`;
    });

    generateBtn.addEventListener('click', async () => {
        const accounts = buildAccounts();
        if (!accounts.length) { statusEl.textContent = 'No accounts to generate'; return; }
        generateBtn.disabled = true;
        statusEl.textContent = 'Writing…';

        const domain   = _COA_DOMAINS[domainSel.value];
        const province = _PROVINCES[provinceSel.value];
        const header   = `Generated by NbWeb-hledger\nDomain: ${domain?.label}\nProvince: ${province?.label || provinceSel.value}\nDo not edit this file by hand — regenerate from the plugin page`;

        try {
            const r = await fetch('/api/hledger/coa-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notebook, accounts, header }),
            });
            const d = await r.json();
            if (d.error) {
                statusEl.textContent = '✗ ' + d.error;
            } else {
                _lastAccounts = accounts;
                statusEl.textContent = `✓ ${accounts.length} accounts written`;
                previewText.style.display = 'none';
                createNotesBtn.style.display = '';
                resultEl.style.display = 'block';
                resultEl.innerHTML = `
                    <div style="font-size:12px;background:var(--bg-alt,#1a1a1a);padding:8px;border-radius:4px;border:1px solid var(--border,#333)">
                        <div style="color:var(--green,#4caf50);margin-bottom:4px">✓ Written to <code>${_esc(d.path)}</code></div>
                        ${d.include_needed ? `
                        <div style="margin-top:6px;color:var(--text-dim)">Add this line to your main journal:</div>
                        <code style="display:block;margin-top:4px;padding:4px 8px;background:var(--bg,#111);border-radius:3px">${_esc(d.include_line)}</code>
                        ` : '<div style="color:var(--text-dim);margin-top:4px">✓ Main journal already includes accounts.journal</div>'}
                    </div>`;
            }
        } catch (e) {
            statusEl.textContent = '✗ ' + e.message;
        }
        generateBtn.disabled = false;
    });

    createNotesBtn.addEventListener('click', async () => {
        const accounts = _lastAccounts.length ? _lastAccounts : buildAccounts();
        if (!accounts.length) { statusEl.textContent = 'No accounts'; return; }
        createNotesBtn.disabled = true;
        const journalPath = config?.journal || null;
        statusEl.textContent = `Creating notes… 0 / ${accounts.length}`;
        const { created, errors } = await _createAccountNotes(
            notebook, accounts, journalPath,
            (done, errs, total) => {
                statusEl.textContent = `Creating notes… ${done + errs} / ${total}`;
            }
        );
        statusEl.textContent = `✓ ${created} notes created${errors ? ` (${errors} errors)` : ''}`;
        createNotesBtn.disabled = false;
        if (typeof NbWeb !== 'undefined') NbWeb.refreshList?.();
    });

    rebuildBtn.addEventListener('click', async () => {
        rebuildBtn.disabled = true;
        statusEl.textContent = 'Deleting account notes…';
        try {
            const r = await fetch('/api/hledger/clear-account-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notebook }),
            });
            const d = await r.json();
            if (d.error) { statusEl.textContent = '✗ ' + d.error; return; }
            statusEl.textContent = `✓ Deleted ${d.deleted} account notes`;
            if (typeof NbWeb !== 'undefined') NbWeb.refreshList?.();
        } catch (e) {
            statusEl.textContent = '✗ ' + e.message;
        } finally {
            rebuildBtn.disabled = false;
        }
    });
}

// ── Setup panel (journal info + CoA wizard) ───────────────────────────────────

function _buildSetupPanel(el, notebook, config) {
    const journal  = config?.journal || '(not set)';
    const province = config?.province || '—';
    const entity   = config?.entity   || '—';
    const prov     = _PROVINCES[province];

    el.innerHTML = `
        <div class="nb-plugin-section">
            <div class="nb-plugin-section-title">Journal</div>
            <table id="nb-hl-setup-info" style="font-size:12px;border-collapse:collapse;width:100%">
                <tr><td style="color:var(--text-dim);padding:2px 8px 2px 0">File</td>
                    <td><code>${_esc(journal)}</code></td></tr>
                <tr><td style="color:var(--text-dim);padding:2px 8px 2px 0">Province</td>
                    <td>${_esc(prov?.label || province)}</td></tr>
                <tr><td style="color:var(--text-dim);padding:2px 8px 2px 0">Entity</td>
                    <td>${_esc(entity)}</td></tr>
                ${config?.commodity ? `<tr><td style="color:var(--text-dim);padding:2px 8px 2px 0">Commodity</td>
                    <td>${_esc(config.commodity)}</td></tr>` : ''}
            </table>
        </div>
        <div id="nb-hl-coa-container"></div>`;

    _buildCoaWizard(el.querySelector('#nb-hl-coa-container'), notebook, config);

    _getAccounts(notebook).then(accounts => {
        if (!accounts.length) return;
        const table = el.querySelector('#nb-hl-setup-info');
        if (!table) return;
        const row = document.createElement('tr');
        row.innerHTML = `<td style="color:var(--text-dim);padding:2px 8px 2px 0">Accounts</td>
                         <td>${accounts.length} defined</td>`;
        table.appendChild(row);
    });
}

// ── Bookkeeper panel (daily use) ──────────────────────────────────────────────

async function _buildBookkeeperPanel(el, notebook, config) {
    const journal = config?.journal;
    if (!journal) {
        el.innerHTML = `<div class="nb-plugin-section" style="color:var(--text-dim);font-size:13px">
            No journal configured — use the <strong>Setup</strong> tab to configure your journal.</div>`;
        return;
    }

    // Don't prepend `journal` into the query string — api_hledger_query only
    // recognizes a leading token as a file path if it starts with ~ or /, and
    // the notebook-root convention stores journal: as a relative path
    // ("accounting/journals/main.journal"), which would otherwise get parsed
    // as the hledger *command* itself ("Command not allowed: accounting/...").
    // Pass notebook= instead and let the backend resolve it from that
    // notebook's own config (_hledger_config_for_notebook) — same pattern
    // _getAccounts() already uses for /api/hledger/accounts.
    const q = cmd => `/api/hledger-query?q=${encodeURIComponent(cmd)}&notebook=${encodeURIComponent(notebook)}&format=text`;

    el.innerHTML = `
        <div class="nb-plugin-section" id="nb-hl-bk-health">
            <div class="nb-plugin-section-title">Journal Health</div>
            <div id="nb-hl-bk-health-body" class="nb-hl-bk-loading">Checking…</div>
        </div>
        <div class="nb-plugin-section" id="nb-hl-bk-period">
            <div class="nb-plugin-section-title">This Month</div>
            <div id="nb-hl-bk-period-body" class="nb-hl-bk-loading">Loading…</div>
        </div>
        <div class="nb-plugin-section" id="nb-hl-bk-recent">
            <div class="nb-plugin-section-title">Transactions This Month</div>
            <div id="nb-hl-bk-recent-body" class="nb-hl-bk-loading">Loading…</div>
        </div>`;

    const [healthR, periodR, recentR] = await Promise.allSettled([
        fetch(q('check')).then(r => r.json()),
        fetch(q('is -p thismonth')).then(r => r.json()),
        fetch(q('reg -p thismonth')).then(r => r.json()),
    ]);

    const healthBody = el.querySelector('#nb-hl-bk-health-body');
    if (healthR.status === 'fulfilled' && !healthR.value?.error) {
        healthBody.innerHTML = '<span style="color:var(--green,#4caf50)">✓ No errors found</span>';
    } else {
        const msg = (healthR.status === 'fulfilled' ? healthR.value?.error : healthR.reason?.message) || 'check failed';
        healthBody.innerHTML = `<pre class="nb-hl-bk-pre" style="color:var(--orange,#e07b39)">${_esc(msg)}</pre>`;
    }

    function _renderText(r, fallback) {
        if (r.status !== 'fulfilled') return `<span class="nb-hl-empty">${_esc(r.reason?.message || 'request failed')}</span>`;
        if (r.value?.error)           return `<span class="nb-hl-empty">${_esc(r.value.error)}</span>`;
        const raw = r.value?.text;
        if (!raw || !raw.trim())      return `<span class="nb-hl-empty">${fallback}</span>`;
        return `<pre class="nb-hl-bk-pre">${_esc(raw)}</pre>`;
    }

    el.querySelector('#nb-hl-bk-period-body').innerHTML  = _renderText(periodR, 'No transactions this month');
    el.querySelector('#nb-hl-bk-recent-body').innerHTML  = _renderText(recentR, 'No transactions found');
}

// ── pluginContent ─────────────────────────────────────────────────────────────

async function _buildPluginContent(el, notebook, config) {
    el.innerHTML = `
        <div class="nb-hl-panel-tabs">
            <button class="nb-hl-panel-tab${_bkPanelMode === 'bookkeeper' ? ' nb-active' : ''}" data-mode="bookkeeper">Bookkeeper</button>
            <button class="nb-hl-panel-tab${_bkPanelMode === 'setup'      ? ' nb-active' : ''}" data-mode="setup">Setup</button>
        </div>
        <div id="nb-hl-panel-body"></div>`;

    el.querySelectorAll('.nb-hl-panel-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            _bkPanelMode = btn.dataset.mode;
            localStorage.setItem('nb-hl-panel-mode', _bkPanelMode);
            _buildPluginContent(el, notebook, config);
        });
    });

    const body = el.querySelector('#nb-hl-panel-body');
    if (_bkPanelMode === 'setup') {
        _buildSetupPanel(body, notebook, config);
    } else {
        await _buildBookkeeperPanel(body, notebook, config);
    }
}

// ── previewRenderer ───────────────────────────────────────────────────────────

async function _renderAccountNote(note) {
    if (note.type !== 'account' || !note.meta) return null;
    const m = note.meta;
    const rows = [
        ['Account',  m.hledger_account || note.title],
        ['Type',     m.account_type],
        ['Domain',   m.domain],
        m.cra_t1     && ['CRA T1 line', `${m.cra_t1}${m.cra_label ? ' — ' + m.cra_label : ''}`],
        m.cra_t2125  && ['CRA T2125',   `${m.cra_t2125}${m.cra_label ? ' — ' + m.cra_label : ''}`],
        m.deductible_rate && ['Deductible', `${m.deductible_rate * 100}%`],
    ].filter(Boolean);

    const tableHtml = rows.map(([k, v]) => v
        ? `<tr><td style="color:var(--text-dim);padding:2px 12px 2px 0;white-space:nowrap">${_esc(k)}</td>
               <td>${_esc(String(v))}</td></tr>`
        : ''
    ).join('');

    const acctName = m.hledger_account || note.title || '';
    const rawBody = (note.body || '').trim().replace(/\{title\}/g, acctName);
    const bodyHtml = rawBody
        ? `<div class="nb-rendered" style="margin-top:12px">${await NbMain.renderMarkdown(rawBody, note.selector)}</div>`
        : '';

    return `<div class="nb-hl-account-note">
        <table style="font-size:13px;border-collapse:collapse;margin-bottom:8px">${tableHtml}</table>
        ${bodyHtml}
    </div>`;
}

// ── Plugin registration ───────────────────────────────────────────────────────

NbWeb.registerModule('hledger', {
    label:              'NbWeb-hledger',
    contentButtonIcon:  '⚡',
    contentButtonLabel: 'Wizard',
    description: 'Plain-text accounting with domain knowledge — Canadian CoA, tax mappings, journal health',
    helpUrl:     '/plugins/nbweb-hledger.md',

    notebookSetup: {
        configFile:    '.nb-hledger.json',
        defaultConfig: {},
        label:         'Accounting',
    },

    detect: notebooks => notebooks.filter(nb => nb.hledger != null),

    requirementCheck: async () => {
        const w = await NbWeb.checkWhich('hledger');
        if (!w.found)
            return { ok: false, markdownFile: '/plugins/requirements/hledger-requirements.md' };
        const hledgerNbs = NbWeb.notebooks().filter(nb => nb.hledger != null);
        if (!hledgerNbs.length)
            return { ok: false, markdownFile: '/plugins/requirements/hledger-setup.md' };
        return { ok: true };
    },

    pluginContent: async (el) => {
        const hledgerNbs = NbWeb.notebooks().filter(nb => nb.hledger != null);
        if (!hledgerNbs.length) return;
        const currentName = typeof NbNav !== 'undefined' ? NbNav.notebook : '';
        const nb = hledgerNbs.find(n => n.name === currentName) || hledgerNbs[0];
        await _buildPluginContent(el, nb.name, nb.hledger);
    },

    listDefaults: { listType: 'account', sortOrder: 'account-hierarchy' },

    sortOptions: [
        {
            id:    'account-hierarchy',
            label: 'Account hierarchy',
            sort:  notes => [...notes].sort((a, b) =>
                (a.meta?.hledger_account || a.title || '').localeCompare(
                 b.meta?.hledger_account || b.title || '')),
        },
        {
            id:    'cra-line',
            label: 'CRA line',
            sort:  notes => [...notes].sort((a, b) => {
                const la = Number(a.meta?.cra_t1 || a.meta?.cra_t2125 || 99999);
                const lb = Number(b.meta?.cra_t1 || b.meta?.cra_t2125 || 99999);
                return la - lb;
            }),
        },
    ],

    listItemIcon: note => {
        if (note.type === 'account')  return '📒';
        if (note.type === 'template') return '📋';
        if (note.type === 'period')   return '📅';
        if (note.type === 'report')   return '📊';
        return window.NbSpecialty?.cfg?.[note.type]?.icon ?? null;
    },

    listTitle: note => {
        if (note.type !== 'account' || !note.meta) return null;
        const acct = note.meta.hledger_account || note.title || '';
        const lbl  = note.meta.cra_label ? ` — ${note.meta.cra_label}` : '';
        return acct + lbl || null;
    },

    previewRendererDetect: note => note.type === 'account',
    previewRenderer: note => note.type === 'account' ? _renderAccountNote(note) : null,
});

// Wire accounting action buttons into the specialty header via NbSpecialty hook.
// Renderer lives in nbweb-codeblocks; these actions only appear in hledger notebooks.
if (window.NbSpecialty) {
    window.NbSpecialty.getActions = note => {
        if (note.type === 'reports') return `<div class="nb-specialty-actions">
            <button class="nb-specialty-action" data-action="quote"   title="Generate quote">📋 Quote</button>
            <button class="nb-specialty-action" data-action="invoice" title="Generate invoice">🧾 Invoice</button>
           </div>`;
        if (note.type === 'invoice') return `<div class="nb-specialty-actions">
            ${note.meta?.status !== 'paid' ? '<button class="nb-specialty-action" data-action="mark-paid" title="Record payment received">✅ Mark Paid</button>' : ''}
            <button class="nb-specialty-action" data-action="print-invoice" title="Print / export invoice">🖨️ Print</button>
           </div>`;
        if (note.type === 'quote') return `<div class="nb-specialty-actions">
            <button class="nb-specialty-action" data-action="print-invoice" title="Print / export quote">🖨️ Print</button>
           </div>`;
        if (note.type === 'item') {
            const txns   = _extractLedgerTransactions(note.annotation);
            const isSold = txns.some(t => t.postings.some(p => p.account === 'Assets:Inventory' && p.amount < 0));
            const warn   = note.meta?.status === 'sold' && !isSold
                ? '<span class="nb-source-warn">sold, no sale recorded</span>' : '';
            return `<div class="nb-specialty-actions">
                ${warn}
                ${note.meta?.status !== 'sold' ? '<button class="nb-specialty-action" data-action="mark-sold" title="Mark as sold">✅ Sold</button>' : ''}
                <button class="nb-specialty-action" data-action="item-summary" title="Cost / margin summary">📊 Summary</button>
                <button class="nb-specialty-action" data-action="item-fields" title="Fill in item fields (required + optional)">📝 Fields</button>
                <button class="nb-specialty-action" data-action="item-new" title="Add new item(s) from image(s)">🆕 New</button>
               </div>`;
        }
        return '';
    };
}

// Expose accounts getter so NbWeb-codeblocks can wire autocomplete
window.NbHledger = { getAccounts: _getAccounts };

// Delegated click handler for specialty action buttons
document.addEventListener('click', e => {
    const btn = e.target.closest('.nb-specialty-action');
    if (!btn) return;
    e.preventDefault();
    const action = btn.dataset.action;
    const note   = NbMain.activeNote();
    if (action === 'quote')         _reportsGenQuote(note);
    if (action === 'invoice')       _reportsGenInvoice(note);
    if (action === 'mark-paid')     _invoiceMarkPaid(note);
    if (action === 'print-invoice') _invoicePrint(note);
    if (action === 'mark-sold')     _itemMarkSold(note);
    if (action === 'item-summary')  _itemSummary(note);
    if (action === 'item-fields')   _itemFieldsModal(note);
    if (action === 'item-new')      _itemNewPicker(note);
});

async function _reportsGenQuote(note, scope = 'future') {
    const btn = document.querySelector('.nb-specialty-action[data-action="quote"]');
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    try {
        const r = await fetch(`/api/t/quote/preflight?selector=${encodeURIComponent(note.selector || '')}&scope=${scope}`);
        const data = await r.json();
        if (data.error) throw new Error(data.error);
        _showQuoteDialog(note, data);
    } catch (e) {
        alert(`Quote preflight failed: ${e.message}`);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '📋 Quote'; }
    }
}

function _showQuoteDialog(note, d) {
    document.getElementById('nb-quote-dialog')?.remove();

    const fmt  = n => `$${Number(n).toFixed(2)}`;
    const hasMat = d.materials_gross > 0;

    const labourTotal = d.labour_total || 0;
    const matGross    = d.materials_gross || 0;
    const matSub      = d.materials_subtotal || 0;
    const HST         = 0.13;
    const isCash      = d.billing_type === 'cash';
    const quoteTotal  = isCash
        ? Math.round((labourTotal + matGross) * 100) / 100
        : Math.round(((labourTotal + matSub) * (1 + HST)) * 100) / 100;
    const taxNote     = isCash
        ? `cash — no HST`
        : `+ HST ${fmt((labourTotal + matSub) * HST)} = ${fmt(quoteTotal)}`;

    const labourRow = d.labour_hours > 0
        ? `<tr><td>Labour (est.)</td><td>${d.labour_hours} h × ${fmt(d.rate)}</td><td>${fmt(labourTotal)}</td></tr>`
        : '';
    const matRow = hasMat
        ? `<tr><td>Materials (est.)</td><td>cost + HST</td><td>${fmt(matGross)}</td></tr>`
        : '';
    const emptyNote = d.empty
        ? `<div class="nb-inv-tax">No guesstimated entries in this scope yet — log timedot/csv
           blocks dated in the future (or anywhere, for "whole job") to project a quote.</div>`
        : '';

    const el = document.createElement('div');
    el.id = 'nb-quote-dialog';
    el.className = 'nb-invoice-overlay';
    el.innerHTML = `
        <div class="nb-invoice-panel">
            <div class="nb-invoice-hdr">📋 Generate Quote — <em>a projection, not a billing event</em></div>
            <div class="nb-invoice-sub">${_esc(d.project)} · ${_esc(d.client)} · <em>${_esc(d.billing_type)}</em></div>
            <label>Scope
                <select id="nb-quo-scope">
                    <option value="future" ${d.scope === 'future' ? 'selected' : ''}>Remaining work (from tomorrow on)</option>
                    <option value="all" ${d.scope === 'all' ? 'selected' : ''}>Whole job (start to finish)</option>
                </select>
            </label>
            <table class="nb-invoice-tbl">
                <thead><tr><th>Item</th><th>Detail</th><th>Amount</th></tr></thead>
                <tbody>${labourRow}${matRow}</tbody>
                <tfoot><tr>
                    <td colspan="2"><strong>Estimated Total</strong></td>
                    <td><strong>${fmt(quoteTotal)}</strong> <span class="nb-inv-tax">${_esc(taxNote)}</span></td>
                </tr></tfoot>
            </table>
            ${emptyNote}
            <div class="nb-invoice-fields">
                <label>Quote #     <input id="nb-quo-num"   value="${_esc(d.suggested_num)}"></label>
                <label>Date       <input id="nb-quo-date"  type="date" value="${_esc(d.date)}"></label>
                <label>Valid until<input id="nb-quo-valid" placeholder="optional"></label>
                <label>Notes      <input id="nb-quo-notes" placeholder="optional"></label>
            </div>
            <div class="nb-invoice-btns">
                <button id="nb-quo-cancel">Cancel</button>
                <button id="nb-quo-gen" class="nb-inv-primary">Generate</button>
            </div>
        </div>`;

    document.body.appendChild(el);
    document.getElementById('nb-quo-cancel').addEventListener('click', () => el.remove());
    el.addEventListener('click', e => { if (e.target === el) el.remove(); });

    // Re-preflight when scope changes, refreshing this same dialog in place
    document.getElementById('nb-quo-scope').addEventListener('change', async ev => {
        el.remove();
        await _reportsGenQuote(note, ev.target.value);
    });

    document.getElementById('nb-quo-gen').addEventListener('click', async () => {
        const genBtn = document.getElementById('nb-quo-gen');
        genBtn.disabled = true; genBtn.textContent = '…';
        try {
            const r = await fetch('/api/t/quote/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    selector:    note.selector,
                    quote_num:   document.getElementById('nb-quo-num').value.trim(),
                    scope:       document.getElementById('nb-quo-scope').value,
                    date:        document.getElementById('nb-quo-date').value,
                    valid_until: document.getElementById('nb-quo-valid').value.trim(),
                    notes:       document.getElementById('nb-quo-notes').value.trim(),
                }),
            });
            const result = await r.json();
            if (!result.success) throw new Error(result.error || 'generate failed');
            el.remove();
            NbMain.openNote(result.selector);
        } catch (e) {
            alert(`Quote generation failed: ${e.message}`);
            genBtn.disabled = false; genBtn.textContent = 'Generate';
        }
    });
}

async function _reportsGenInvoice(note) {
    const btn = document.querySelector('.nb-specialty-action[data-action="invoice"]');
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    try {
        const r = await fetch(`/api/t/invoice/preflight?selector=${encodeURIComponent(note.selector || '')}`);
        const data = await r.json();
        if (data.error) throw new Error(data.error);
        _showInvoiceDialog(note, data);
    } catch (e) {
        alert(`Invoice preflight failed: ${e.message}`);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '🧾 Invoice'; }
    }
}

function _showInvoiceDialog(note, d) {
    document.getElementById('nb-invoice-dialog')?.remove();

    const fmt  = n => `$${Number(n).toFixed(2)}`;
    const hasMat = d.materials_gross > 0;

    const labourTotal  = d.labour_total || 0;
    const matGross     = d.materials_gross || 0;
    const matSub       = d.materials_subtotal || 0;
    const HST          = 0.13;
    const isCash       = d.billing_type === 'cash';
    const invoiceTotal = isCash
        ? Math.round((labourTotal + matGross) * 100) / 100
        : Math.round(((labourTotal + matSub) * (1 + HST)) * 100) / 100;
    const taxNote      = isCash
        ? `cash — no HST collected`
        : `+ HST ${fmt((labourTotal + matSub) * HST)} = ${fmt(invoiceTotal)}`;

    const labourRow = d.labour_hours > 0
        ? `<tr><td>Labour</td><td>${d.labour_hours} h × ${fmt(d.rate)}</td><td>${fmt(labourTotal)}</td></tr>`
        : '';
    const matRow = hasMat
        ? `<tr><td>Materials</td><td>cost + HST</td><td>${fmt(matGross)}</td></tr>`
        : '';

    const el = document.createElement('div');
    el.id = 'nb-invoice-dialog';
    el.className = 'nb-invoice-overlay';
    el.innerHTML = `
        <div class="nb-invoice-panel">
            <div class="nb-invoice-hdr">🧾 Generate Invoice</div>
            <div class="nb-invoice-sub">${_esc(d.project)} · ${_esc(d.client)} · <em>${_esc(d.billing_type)}</em></div>
            <table class="nb-invoice-tbl">
                <thead><tr><th>Item</th><th>Detail</th><th>Amount</th></tr></thead>
                <tbody>${labourRow}${matRow}</tbody>
                <tfoot><tr>
                    <td colspan="2"><strong>Total</strong></td>
                    <td><strong>${fmt(invoiceTotal)}</strong> <span class="nb-inv-tax">${_esc(taxNote)}</span></td>
                </tr></tfoot>
            </table>
            <div class="nb-invoice-fields">
                <label>Invoice #<input id="nb-inv-num"   value="${_esc(d.suggested_num)}"></label>
                <label>Date     <input id="nb-inv-date"  type="date" value="${_esc(d.date)}"></label>
                <label>Due      <input id="nb-inv-due"   value="${_esc(d.due)}"></label>
                <label>Notes    <input id="nb-inv-notes" placeholder="optional"></label>
            </div>
            <div class="nb-invoice-btns">
                <button id="nb-inv-cancel">Cancel</button>
                <button id="nb-inv-gen" class="nb-inv-primary">Generate</button>
            </div>
        </div>`;

    document.body.appendChild(el);
    document.getElementById('nb-inv-cancel').addEventListener('click', () => el.remove());
    el.addEventListener('click', e => { if (e.target === el) el.remove(); });

    document.getElementById('nb-inv-gen').addEventListener('click', async () => {
        const genBtn = document.getElementById('nb-inv-gen');
        genBtn.disabled = true; genBtn.textContent = '…';
        try {
            const r = await fetch('/api/t/invoice/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    selector:    note.selector,
                    invoice_num: document.getElementById('nb-inv-num').value.trim(),
                    date:        document.getElementById('nb-inv-date').value,
                    due:         document.getElementById('nb-inv-due').value.trim(),
                    notes:       document.getElementById('nb-inv-notes').value.trim(),
                }),
            });
            const result = await r.json();
            if (!result.success) throw new Error(result.error || 'generate failed');
            el.remove();
            NbMain.openNote(result.selector);
        } catch (e) {
            alert(`Invoice generation failed: ${e.message}`);
            genBtn.disabled = false; genBtn.textContent = 'Generate';
        }
    });
}

async function _invoiceMarkPaid(note) {
    if (!note?.selector) return;
    const payDate = prompt('Payment date (YYYY-MM-DD):', new Date().toISOString().slice(0, 10));
    if (!payDate) return;
    const raw = note.raw || '';
    // Update status: due → paid, add paid: date to FM
    let updated = raw
        .replace(/^(status:\s*)due(\s*)$/m, `$1paid$2`)
        .replace(/^(status:\s*)paid(\s*)$/m, `$1paid$2`);  // idempotent
    if (!/^paid:/m.test(updated)) {
        // Insert paid: after status: line
        updated = updated.replace(/^(status:.+)$/m, `$1\npaid: "${payDate}"`);
    } else {
        updated = updated.replace(/^(paid:\s*).+$/m, `$1"${payDate}"`);
    }
    const r = await fetch('/api/note', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selector: note.selector, content: updated }),
    });
    const d = await r.json();
    if (d.error) { alert(`Mark paid failed: ${d.error}`); return; }
    NbMain.openNote(note.selector);
}

async function _invoicePrint(note) {
    if (!note?.selector) return;
    // Render from raw note content — avoids any live-DOM artifacts (dialogs, overlays)
    const raw = note.raw || '';
    const body = raw
        .replace(/^---[\s\S]*?---\s*\n/, '')   // strip frontmatter
        .replace(/\n---\n+```ledger[\s\S]*?```/g, '')   // strip ledger block + its preceding hr
        .trim();
    const rendered = await NbMain.renderMarkdown(body, note.selector);
    const win = window.open('', '_blank', 'width=820,height=700');
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>${note.title || 'Invoice'}</title>
<link rel="stylesheet" href="/styles.css">
<style>
/* Kill app layout rules that cause a blank second page in print */
html { font-size: 12px !important; }
html, body { height: auto !important; min-height: 0 !important;
             overflow: visible !important; display: block !important; }
body { max-width: 720px; margin: 24px auto; padding: 0 24px;
       background: #fff !important; color: #000 !important; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #bbb; padding: 5px 10px; text-align: left; }
th { background: #f4f4f4; }
@page { margin: 0.75in; }
@media print { html, body { height: auto !important; margin: 0 !important; } }
</style>
</head><body>${rendered}</body></html>`);
    win.document.close();
    win.addEventListener('load', () => { win.focus(); win.print(); }, { once: true });
}

// ── Item specialty actions (Sold / Summary) ───────────────────────────────────
// note.annotation is already present on the note object fetched by /api/note —
// no extra request needed to read an item's own cost/sale ledger blocks.

const _ITEM_FENCE_OPEN  = /^```ledger\s*$/;
const _ITEM_FENCE_CLOSE = /^```\s*$/;
const _ITEM_DATE_LINE   = /^(\d{4}-\d{2}-\d{2})\s+\S/;

function _parseLedgerPosting(line) {
    if (!/^\s+\S/.test(line)) return null;
    const m = /^\s+(.+?)\s{2,}(-?[\d,]+\.?\d*)\s*[A-Za-z]{2,5}\b.*$/.exec(line);
    if (m) return { account: m[1].trim(), amount: parseFloat(m[2].replace(/,/g, '')) };
    const bare = /^\s+(\S.*?)\s*(?:;.*)?$/.exec(line);
    return bare ? { account: bare[1].trim(), amount: null } : null;
}

// Mirrors pfinds:.tools/gen-items-journal.py's extraction: one or more
// ```ledger blocks, each containing one or more blank-line-delimited
// transactions. Returns [{date, desc, postings: [{account, amount}]}].
function _extractLedgerTransactions(annotationText) {
    if (!annotationText) return [];
    const txns = [];
    let inBlock = false, cur = null;
    const flush = () => { if (cur && cur.date) txns.push(cur); cur = null; };
    for (const line of annotationText.split('\n')) {
        if (_ITEM_FENCE_OPEN.test(line))  { inBlock = true; continue; }
        if (_ITEM_FENCE_CLOSE.test(line) && inBlock) { inBlock = false; flush(); continue; }
        if (!inBlock) continue;
        if (!line.trim()) { flush(); continue; }
        if (line.trim().startsWith(';') && !cur) continue;
        const m = _ITEM_DATE_LINE.exec(line);
        if (m && !cur) { cur = { date: m[1], desc: line.trim(), postings: [] }; continue; }
        if (cur) {
            const p = _parseLedgerPosting(line);
            if (p) cur.postings.push(p);
        }
    }
    flush();
    return txns;
}

async function _itemMarkSold(note) {
    if (!note?.selector) return;
    const raw = note.raw || '';
    if (!/^status:/m.test(raw)) return;
    const updated = raw.replace(/^(status:\s*).+$/m, '$1sold');
    const r = await fetch('/api/note', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selector: note.selector, content: updated }),
    });
    const d = await r.json();
    if (d.error) { alert(`Mark sold failed: ${d.error}`); return; }
    NbMain.openNote(note.selector);
}

function _itemSummary(note) {
    document.getElementById('nb-item-summary-pop')?.remove();
    const txns = _extractLedgerTransactions(note?.annotation);

    const pop = document.createElement('div');
    pop.id = 'nb-item-summary-pop';
    pop.className = 'nb-lib-help-pop';

    if (!txns.length) {
        pop.innerHTML = '<div style="padding:10px 12px;color:var(--text-muted);font-size:0.85em">' +
            'No cost/sale data recorded yet — add a `​```ledger​```` block to this item\'s annotation.</div>';
    } else {
        const fmt = n => n == null ? '—' : `$${Number(n).toFixed(2)}`;
        const acquired = txns.find(t => t.postings.some(p => p.account === 'Assets:Inventory' && p.amount > 0));
        const sold     = txns.find(t => t.postings.some(p => p.account === 'Assets:Inventory' && p.amount < 0));
        const cost     = acquired?.postings.find(p => p.account === 'Assets:Inventory')?.amount ?? null;
        let rows = [];
        if (acquired) rows.push(`<tr><td>Bought</td><td>${_esc(acquired.date)}</td><td>${fmt(cost)}</td></tr>`);
        if (sold) {
            const salePrice = -sold.postings
                .filter(p => p.account.startsWith('Income:Sales') && p.amount != null)
                .reduce((s, p) => s + p.amount, 0);
            const fees = sold.postings
                .filter(p => p.account.startsWith('Expenses:') && !p.account.startsWith('Expenses:COGS') && p.amount != null)
                .reduce((s, p) => s + p.amount, 0);
            const net = salePrice - fees - (cost ?? 0);
            rows.push(`<tr><td>Sold</td><td>${_esc(sold.date)}</td><td>${fmt(salePrice)}</td></tr>`);
            rows.push(`<tr><td>Fees</td><td></td><td>${fmt(fees)}</td></tr>`);
            rows.push(`<tr style="font-weight:600"><td>Net</td><td></td><td>${fmt(net)}</td></tr>`);
        }
        pop.innerHTML = `<table style="font-size:12px;border-collapse:collapse;padding:8px 12px">
            ${rows.join('')}
        </table>`;
    }

    document.body.appendChild(pop);
    const btn = document.querySelector('.nb-specialty-action[data-action="item-summary"]');
    if (btn) {
        const rect = btn.getBoundingClientRect();
        pop.style.top  = (rect.bottom + 4) + 'px';
        pop.style.left = rect.left + 'px';
    }
    const dismiss = e => {
        if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', dismiss, true); }
    };
    setTimeout(() => document.addEventListener('click', dismiss, true), 0);
}

// "+ New" — the nb-web-native round trip of the existing nb-new-item desktop
// script (Caja right-click "Add New Item"). Real browser file picker
// (multi-select) rather than a desktop zenity dialog, since we're starting
// from inside nb-web already -- the notebook is already known from `note`,
// so unlike the desktop script there's no notebook-picker step needed.
// Doesn't navigate away from the item you're currently viewing -- refreshes
// the list in the background and reports status on the button itself, quiet
// on full success (same "silent unless something needs attention" spirit as
// the checks system).
// "+ New" — pick image(s) for one new item, then collect its code (filename/
// accounting reference) and title (descriptive text) in a small confirm
// modal before uploading. Multi-select images all belong to the SAME item
// (first = primary, rest = supplemental) -- it is not a batch of N items.
function _itemNewPicker(note) {
    if (!note?.notebook) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', () => {
        const files = [...input.files];
        input.remove();
        if (!files.length) { alert('No files were selected.'); return; }
        _itemNewModal(note, files);
    }, { once: true });

    input.click();
}

function _itemNewModal(note, files) {
    document.getElementById('nb-item-new-modal')?.remove();

    const rows = files.map((f, i) =>
        `<div class="nb-item-new-file">${i === 0 ? 'primary' : `+${i}`} — ${_esc(f.name)}</div>`
    ).join('');

    const el = document.createElement('div');
    el.id = 'nb-item-new-modal';
    el.className = 'nb-invoice-overlay';
    el.innerHTML = `
        <div class="nb-invoice-panel">
            <div class="nb-invoice-hdr">🆕 New Item</div>
            <div class="nb-invoice-sub">${files.length} image${files.length > 1 ? 's' : ''} selected — the first is the primary image, others are auto-suffixed to it</div>
            <div class="nb-invoice-fields">
                <label>Code <input id="nb-item-new-code" placeholder="ABC123 (filename / accounting ref)"></label>
                <label>Title <input id="nb-item-new-title" placeholder="Vintage Pyrex Butterfly Gold Dish"></label>
            </div>
            <div class="nb-item-new-filelist">${rows}</div>
            <div class="nb-invoice-btns">
                <button id="nb-item-new-cancel">Cancel</button>
                <button id="nb-item-new-create" class="nb-inv-primary">Create</button>
            </div>
        </div>`;
    document.body.appendChild(el);

    const codeInput  = el.querySelector('#nb-item-new-code');
    const titleInput = el.querySelector('#nb-item-new-title');
    codeInput.focus();

    el.querySelector('#nb-item-new-cancel').addEventListener('click', () => el.remove());
    el.addEventListener('click', e => { if (e.target === el) el.remove(); });

    el.querySelector('#nb-item-new-create').addEventListener('click', async () => {
        const code  = codeInput.value.trim();
        const title = titleInput.value.trim();
        if (!code)  { codeInput.focus();  return; }
        if (!title) { titleInput.focus(); return; }

        const btn = el.querySelector('#nb-item-new-create');
        btn.disabled = true; btn.textContent = '…';

        const form = new FormData();
        form.append('notebook', note.notebook);
        form.append('code', code);
        form.append('title', title);
        for (const f of files) form.append('files', f);

        try {
            const d = await fetch('/api/item/new', { method: 'POST', body: form }).then(r => r.json());
            if (!d.success) throw new Error(d.error || 'creation failed');
            el.remove();
            if (typeof NbWeb !== 'undefined') NbWeb.refreshList?.();
            if (d.failures?.length) {
                alert(`Item created, but ${d.failures.length} image(s) failed:\n` +
                      d.failures.map(f => `${f.file}: ${f.error}`).join('\n'));
            }
            if (d.selector) {
                if (typeof NbMain !== 'undefined') NbMain.openNote?.(d.selector);
                const freshNote = await fetch(`/api/note?selector=${encodeURIComponent(d.selector)}`).then(r => r.json());
                if (!freshNote.error) _itemFieldsModal(freshNote);
            }
        } catch (e) {
            btn.disabled = false; btn.textContent = 'Create';
            alert(`New item failed: ${e.message}`);
        }
    });
}

// Item fields modal — the third of three ways to fill in an item's fields
// (direct Edit; the existing Frontmatter Changes panel, which only shows
// fields already present; this modal, which shows every field
// items/.items.md's constraints: declares, required or optional, blank or
// not). Reuses NbWeb.fmUtils (parseFields/widget/patch) -- the same helpers
// the Frontmatter Changes panel uses -- so widget rendering and the save
// mechanism can't drift from that panel's behaviour.
async function _itemFieldsModal(note) {
    if (!note?.selector) return;
    document.getElementById('nb-item-fields-modal')?.remove();

    let constraints;
    try {
        constraints = await fetch(`/api/note/constraints-full?selector=${encodeURIComponent(note.selector)}`).then(r => r.json());
    } catch (e) {
        alert(`Could not load item fields: ${e.message}`);
        return;
    }
    if (constraints.error) { alert(`Could not load item fields: ${constraints.error}`); return; }
    const keys = Object.keys(constraints);
    if (!keys.length) { alert('No fields declared in this folder\'s .items.md constraints.'); return; }

    const fu = NbWeb.fmUtils;
    if (!fu) { alert('fmUtils not loaded — codeblocks plugin missing?'); return; }

    const raw     = note.raw || '';
    const current = Object.fromEntries(fu.parseFields(raw).map(f => [f.key, f.value]));

    const el = document.createElement('div');
    el.id = 'nb-item-fields-modal';
    el.className = 'nb-invoice-overlay';
    el.innerHTML = `
        <div class="nb-invoice-panel">
            <div class="nb-invoice-hdr">📝 Item Fields — <em>${_esc(note.meta?.title || note.filename || '')}</em></div>
            <div class="nb-invoice-sub">Fields marked <span class="nb-item-field-required">*</span> are required — from this folder's .items.md</div>
            <div class="nb-invoice-fields" id="nb-item-fields-body"></div>
            <div class="nb-invoice-btns">
                <button id="nb-item-fields-cancel">Cancel</button>
                <button id="nb-item-fields-save" class="nb-inv-primary">Save</button>
            </div>
        </div>`;
    document.body.appendChild(el);

    const body = el.querySelector('#nb-item-fields-body');
    for (const key of keys) {
        const { widget, required } = constraints[key];
        const value = current[key] ?? '';
        const row = document.createElement('label');
        row.className = 'nb-item-field-row' + (required && !value ? ' nb-item-field-missing' : '');
        const lbl = document.createElement('span');
        lbl.className = 'nb-item-field-label';
        lbl.textContent = key + (required ? ' *' : '');
        row.appendChild(lbl);
        row.appendChild(fu.widget(key, value, widget));
        body.appendChild(row);
    }

    el.querySelector('#nb-item-fields-cancel').addEventListener('click', () => el.remove());
    el.addEventListener('click', e => { if (e.target === el) el.remove(); });

    el.querySelector('#nb-item-fields-save').addEventListener('click', async () => {
        const saveBtn = el.querySelector('#nb-item-fields-save');
        const updates = {};
        for (const w of body.querySelectorAll('[data-fm-key]')) {
            updates[w.dataset.fmKey] = w.type === 'checkbox' ? String(w.checked) : w.value;
        }
        saveBtn.disabled = true; saveBtn.textContent = '…';
        try {
            const r = await fetch('/api/note', {
                method:  'PUT',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ selector: note.selector, content: fu.patch(raw, updates) }),
            }).then(r => r.json());
            if (r.error) throw new Error(r.error);
            el.remove();
            NbMain.openNote(note.selector);
        } catch (e) {
            saveBtn.textContent = `⚠ ${e.message}`;
            saveBtn.disabled = false;
        }
    });
}

})();
