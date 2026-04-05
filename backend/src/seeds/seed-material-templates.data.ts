import {
  MaterialItemScope,
  VisaCaseApplicationCategory,
} from '../common/constants/enums';

/**
 * 单条材料模板行定义，与 `material_template_items` 列语义一致。
 */
export type SeedMaterialTemplateItemDef = {
  groupName: string;
  itemName: string;
  scope: MaterialItemScope;
  sortOrder: number;
};

/**
 * 单套材料模板定义；`caseType` 须与 `visa_cases.case_type` 及字典 `visa_case_application_type` 的 value 一致。
 */
export type SeedMaterialTemplateDef = {
  caseType: VisaCaseApplicationCategory;
  displayName: string;
  items: SeedMaterialTemplateItemDef[];
};

/**
 * 常用签证申请类目的默认材料模板（日文项目名，与事务所内部用语对齐）。
 *
 * 与 `docs/22` 模板层一致：仅作新环境/首次 `npm run seed` 时的基础数据；已存在同 `case_type` 活跃模板时跳过。
 */
export const MATERIAL_TEMPLATE_BASE_SEEDS: readonly SeedMaterialTemplateDef[] =
  [
    {
      caseType: VisaCaseApplicationCategory.TECH_HUMANITIES_INTERNATIONAL,
      displayName: '技術・人文知識・国際業務（標準テンプレ）',
      items: [
        {
          groupName: '申請共通',
          itemName: '申請書・所定様式',
          scope: MaterialItemScope.CASE,
          sortOrder: 10,
        },
        {
          groupName: '申請共通',
          itemName: '手数料納付証明',
          scope: MaterialItemScope.CASE,
          sortOrder: 20,
        },
        {
          groupName: '勤務先・会社',
          itemName: '雇用契約書（又は労働条件通知書）',
          scope: MaterialItemScope.CASE,
          sortOrder: 30,
        },
        {
          groupName: '勤務先・会社',
          itemName: '会社概要・決算・登記等（要否は案件により調整）',
          scope: MaterialItemScope.CASE,
          sortOrder: 40,
        },
        {
          groupName: '申請人本人',
          itemName: 'パスポート（写し）',
          scope: MaterialItemScope.MEMBER,
          sortOrder: 50,
        },
        {
          groupName: '申請人本人',
          itemName: '在留カード（両面写し）',
          scope: MaterialItemScope.MEMBER,
          sortOrder: 60,
        },
        {
          groupName: '申請人本人',
          itemName: '証明写真',
          scope: MaterialItemScope.MEMBER,
          sortOrder: 70,
        },
        {
          groupName: '申請人本人',
          itemName: '住民票（全体）・その他身分関係',
          scope: MaterialItemScope.MEMBER,
          sortOrder: 80,
        },
        {
          groupName: '申請人本人',
          itemName: '課税・納税証明等（要否は案件により調整）',
          scope: MaterialItemScope.MEMBER,
          sortOrder: 90,
        },
      ],
    },
    {
      caseType: VisaCaseApplicationCategory.STARTUP,
      displayName: '経営・管理（標準テンプレ）',
      items: [
        {
          groupName: '事業・法人',
          itemName: '登記簿謄本（又は履歴事項全部証明書）',
          scope: MaterialItemScope.CASE,
          sortOrder: 10,
        },
        {
          groupName: '事業・法人',
          itemName: '決算書・試算表・納税資料（要否は案件により調整）',
          scope: MaterialItemScope.CASE,
          sortOrder: 20,
        },
        {
          groupName: '事業・法人',
          itemName: '事業計画書・収支見込',
          scope: MaterialItemScope.CASE,
          sortOrder: 30,
        },
        {
          groupName: '事業・法人',
          itemName: '事業所賃貸借契約等（該当時）',
          scope: MaterialItemScope.CASE,
          sortOrder: 40,
        },
        {
          groupName: '申請共通',
          itemName: '申請書・所定様式',
          scope: MaterialItemScope.CASE,
          sortOrder: 50,
        },
        {
          groupName: '申請共通',
          itemName: '手数料納付証明',
          scope: MaterialItemScope.CASE,
          sortOrder: 60,
        },
        {
          groupName: '申請人本人',
          itemName: 'パスポート（写し）',
          scope: MaterialItemScope.MEMBER,
          sortOrder: 70,
        },
        {
          groupName: '申請人本人',
          itemName: '在留カード（両面写し）',
          scope: MaterialItemScope.MEMBER,
          sortOrder: 80,
        },
        {
          groupName: '申請人本人',
          itemName: '証明写真',
          scope: MaterialItemScope.MEMBER,
          sortOrder: 90,
        },
      ],
    },
    {
      caseType: VisaCaseApplicationCategory.FAMILY_STAY,
      displayName: '家族滞在（標準テンプレ）',
      items: [
        {
          groupName: '申請共通',
          itemName: '申請書・所定様式',
          scope: MaterialItemScope.CASE,
          sortOrder: 10,
        },
        {
          groupName: '申請共通',
          itemName: '親族関係を証する資料',
          scope: MaterialItemScope.CASE,
          sortOrder: 20,
        },
        {
          groupName: '申請共通',
          itemName: '扶養者の職業・収入を証する資料',
          scope: MaterialItemScope.CASE,
          sortOrder: 30,
        },
        {
          groupName: '申請共通',
          itemName: '手数料納付証明',
          scope: MaterialItemScope.CASE,
          sortOrder: 40,
        },
        {
          groupName: '対象者（各員）',
          itemName: 'パスポート（写し）',
          scope: MaterialItemScope.MEMBER,
          sortOrder: 50,
        },
        {
          groupName: '対象者（各員）',
          itemName: '在留カード（両面写し）',
          scope: MaterialItemScope.MEMBER,
          sortOrder: 60,
        },
        {
          groupName: '対象者（各員）',
          itemName: '住民票（全体）',
          scope: MaterialItemScope.MEMBER,
          sortOrder: 70,
        },
      ],
    },
    {
      caseType: VisaCaseApplicationCategory.DEPENDENT_SPOUSE,
      displayName: '配偶者等（家族）（標準テンプレ）',
      items: [
        {
          groupName: '申請共通',
          itemName: '申請書・所定様式',
          scope: MaterialItemScope.CASE,
          sortOrder: 10,
        },
        {
          groupName: '申請共通',
          itemName: '婚姻・身分関係を証する資料',
          scope: MaterialItemScope.CASE,
          sortOrder: 20,
        },
        {
          groupName: '申請共通',
          itemName: '扶養者の在留・職業・収入を証する資料',
          scope: MaterialItemScope.CASE,
          sortOrder: 30,
        },
        {
          groupName: '申請共通',
          itemName: '手数料納付証明',
          scope: MaterialItemScope.CASE,
          sortOrder: 40,
        },
        {
          groupName: '対象者（各員）',
          itemName: 'パスポート（写し）',
          scope: MaterialItemScope.MEMBER,
          sortOrder: 50,
        },
        {
          groupName: '対象者（各員）',
          itemName: '在留カード（両面写し）',
          scope: MaterialItemScope.MEMBER,
          sortOrder: 60,
        },
        {
          groupName: '対象者（各員）',
          itemName: '住民票（全体）・納税関係（要否は案件により調整）',
          scope: MaterialItemScope.MEMBER,
          sortOrder: 70,
        },
      ],
    },
    {
      caseType: VisaCaseApplicationCategory.PR,
      displayName: '永住許可（標準テンプレ）',
      items: [
        {
          groupName: '申請共通',
          itemName: '永住許可申請書・所定様式',
          scope: MaterialItemScope.CASE,
          sortOrder: 10,
        },
        {
          groupName: '申請共通',
          itemName: '理解度を示す資料・質素書類等（要否は案件により調整）',
          scope: MaterialItemScope.CASE,
          sortOrder: 20,
        },
        {
          groupName: '申請共通',
          itemName: '手数料納付証明',
          scope: MaterialItemScope.CASE,
          sortOrder: 30,
        },
        {
          groupName: '申請人本人',
          itemName: 'パスポート（写し）',
          scope: MaterialItemScope.MEMBER,
          sortOrder: 40,
        },
        {
          groupName: '申請人本人',
          itemName: '在留カード（両面写し）',
          scope: MaterialItemScope.MEMBER,
          sortOrder: 50,
        },
        {
          groupName: '申請人本人',
          itemName: '住民票（各種）',
          scope: MaterialItemScope.MEMBER,
          sortOrder: 60,
        },
        {
          groupName: '申請人本人',
          itemName: '納税・年金・雇用保険等（要否は案件により調整）',
          scope: MaterialItemScope.MEMBER,
          sortOrder: 70,
        },
      ],
    },
    {
      caseType: VisaCaseApplicationCategory.STUDENT,
      displayName: '留学（標準テンプレ）',
      items: [
        {
          groupName: '学校・在籍',
          itemName: '入学許可・在籍証明等',
          scope: MaterialItemScope.CASE,
          sortOrder: 10,
        },
        {
          groupName: '学校・在籍',
          itemName: '出席・成績・課程等（要否は案件により調整）',
          scope: MaterialItemScope.CASE,
          sortOrder: 20,
        },
        {
          groupName: '経済能力',
          itemName: '経費支弁を証する資料',
          scope: MaterialItemScope.CASE,
          sortOrder: 30,
        },
        {
          groupName: '申請共通',
          itemName: '申請書・所定様式',
          scope: MaterialItemScope.CASE,
          sortOrder: 40,
        },
        {
          groupName: '申請共通',
          itemName: '手数料納付証明',
          scope: MaterialItemScope.CASE,
          sortOrder: 50,
        },
        {
          groupName: '申請人本人',
          itemName: 'パスポート（写し）',
          scope: MaterialItemScope.MEMBER,
          sortOrder: 60,
        },
        {
          groupName: '申請人本人',
          itemName: '在留カード（両面写し）',
          scope: MaterialItemScope.MEMBER,
          sortOrder: 70,
        },
        {
          groupName: '申請人本人',
          itemName: '証明写真',
          scope: MaterialItemScope.MEMBER,
          sortOrder: 80,
        },
      ],
    },
    {
      caseType: VisaCaseApplicationCategory.WORK_OTHER,
      displayName: '就労（その他）（標準テンプレ）',
      items: [
        {
          groupName: '申請共通',
          itemName: '申請書・所定様式・理由書（該当時）',
          scope: MaterialItemScope.CASE,
          sortOrder: 10,
        },
        {
          groupName: '勤務先',
          itemName: '雇用・勤務に関する資料（該当時）',
          scope: MaterialItemScope.CASE,
          sortOrder: 20,
        },
        {
          groupName: '申請共通',
          itemName: '手数料納付証明',
          scope: MaterialItemScope.CASE,
          sortOrder: 30,
        },
        {
          groupName: '申請人本人',
          itemName: 'パスポート（写し）',
          scope: MaterialItemScope.MEMBER,
          sortOrder: 40,
        },
        {
          groupName: '申請人本人',
          itemName: '在留カード（両面写し）',
          scope: MaterialItemScope.MEMBER,
          sortOrder: 50,
        },
        {
          groupName: '申請人本人',
          itemName: '住民票・納税関係（要否は案件により調整）',
          scope: MaterialItemScope.MEMBER,
          sortOrder: 60,
        },
      ],
    },
    {
      caseType: VisaCaseApplicationCategory.NATURALIZATION,
      displayName: '帰化（標準テンプレ）',
      items: [
        {
          groupName: '申請共通',
          itemName: '帰化申請書・所定様式',
          scope: MaterialItemScope.CASE,
          sortOrder: 10,
        },
        {
          groupName: '身元・生活',
          itemName: '親族関係・職歴・収入等の概要資料',
          scope: MaterialItemScope.CASE,
          sortOrder: 20,
        },
        {
          groupName: '申請共通',
          itemName: '手数料納付証明',
          scope: MaterialItemScope.CASE,
          sortOrder: 30,
        },
        {
          groupName: '申請人本人',
          itemName: 'パスポート・国籍証明等',
          scope: MaterialItemScope.MEMBER,
          sortOrder: 40,
        },
        {
          groupName: '申請人本人',
          itemName: '戸籍・身分関係（本国・日本）',
          scope: MaterialItemScope.MEMBER,
          sortOrder: 50,
        },
        {
          groupName: '申請人本人',
          itemName: '住民票（各種）',
          scope: MaterialItemScope.MEMBER,
          sortOrder: 60,
        },
      ],
    },
    {
      caseType: VisaCaseApplicationCategory.OTHER,
      displayName: 'その他（汎用テンプレ）',
      items: [
        {
          groupName: '申請共通',
          itemName: '申請書・所定様式',
          scope: MaterialItemScope.CASE,
          sortOrder: 10,
        },
        {
          groupName: '申請共通',
          itemName: '理由書・補足説明（該当時）',
          scope: MaterialItemScope.CASE,
          sortOrder: 20,
        },
        {
          groupName: '申請共通',
          itemName: '手数料納付証明',
          scope: MaterialItemScope.CASE,
          sortOrder: 30,
        },
        {
          groupName: '対象者（各員）',
          itemName: 'パスポート（写し）',
          scope: MaterialItemScope.MEMBER,
          sortOrder: 40,
        },
        {
          groupName: '対象者（各員）',
          itemName: '在留カード（両面写し）',
          scope: MaterialItemScope.MEMBER,
          sortOrder: 50,
        },
      ],
    },
  ];
