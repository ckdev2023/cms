/**
 * 高仿真客户中心演示数据：法人番号・地址・在留资格与跟进备注等字段贴近实际事务所录入习惯。
 *
 * 客户编码前缀 `CC-`（Customer Center rich）与既有 `C00001` / `P00001` 演示数据不冲突。
 */

export type OwnerUsername = 'tanaka' | 'suzuki' | 'admin';

export interface RichCompanyInfoSeed {
  corporationNumber: string;
  fiscalMonth: number;
  representativeName: string;
}

export interface RichPersonInfoSeed {
  nationality: string;
  residenceStatus: string;
  residenceExpireDate: string | null;
  isFamilyMember?: boolean;
  familyRelation?: 'SPOUSE' | 'CHILD' | 'PARENT' | 'OTHER';
  primaryCustomerCode?: string;
  remindDaysBefore?: number | null;
}

export interface RichStaffRelationSeed {
  ownerUsername: OwnerUsername;
  relationType: 'PRIMARY' | 'SECONDARY' | 'SUPPORT';
}

export interface RichNoteSeed {
  content: string;
  noteType: 'FOLLOW_UP' | 'MEMO' | 'GENERAL';
  nextFollowUpAt?: string | null;
}

export interface RichVisaCaseMemberSeed {
  customerCode: string;
  memberRole: 'APPLICANT' | 'SPOUSE' | 'CHILD' | 'PARENT' | 'OTHER';
  isPrimary: boolean;
}

export interface RichVisaCaseSeed {
  caseType: string;
  caseStatus: string;
  expireDate: string | null;
  materialStatus?: 'NOT_RECEIVED' | 'PARTIAL' | 'COMPLETE' | null;
  feeStatus?: 'NOT_BILLED' | 'BILLED' | 'PARTIAL_PAID' | 'PAID' | null;
  memo?: string | null;
  nextFollowUpAt?: string | null;
  assignedOwnerUsername?: OwnerUsername;
  members: RichVisaCaseMemberSeed[];
}

export interface RichCustomerSeed {
  code: string;
  type: 'COMPANY' | 'PERSONAL';
  name: string;
  phone: string;
  email: string;
  address: string;
  serviceType: 'BOTH' | 'TAX' | 'ADMIN';
  ownerUsername: OwnerUsername;
  company?: RichCompanyInfoSeed;
  person?: RichPersonInfoSeed;
  staffRelations?: RichStaffRelationSeed[];
  notes?: RichNoteSeed[];
  visaCase?: RichVisaCaseSeed;
}

export const RICH_CUSTOMERS: ReadonlyArray<RichCustomerSeed> = [
  {
    code: 'CC-H001',
    type: 'COMPANY',
    name: '株式会社オリゾンテック',
    phone: '03-6822-4410',
    email: 'backoffice@orizon-tech.example.jp',
    address: '東京都港区芝公園4-2-8 芝パークビル7F',
    serviceType: 'BOTH',
    ownerUsername: 'tanaka',
    company: {
      corporationNumber: '6010701012345',
      fiscalMonth: 3,
      representativeName: '森川 誠',
    },
    staffRelations: [
      { ownerUsername: 'tanaka', relationType: 'PRIMARY' },
      { ownerUsername: 'suzuki', relationType: 'SECONDARY' },
    ],
    notes: [
      {
        content:
          '月次定例（2026/3/18）：消費税インボイス運用の棚卸し。来月から請求書様式を統一する方向で合意。',
        noteType: 'FOLLOW_UP',
        nextFollowUpAt: '2026-04-15T10:00:00+09:00',
      },
      {
        content:
          '行政側：技術者2名の在留更新スケジュールを共有済み。人事担当は佐藤様（内線312）。',
        noteType: 'MEMO',
      },
    ],
  },
  {
    code: 'CC-H002',
    type: 'COMPANY',
    name: '有限会社京都精密工業',
    phone: '075-771-8890',
    email: 'account@kyoto-seimitsu.example.jp',
    address: '京都府京都市南区吉祥院西ノ庄町18-7',
    serviceType: 'TAX',
    ownerUsername: 'suzuki',
    company: {
      corporationNumber: '5120001056789',
      fiscalMonth: 12,
      representativeName: '西村 拓也',
    },
    notes: [
      {
        content:
          '第9期決算の試算表ドラフト受領。減価償却資産の除却処理について追加資料依頼中。',
        noteType: 'GENERAL',
      },
    ],
  },
  {
    code: 'CC-H003',
    type: 'COMPANY',
    name: '合同会社フードラボ大阪',
    phone: '06-6121-3344',
    email: 'finance@foodlab-osaka.example.jp',
    address: '大阪府大阪市中央区南本町3-6-12',
    serviceType: 'TAX',
    ownerUsername: 'suzuki',
    company: {
      corporationNumber: '9123456789012',
      fiscalMonth: 9,
      representativeName: '橋本 奈緒',
    },
    staffRelations: [{ ownerUsername: 'suzuki', relationType: 'PRIMARY' }],
    notes: [
      {
        content:
          '外食チェーン向け卸の売上原価率が前期比+1.8pt。POS連携CSVの取り込みルールを来週確認。',
        noteType: 'FOLLOW_UP',
        nextFollowUpAt: '2026-04-08T14:00:00+09:00',
      },
    ],
  },
  {
    code: 'CC-H004',
    type: 'COMPANY',
    name: '株式会社リンクス不動産',
    phone: '045-228-9901',
    email: 'mgmt@links-re.example.jp',
    address: '神奈川県横浜市中区海岸通5-57 リンクス横浜ビル3F',
    serviceType: 'BOTH',
    ownerUsername: 'tanaka',
    company: {
      corporationNumber: '7020002034567',
      fiscalMonth: 6,
      representativeName: '大野 凛',
    },
    notes: [
      {
        content:
          '賃貸管理会社の源泉・消費税区分の整理表を送付。4月中に契約書スキャン一式を共有予定。',
        noteType: 'MEMO',
      },
    ],
  },
  {
    code: 'CC-H005',
    type: 'COMPANY',
    name: '医療法人社団さくら会',
    phone: '052-881-2200',
    email: 'keiri@sakuraikai.example.jp',
    address: '愛知県名古屋市昭和区御器所通2-18',
    serviceType: 'TAX',
    ownerUsername: 'suzuki',
    company: {
      corporationNumber: '3180004078901',
      fiscalMonth: 3,
      representativeName: '理事長 藤井 康弘',
    },
    notes: [
      {
        content:
          '医業収益と介護事業収益の按分ルールを税務上どう扱うか、来月専門家会議に同席依頼あり。',
        noteType: 'GENERAL',
      },
    ],
  },
  {
    code: 'CC-H006',
    type: 'COMPANY',
    name: '株式会社ネクストロジ',
    phone: '011-788-4455',
    email: 'cfo@nextlogi.example.jp',
    address: '北海道札幌市中央区北二条西3-1',
    serviceType: 'TAX',
    ownerUsername: 'admin',
    company: {
      corporationNumber: '9430001567890',
      fiscalMonth: 8,
      representativeName: '黒田 悠',
    },
  },
  {
    code: 'CC-H007',
    type: 'COMPANY',
    name: '有限会社福岡ロジスティクス',
    phone: '092-712-3300',
    email: 'ops@fukuoka-logi.example.jp',
    address: '福岡県福岡市博多区博多駅前2-8-1',
    serviceType: 'TAX',
    ownerUsername: 'tanaka',
    company: {
      corporationNumber: '8290001122334',
      fiscalMonth: 11,
      representativeName: '城戸 亮',
    },
  },
  {
    code: 'CC-P001',
    type: 'PERSONAL',
    name: '陳 嘉明',
    phone: '080-5522-1190',
    email: 'jiaming.chen.work@example.com',
    address: '東京都世田谷区三軒茶屋2-14-6 メゾン三茶201',
    serviceType: 'ADMIN',
    ownerUsername: 'tanaka',
    person: {
      nationality: '中国',
      residenceStatus: '技術・人文知識・国際業務',
      residenceExpireDate: '2027-08-31',
      remindDaysBefore: 90,
    },
    staffRelations: [{ ownerUsername: 'tanaka', relationType: 'PRIMARY' }],
    notes: [
      {
        content:
          '初回面談：現職ITベンチャー勤務。年収証明・源泉徴収票は会社側承認待ち。配偶者は家族滞在。',
        noteType: 'FOLLOW_UP',
        nextFollowUpAt: '2026-04-10T15:30:00+09:00',
      },
      {
        content: '中国語ネイティブ。メールは日中混在可。急ぎは電話希望。',
        noteType: 'MEMO',
      },
    ],
    visaCase: {
      caseType: '在留期間更新（技術・人文知識・国際業務）',
      caseStatus: 'IN_PROGRESS',
      expireDate: '2027-08-31',
      materialStatus: 'PARTIAL',
      feeStatus: 'NOT_BILLED',
      memo: '家族同時申請。児童は在学証明書の英訳が未着。',
      nextFollowUpAt: '2026-04-12T11:00:00+09:00',
      assignedOwnerUsername: 'tanaka',
      members: [
        {
          customerCode: 'CC-P001',
          memberRole: 'APPLICANT',
          isPrimary: true,
        },
        {
          customerCode: 'CC-P001-S',
          memberRole: 'SPOUSE',
          isPrimary: false,
        },
        {
          customerCode: 'CC-P001-C1',
          memberRole: 'CHILD',
          isPrimary: false,
        },
      ],
    },
  },
  {
    code: 'CC-P001-S',
    type: 'PERSONAL',
    name: '陳 秀英',
    phone: '080-5522-1191',
    email: 'xiuying.chen.home@example.com',
    address: '東京都世田谷区三軒茶屋2-14-6 メゾン三茶201',
    serviceType: 'ADMIN',
    ownerUsername: 'tanaka',
    person: {
      nationality: '中国',
      residenceStatus: '家族滞在',
      residenceExpireDate: '2027-08-31',
      isFamilyMember: true,
      familyRelation: 'SPOUSE',
      primaryCustomerCode: 'CC-P001',
      remindDaysBefore: 90,
    },
  },
  {
    code: 'CC-P001-C1',
    type: 'PERSONAL',
    name: '陳 子涵',
    phone: '',
    email: '',
    address: '東京都世田谷区三軒茶屋2-14-6 メゾン三茶201',
    serviceType: 'ADMIN',
    ownerUsername: 'tanaka',
    person: {
      nationality: '中国',
      residenceStatus: '家族滞在',
      residenceExpireDate: '2027-08-31',
      isFamilyMember: true,
      familyRelation: 'CHILD',
      primaryCustomerCode: 'CC-P001',
      remindDaysBefore: 120,
    },
  },
  {
    code: 'CC-P002',
    type: 'PERSONAL',
    name: 'パク・ミヨン',
    phone: '090-7788-4412',
    email: 'm.park.jp@example.com',
    address: '埼玉県川口市並木2-5-10',
    serviceType: 'ADMIN',
    ownerUsername: 'suzuki',
    person: {
      nationality: '韓国',
      residenceStatus: '永住者の配偶者等',
      residenceExpireDate: '2028-01-20',
      remindDaysBefore: 60,
    },
    notes: [
      {
        content:
          '配偶者は永住者。婚姻届・住民票は最新版を入手。韓国語資料の翻訳は当事務所指定フォーマットで進行。',
        noteType: 'MEMO',
      },
    ],
    visaCase: {
      caseType: '在留期間更新（永住者の配偶者等）',
      caseStatus: 'SUBMITTED',
      expireDate: '2028-01-20',
      materialStatus: 'COMPLETE',
      feeStatus: 'BILLED',
      memo: '入管提出済み。補正の可能性は低めだが結果待ち。',
      assignedOwnerUsername: 'suzuki',
      members: [
        {
          customerCode: 'CC-P002',
          memberRole: 'APPLICANT',
          isPrimary: true,
        },
        {
          customerCode: 'CC-P002-S',
          memberRole: 'SPOUSE',
          isPrimary: false,
        },
      ],
    },
  },
  {
    code: 'CC-P002-S',
    type: 'PERSONAL',
    name: 'キム・ジフン',
    phone: '090-7788-4413',
    email: 'j.kim.jp@example.com',
    address: '埼玉県川口市並木2-5-10',
    serviceType: 'ADMIN',
    ownerUsername: 'suzuki',
    person: {
      nationality: '韓国',
      residenceStatus: '永住者',
      residenceExpireDate: null,
      isFamilyMember: true,
      familyRelation: 'SPOUSE',
      primaryCustomerCode: 'CC-P002',
      remindDaysBefore: null,
    },
  },
  {
    code: 'CC-P003',
    type: 'PERSONAL',
    name: 'エマ・シュミット',
    phone: '070-2211-8844',
    email: 'emma.schmidt.jp@example.com',
    address: '東京都渋谷区恵比寿南1-5-5',
    serviceType: 'ADMIN',
    ownerUsername: 'tanaka',
    person: {
      nationality: 'ドイツ',
      residenceStatus: '特定技能1号',
      residenceExpireDate: '2026-11-10',
      remindDaysBefore: 45,
    },
    notes: [
      {
        content:
          '製造ライン勤務。技能試験合格証の写しは既に預かり済み。日本語は日常会話レベル。',
        noteType: 'GENERAL',
      },
    ],
    visaCase: {
      caseType: '在留期間更新（特定技能1号）',
      caseStatus: 'SUPPLEMENT',
      expireDate: '2026-11-10',
      materialStatus: 'PARTIAL',
      feeStatus: 'PARTIAL_PAID',
      memo: '所属機関からの雇用条件書の再発行待ち。',
      nextFollowUpAt: '2026-04-05T09:00:00+09:00',
      assignedOwnerUsername: 'tanaka',
      members: [
        {
          customerCode: 'CC-P003',
          memberRole: 'APPLICANT',
          isPrimary: true,
        },
      ],
    },
  },
  {
    code: 'CC-P004',
    type: 'PERSONAL',
    name: 'トラン・ホアン',
    phone: '080-9933-2201',
    email: 'hoang.tran.logi@example.com',
    address: '千葉県船橋市本町6-2-3',
    serviceType: 'ADMIN',
    ownerUsername: 'tanaka',
    person: {
      nationality: 'ベトナム',
      residenceStatus: '特定技能1号',
      residenceExpireDate: '2027-03-05',
      remindDaysBefore: 60,
    },
    visaCase: {
      caseType: '在留期間更新（特定技能1号）',
      caseStatus: 'IN_PROGRESS',
      expireDate: '2027-03-05',
      materialStatus: 'NOT_RECEIVED',
      feeStatus: 'NOT_BILLED',
      memo: '技能実習からの移行経緯あり。監理団体との連絡は毎週木曜。',
      members: [
        {
          customerCode: 'CC-P004',
          memberRole: 'APPLICANT',
          isPrimary: true,
        },
      ],
    },
  },
  {
    code: 'CC-P005',
    type: 'PERSONAL',
    name: 'ウィリアム・ブラウン',
    phone: '03-6450-8891',
    email: 'w.brown.consult@example.com',
    address: '東京都港区六本木7-18-5',
    serviceType: 'BOTH',
    ownerUsername: 'admin',
    person: {
      nationality: 'アメリカ合衆国',
      residenceStatus: '高度専門職1号（ロ）',
      residenceExpireDate: '2029-04-22',
      remindDaysBefore: 120,
    },
    notes: [
      {
        content:
          'コンサル契約は米国親会社とのクロスボーダー。税務は顧問契約とセットで鈴木担当。',
        noteType: 'MEMO',
      },
    ],
    staffRelations: [
      { ownerUsername: 'admin', relationType: 'PRIMARY' },
      { ownerUsername: 'suzuki', relationType: 'SUPPORT' },
    ],
  },
  {
    code: 'CC-P006',
    type: 'PERSONAL',
    name: 'シン・アウン',
    phone: '080-4411-0098',
    email: 'aung.sin.student@example.com',
    address: '京都府京都市左京区吉田牛ノ宮町12-3',
    serviceType: 'ADMIN',
    ownerUsername: 'suzuki',
    person: {
      nationality: 'ミャンマー',
      residenceStatus: '留学',
      residenceExpireDate: '2026-09-30',
      remindDaysBefore: 30,
    },
    notes: [
      {
        content:
          '大学院2年。次年度の在留資格変更（文化活動→就職）のシナリオを5月に面談予定。',
        noteType: 'FOLLOW_UP',
        nextFollowUpAt: '2026-05-20T13:00:00+09:00',
      },
    ],
  },
];
