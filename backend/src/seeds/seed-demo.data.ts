export interface TestUserSeed {
  username: string;
  displayName: string;
  email: string;
  roleCode: string;
}

export interface CompanyInfoSeed {
  corporationNumber: string;
  fiscalMonth: number;
  representativeName: string;
}

export interface PersonInfoSeed {
  nationality: string;
  residenceStatus: string;
  residenceExpireDate: string;
}

export interface CustomerSeed {
  code: string;
  type: 'COMPANY' | 'PERSONAL';
  name: string;
  phone: string;
  email: string;
  address: string;
  serviceType: 'BOTH' | 'TAX' | 'ADMIN';
  ownerUsername: string;
  company?: CompanyInfoSeed;
  person?: PersonInfoSeed;
}

export interface AdminCaseTemplate {
  customerCode: string;
  caseName: string;
  applicantName: string;
  residenceStatus: string;
  status: string;
  expireDate: string | null;
  ownerUsername: string;
}

export interface TaxContractTemplate {
  customerCode: string;
  contractName: string;
  contractStatus: string;
  billingCycle: string;
  startDate: string;
  endDate: string | null;
  monthlyFee: number;
  ownerUsername: string;
}

export interface InvoiceItemSeed {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxRate: number;
}

export interface InvoiceTemplate {
  customerCode: string;
  invoiceNumber: string;
  title: string;
  invoiceType: string;
  status: string;
  totalAmount: number;
  taxAmount: number;
  subtotal: number;
  items: InvoiceItemSeed[];
}

export interface NoteTemplate {
  customerCode: string;
  content: string;
  noteType: string;
}

export const TEST_USERS: ReadonlyArray<TestUserSeed> = [
  {
    username: 'tanaka',
    displayName: '田中太郎',
    email: 'tanaka@jimusho.local',
    roleCode: 'STAFF',
  },
  {
    username: 'suzuki',
    displayName: '鈴木花子',
    email: 'suzuki@jimusho.local',
    roleCode: 'STAFF',
  },
  {
    username: 'yamamoto',
    displayName: '山本一郎',
    email: 'yamamoto@jimusho.local',
    roleCode: 'FINANCE',
  },
];

export const CUSTOMERS: ReadonlyArray<CustomerSeed> = [
  {
    code: 'C00001',
    type: 'COMPANY',
    name: '株式会社テクノロジー',
    phone: '03-1234-5678',
    email: 'info@techno.co.jp',
    address: '東京都千代田区丸の内1-1-1',
    serviceType: 'BOTH',
    ownerUsername: 'tanaka',
    company: {
      corporationNumber: '1234567890123',
      fiscalMonth: 3,
      representativeName: '佐藤健',
    },
  },
  {
    code: 'C00002',
    type: 'COMPANY',
    name: '合同会社グローバルトレード',
    phone: '06-9876-5432',
    email: 'contact@globaltrade.co.jp',
    address: '大阪府大阪市北区梅田2-2-2',
    serviceType: 'TAX',
    ownerUsername: 'suzuki',
    company: {
      corporationNumber: '9876543210987',
      fiscalMonth: 12,
      representativeName: '高橋美咲',
    },
  },
  {
    code: 'P00001',
    type: 'PERSONAL',
    name: 'グエン・バン・アン',
    phone: '080-1111-2222',
    email: 'nguyen@example.com',
    address: '東京都新宿区新宿3-3-3',
    serviceType: 'ADMIN',
    ownerUsername: 'tanaka',
    person: {
      nationality: 'ベトナム',
      residenceStatus: '技術・人文知識・国際業務',
      residenceExpireDate: '2027-06-15',
    },
  },
  {
    code: 'P00002',
    type: 'PERSONAL',
    name: 'リー・ウェイ',
    phone: '090-3333-4444',
    email: 'li.wei@example.com',
    address: '神奈川県横浜市中区山下町4-4-4',
    serviceType: 'ADMIN',
    ownerUsername: 'tanaka',
    person: {
      nationality: '中国',
      residenceStatus: '経営・管理',
      residenceExpireDate: '2026-12-01',
    },
  },
  {
    code: 'C00003',
    type: 'COMPANY',
    name: '株式会社サクラ食品',
    phone: '052-5555-6666',
    email: 'sakura@food.co.jp',
    address: '愛知県名古屋市中村区名駅5-5-5',
    serviceType: 'TAX',
    ownerUsername: 'suzuki',
    company: {
      corporationNumber: '5555666677778',
      fiscalMonth: 9,
      representativeName: '田村直樹',
    },
  },
];

export const ADMIN_CASE_TEMPLATES: ReadonlyArray<AdminCaseTemplate> = [
  {
    customerCode: 'P00001',
    caseName: '在留資格変更許可申請',
    applicantName: 'グエン・バン・アン',
    residenceStatus: '技術・人文知識・国際業務',
    status: 'SUBMITTED',
    expireDate: '2027-06-15',
    ownerUsername: 'tanaka',
  },
  {
    customerCode: 'P00002',
    caseName: '在留期間更新許可申請',
    applicantName: 'リー・ウェイ',
    residenceStatus: '経営・管理',
    status: 'MATERIAL_PENDING',
    expireDate: '2026-12-01',
    ownerUsername: 'tanaka',
  },
  {
    customerCode: 'P00001',
    caseName: '就労資格証明書交付申請',
    applicantName: 'グエン・バン・アン',
    residenceStatus: '技術・人文知識・国際業務',
    status: 'COMPLETED',
    expireDate: null,
    ownerUsername: 'tanaka',
  },
];

export const TAX_CONTRACT_TEMPLATES: ReadonlyArray<TaxContractTemplate> = [
  {
    customerCode: 'C00001',
    contractName: '顧問契約（月次）',
    contractStatus: 'ACTIVE',
    billingCycle: 'MONTHLY',
    startDate: '2025-04-01',
    endDate: null,
    monthlyFee: 50000,
    ownerUsername: 'suzuki',
  },
  {
    customerCode: 'C00002',
    contractName: '記帳代行契約',
    contractStatus: 'ACTIVE',
    billingCycle: 'MONTHLY',
    startDate: '2025-01-01',
    endDate: null,
    monthlyFee: 30000,
    ownerUsername: 'suzuki',
  },
  {
    customerCode: 'C00003',
    contractName: '税務顧問契約',
    contractStatus: 'ACTIVE',
    billingCycle: 'MONTHLY',
    startDate: '2024-10-01',
    endDate: null,
    monthlyFee: 80000,
    ownerUsername: 'suzuki',
  },
];

export const INVOICE_TEMPLATES: ReadonlyArray<InvoiceTemplate> = [
  {
    customerCode: 'C00001',
    invoiceNumber: 'INV-2026-001',
    title: '2026年3月顧問料',
    invoiceType: 'TAX',
    status: 'SENT',
    totalAmount: 55000,
    taxAmount: 5000,
    subtotal: 50000,
    items: [
      {
        description: '顧問契約 2026年3月',
        quantity: 1,
        unitPrice: 50000,
        amount: 50000,
        taxRate: 10,
      },
    ],
  },
  {
    customerCode: 'C00001',
    invoiceNumber: 'INV-2026-002',
    title: '2026年2月顧問料',
    invoiceType: 'TAX',
    status: 'PAID',
    totalAmount: 55000,
    taxAmount: 5000,
    subtotal: 50000,
    items: [
      {
        description: '顧問契約 2026年2月',
        quantity: 1,
        unitPrice: 50000,
        amount: 50000,
        taxRate: 10,
      },
    ],
  },
  {
    customerCode: 'P00001',
    invoiceNumber: 'INV-2026-003',
    title: '在留資格変更許可申請手数料',
    invoiceType: 'ADMIN',
    status: 'DRAFT',
    totalAmount: 110000,
    taxAmount: 10000,
    subtotal: 100000,
    items: [
      {
        description: '在留資格変更許可申請 報酬',
        quantity: 1,
        unitPrice: 100000,
        amount: 100000,
        taxRate: 10,
      },
    ],
  },
  {
    customerCode: 'C00002',
    invoiceNumber: 'INV-2026-004',
    title: '2026年3月記帳代行',
    invoiceType: 'TAX',
    status: 'SENT',
    totalAmount: 33000,
    taxAmount: 3000,
    subtotal: 30000,
    items: [
      {
        description: '記帳代行 2026年3月',
        quantity: 1,
        unitPrice: 30000,
        amount: 30000,
        taxRate: 10,
      },
    ],
  },
];

export const NOTE_TEMPLATES: ReadonlyArray<NoteTemplate> = [
  {
    customerCode: 'P00001',
    content: '初回面談実施。在留資格変更の要件を確認。',
    noteType: 'FOLLOW_UP',
  },
  {
    customerCode: 'P00001',
    content: '必要書類リストを送付済み。',
    noteType: 'MEMO',
  },
  {
    customerCode: 'C00001',
    content: '月次打ち合わせ。来期の節税対策について相談。',
    noteType: 'FOLLOW_UP',
  },
  {
    customerCode: 'C00002',
    content: '契約更新時期。来月確認予定。',
    noteType: 'GENERAL',
  },
];
