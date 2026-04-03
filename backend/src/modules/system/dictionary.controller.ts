import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import {
  AdminCaseStatus,
  BillingCycle,
  BusinessType,
  CustomerStatus,
  CustomerType,
  DepositTransactionType,
  InvoiceStatus,
  InvoiceType,
  MaterialStatus,
  MonthlyStatus,
  NoteType,
  PaymentMethod,
  PaymentStatus,
  PermissionType,
  ServiceType,
  StaffRelationType,
  TaskStatus,
  TaxContractStatus,
  UserStatus,
} from '../../common/constants/enums';

interface DictItem {
  value: string;
  label: string;
}

const ACTION_LABELS: Record<string, string> = {
  list: '一覧',
  detail: '詳細',
  create: '新規作成',
  edit: '編集',
  delete: '削除',
  void: '無効化',
  upload: 'アップロード',
  download: 'ダウンロード',
  user_manage: 'ユーザー管理',
  role_manage: 'ロール管理',
  dict_manage: '辞書管理',
  view: '閲覧',
};

const LABEL_MAPS: Record<string, Record<string, string>> = {
  customer_type: {
    [CustomerType.PERSONAL]: '個人',
    [CustomerType.COMPANY]: '法人',
  },
  customer_status: {
    [CustomerStatus.ACTIVE]: '有効',
    [CustomerStatus.INACTIVE]: '無効',
  },
  service_type: {
    [ServiceType.ADMIN]: '行政書士',
    [ServiceType.TAX]: '税理士',
    [ServiceType.BOTH]: '両方',
  },
  admin_case_status: {
    [AdminCaseStatus.DRAFT]: '下書き',
    [AdminCaseStatus.ACCEPTED]: '受付中',
    [AdminCaseStatus.MATERIAL_PENDING]: '資料待ち',
    [AdminCaseStatus.SUBMITTED]: '提出済み',
    [AdminCaseStatus.APPROVED]: '許可済み',
    [AdminCaseStatus.REJECTED]: '不許可',
    [AdminCaseStatus.COMPLETED]: '完了',
    [AdminCaseStatus.CANCELLED]: '取消',
  },
  tax_contract_status: {
    [TaxContractStatus.ACTIVE]: '有効',
    [TaxContractStatus.EXPIRED]: '期限切れ',
    [TaxContractStatus.TERMINATED]: '解約済み',
  },
  monthly_status: {
    [MonthlyStatus.NOT_STARTED]: '未着手',
    [MonthlyStatus.IN_PROGRESS]: '作業中',
    [MonthlyStatus.COMPLETED]: '完了',
  },
  material_status: {
    [MaterialStatus.NOT_RECEIVED]: '未受領',
    [MaterialStatus.PARTIAL]: '一部受領',
    [MaterialStatus.COMPLETE]: '受領完了',
  },
  invoice_status: {
    [InvoiceStatus.DRAFT]: '下書き',
    [InvoiceStatus.SENT]: '送付済み',
    [InvoiceStatus.PARTIAL]: '一部入金',
    [InvoiceStatus.PAID]: '入金完了',
    [InvoiceStatus.VOID]: '無効',
  },
  invoice_type: {
    [InvoiceType.ADMIN]: '行政',
    [InvoiceType.TAX]: '税務',
    [InvoiceType.INTERNAL]: '内部',
  },
  payment_status: {
    [PaymentStatus.REGISTERED]: '登録済み',
    [PaymentStatus.VERIFIED]: '消込済み',
    [PaymentStatus.REFUNDED]: '返金済み',
    [PaymentStatus.REVERSED]: '取消済み',
  },
  payment_method: {
    [PaymentMethod.BANK]: '銀行振込',
    [PaymentMethod.CASH]: '現金',
    [PaymentMethod.OTHER]: 'その他',
  },
  deposit_transaction_type: {
    [DepositTransactionType.RECHARGE]: 'チャージ',
    [DepositTransactionType.OFFSET]: '充当',
    [DepositTransactionType.REFUND]: '返金',
    [DepositTransactionType.ADJUSTMENT]: '調整',
  },
  user_status: { [UserStatus.ACTIVE]: '有効', [UserStatus.INACTIVE]: '無効' },
  task_status: {
    [TaskStatus.TODO]: '未着手',
    [TaskStatus.DOING]: '作業中',
    [TaskStatus.DONE]: '完了',
    [TaskStatus.CANCELLED]: '取消',
  },
  business_type: {
    [BusinessType.CUSTOMER]: '顧客',
    [BusinessType.ADMIN]: '行政',
    [BusinessType.TAX]: '税務',
    [BusinessType.FINANCE]: '財務',
    [BusinessType.INTERNAL]: '内部',
  },
  billing_cycle: {
    [BillingCycle.MONTHLY]: '毎月',
    [BillingCycle.QUARTERLY]: '四半期',
    [BillingCycle.YEARLY]: '年次',
  },
  permission_type: {
    [PermissionType.MENU]: 'メニュー',
    [PermissionType.PAGE]: 'ページ',
    [PermissionType.BUTTON]: 'ボタン',
  },
  note_type: {
    [NoteType.FOLLOW_UP]: 'フォローアップ',
    [NoteType.MEMO]: 'メモ',
    [NoteType.GENERAL]: '一般',
  },
  staff_relation_type: {
    [StaffRelationType.PRIMARY]: '主担当',
    [StaffRelationType.SECONDARY]: '副担当',
    [StaffRelationType.SUPPORT]: 'サポート',
  },
};

/**
 * 将枚举值映射转换为前端下拉可用的字典项数组。
 *
 * @param map - 以枚举值为键、展示文本为值的字典映射
 * @returns 适用于选项组件的 value/label 结构数组
 */
function toItems(map: Record<string, string>): DictItem[] {
  return Object.entries(map).map(([value, label]) => ({ value, label }));
}

@ApiTags('辞書')
@Controller('dictionaries')
@ApiBearerAuth()
export class DictionaryController {
  /**
   * 返回系统内置的全部字典类型标识。
   *
   * @returns 可用于后续按类型查询字典项的类型名数组
   */
  @Get()
  @ApiOperation({ summary: '全辞書タイプ一覧' })
  listTypes(): string[] {
    return Object.keys(LABEL_MAPS);
  }

  /**
   * 返回权限动作编码对应的展示文案。
   *
   * @returns 以动作编码为键、日文标签为值的映射对象
   */
  @Get('actions/labels')
  @ApiOperation({ summary: 'アクションラベル一覧' })
  getActionLabels(): Record<string, string> {
    return ACTION_LABELS;
  }

  /**
   * 按字典类型返回对应的枚举选项列表。
   *
   * 未注册的类型直接返回空数组，避免前端字典初始化阶段因未知键报错。
   *
   * @param type - 字典类型标识，例如 customer_type 或 admin_case_status
   * @returns 对应类型的字典项数组；类型不存在时返回空数组
   */
  @Get(':type')
  @ApiOperation({ summary: '指定タイプの辞書データ取得' })
  @ApiParam({
    name: 'type',
    description: '辞書タイプ（例: customer_type, admin_case_status）',
  })
  getByType(@Param('type') type: string): DictItem[] {
    const map = LABEL_MAPS[type];
    if (!map) {
      return [];
    }

    return toItems(map);
  }
}
