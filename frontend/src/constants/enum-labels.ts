import { i18n } from '@/i18n'

import type {
  AdminCaseStatus,
  AuditActionType,
  AuditTargetType,
  BillingCycle,
  BusinessType,
  CustomerStatus,
  CustomerType,
  DepositTransactionType,
  FileAccessAction,
  InvoiceStatus,
  InvoiceType,
  LoginType,
  MaterialStatus,
  MonthlyStatus,
  NoteType,
  OperationResult,
  PaymentMethod,
  PaymentStatus,
  PermissionType,
  ServiceType,
  StaffRelationType,
  TaskStatus,
  TaxContractStatus,
  UserStatus,
} from './enums'

/**
 * 为枚举值构造随当前语言自动切换的标签映射表。
 *
 * 返回的对象通过 Proxy 在读取属性时动态选择日文或中文标签，
 * 用于保证下拉选项、详情页标签等常量展示始终与 i18n 当前语言一致。
 *
 * @param ja - 以枚举值为键的日文标签映射
 * @param zhCN - 以枚举值为键的简体中文标签映射
 * @returns 可按枚举值读取本地化文案的标签映射对象
 */
function createLocalizedLabelMap<T extends string>(
  ja: Record<T, string>,
  zhCN: Record<T, string>,
): Record<T, string> {
  const keys = Object.keys(ja) as T[];

  return new Proxy({} as Record<T, string>, {
    get(_target, prop) {
      if (typeof prop !== "string" || !keys.includes(prop as T))
        return undefined;
      const currentLocale = i18n.global.locale.value;
      const labels = currentLocale === "zh-CN" ? zhCN : ja;
      return labels[prop as T];
    },
    ownKeys() {
      void i18n.global.locale.value;
      return keys;
    },
    getOwnPropertyDescriptor(_target, prop) {
      if (typeof prop !== "string" || !keys.includes(prop as T))
        return undefined;
      return {
        enumerable: true,
        configurable: true,
      };
    },
  });
}

export const CustomerTypeLabel = createLocalizedLabelMap<CustomerType>(
  {
    PERSONAL: "個人",
    COMPANY: "法人",
  },
  {
    PERSONAL: "个人",
    COMPANY: "法人",
  },
);

export const ServiceTypeLabel = createLocalizedLabelMap<ServiceType>(
  {
    ADMIN: "行政書士",
    TAX: "税理士",
    BOTH: "両方",
  },
  {
    ADMIN: "行政书士事务",
    TAX: "税理士",
    BOTH: "两者",
  },
);

export const CustomerStatusLabel = createLocalizedLabelMap<CustomerStatus>(
  {
    ACTIVE: "有効",
    INACTIVE: "無効",
  },
  {
    ACTIVE: "有效",
    INACTIVE: "无效",
  },
);

export const AdminCaseStatusLabel = createLocalizedLabelMap<AdminCaseStatus>(
  {
    DRAFT: "下書き",
    ACCEPTED: "受付中",
    MATERIAL_PENDING: "資料待ち",
    SUBMITTED: "提出済み",
    APPROVED: "許可済み",
    REJECTED: "不許可",
    COMPLETED: "完了",
    CANCELLED: "取消",
  },
  {
    DRAFT: "草稿",
    ACCEPTED: "受理中",
    MATERIAL_PENDING: "待补资料",
    SUBMITTED: "已提交",
    APPROVED: "已许可",
    REJECTED: "不许可",
    COMPLETED: "已完成",
    CANCELLED: "已取消",
  },
);

export const TaxContractStatusLabel =
  createLocalizedLabelMap<TaxContractStatus>(
    {
      ACTIVE: "有効",
      EXPIRED: "期限切れ",
      TERMINATED: "解約済み",
    },
    {
      ACTIVE: "有效",
      EXPIRED: "已过期",
      TERMINATED: "已解约",
    },
  );

export const MonthlyStatusLabel = createLocalizedLabelMap<MonthlyStatus>(
  {
    NOT_STARTED: "未着手",
    IN_PROGRESS: "作業中",
    COMPLETED: "完了",
  },
  {
    NOT_STARTED: "未开始",
    IN_PROGRESS: "进行中",
    COMPLETED: "已完成",
  },
);

export const MaterialStatusLabel = createLocalizedLabelMap<MaterialStatus>(
  {
    NOT_RECEIVED: "未受領",
    PARTIAL: "一部受領",
    COMPLETE: "受領完了",
  },
  {
    NOT_RECEIVED: "未接收",
    PARTIAL: "部分接收",
    COMPLETE: "接收完成",
  },
);

export const InvoiceStatusLabel = createLocalizedLabelMap<InvoiceStatus>(
  {
    DRAFT: "下書き",
    SENT: "送付済み",
    PARTIAL: "一部入金",
    PAID: "入金完了",
    VOID: "無効",
  },
  {
    DRAFT: "草稿",
    SENT: "已发送",
    PARTIAL: "部分收款",
    PAID: "收款完成",
    VOID: "已作废",
  },
);

export const PaymentStatusLabel = createLocalizedLabelMap<PaymentStatus>(
  {
    REGISTERED: "登録済み",
    VERIFIED: "消込済み",
    REFUNDED: "返金済み",
    REVERSED: "取消済み",
  },
  {
    REGISTERED: "已登记",
    VERIFIED: "已核销",
    REFUNDED: "已退款",
    REVERSED: "已冲销",
  },
);

export const PaymentMethodLabel = createLocalizedLabelMap<PaymentMethod>(
  {
    BANK: "銀行振込",
    CASH: "現金",
    OTHER: "その他",
  },
  {
    BANK: "银行转账",
    CASH: "现金",
    OTHER: "其他",
  },
);

export const UserStatusLabel = createLocalizedLabelMap<UserStatus>(
  {
    ACTIVE: "有効",
    INACTIVE: "無効",
  },
  {
    ACTIVE: "有效",
    INACTIVE: "无效",
  },
);

export const TaskStatusLabel = createLocalizedLabelMap<TaskStatus>(
  {
    TODO: "未着手",
    DOING: "作業中",
    DONE: "完了",
    CANCELLED: "取消",
  },
  {
    TODO: "未开始",
    DOING: "进行中",
    DONE: "已完成",
    CANCELLED: "已取消",
  },
);

export const BusinessTypeLabel = createLocalizedLabelMap<BusinessType>(
  {
    CUSTOMER: "顧客",
    ADMIN: "行政",
    TAX: "税務",
    FINANCE: "財務",
    INTERNAL: "内部",
  },
  {
    CUSTOMER: "客户",
    ADMIN: "行政",
    TAX: "税务",
    FINANCE: "财务",
    INTERNAL: "内部",
  },
);

export const BillingCycleLabel = createLocalizedLabelMap<BillingCycle>(
  {
    MONTHLY: "毎月",
    QUARTERLY: "四半期",
    YEARLY: "年次",
  },
  {
    MONTHLY: "每月",
    QUARTERLY: "每季度",
    YEARLY: "每年",
  },
);

export const DepositTransactionTypeLabel =
  createLocalizedLabelMap<DepositTransactionType>(
    {
      RECHARGE: "チャージ",
      OFFSET: "充当",
      REFUND: "返金",
      ADJUSTMENT: "調整",
    },
    {
      RECHARGE: "充值",
      OFFSET: "冲抵",
      REFUND: "退款",
      ADJUSTMENT: "调整",
    },
  );

export const PermissionTypeLabel = createLocalizedLabelMap<PermissionType>(
  {
    MENU: "メニュー",
    PAGE: "ページ",
    BUTTON: "ボタン",
  },
  {
    MENU: "菜单",
    PAGE: "页面",
    BUTTON: "按钮",
  },
);

export const FileAccessActionLabel = createLocalizedLabelMap<FileAccessAction>(
  {
    DOWNLOAD: "ダウンロード",
    VIEW: "閲覧",
    DELETE: "削除",
  },
  {
    DOWNLOAD: "下载",
    VIEW: "查看",
    DELETE: "删除",
  },
);

export const OperationResultLabel = createLocalizedLabelMap<OperationResult>(
  {
    SUCCESS: "成功",
    FAILURE: "失敗",
  },
  {
    SUCCESS: "成功",
    FAILURE: "失败",
  },
);

export const NoteTypeLabel = createLocalizedLabelMap<NoteType>(
  {
    FOLLOW_UP: "フォローアップ",
    MEMO: "メモ",
    GENERAL: "一般",
  },
  {
    FOLLOW_UP: "跟进",
    MEMO: "备忘",
    GENERAL: "一般",
  },
);

export const StaffRelationTypeLabel =
  createLocalizedLabelMap<StaffRelationType>(
    {
      PRIMARY: "主担当",
      SECONDARY: "副担当",
      SUPPORT: "サポート",
    },
    {
      PRIMARY: "主担当",
      SECONDARY: "副担当",
      SUPPORT: "支持",
    },
  );

export const InvoiceTypeLabel = createLocalizedLabelMap<InvoiceType>(
  {
    ADMIN: "行政",
    TAX: "税務",
    INTERNAL: "内部",
  },
  {
    ADMIN: "行政",
    TAX: "税务",
    INTERNAL: "内部",
  },
);

export const AuditActionTypeLabel = createLocalizedLabelMap<AuditActionType>(
  {
    CREATE: "作成",
    UPDATE: "更新",
    DELETE: "削除",
    RESTORE: "復元",
    STATUS_CHANGE: "ステータス変更",
    LOGIN: "ログイン",
    LOGOUT: "ログアウト",
    UPLOAD: "アップロード",
    DOWNLOAD: "ダウンロード",
    VOID: "無効化",
    PASSWORD_CHANGE: "パスワード変更",
  },
  {
    CREATE: "创建",
    UPDATE: "更新",
    DELETE: "删除",
    RESTORE: "恢复",
    STATUS_CHANGE: "状态变更",
    LOGIN: "登录",
    LOGOUT: "登出",
    UPLOAD: "上传",
    DOWNLOAD: "下载",
    VOID: "作废",
    PASSWORD_CHANGE: "修改密码",
  },
);

export const AuditTargetTypeLabel = createLocalizedLabelMap<AuditTargetType>(
  {
    CUSTOMER: "顧客",
    ADMIN_CASE: "行政案件",
    TAX_CONTRACT: "税務契約",
    TAX_PERIOD: "月次期間",
    INVOICE: "請求書",
    PAYMENT: "入金",
    DEPOSIT: "預り金",
    FILE: "ファイル",
    USER: "ユーザー",
    ROLE: "ロール",
    NOTE: "メモ",
    INTERVIEW: "面談",
    SYSTEM: "システム",
  },
  {
    CUSTOMER: "客户",
    ADMIN_CASE: "行政案件",
    TAX_CONTRACT: "税务合同",
    TAX_PERIOD: "月度期间",
    INVOICE: "发票",
    PAYMENT: "收款",
    DEPOSIT: "预收款",
    FILE: "文件",
    USER: "用户",
    ROLE: "角色",
    NOTE: "备注",
    INTERVIEW: "面谈",
    SYSTEM: "系统",
  },
);

export const LoginTypeLabel = createLocalizedLabelMap<LoginType>(
  {
    LOGIN: "ログイン",
    LOGOUT: "ログアウト",
  },
  {
    LOGIN: "登录",
    LOGOUT: "登出",
  },
);
