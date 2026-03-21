import { Controller, Get, Param } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger'
import {
  CustomerType,
  CustomerStatus,
  ServiceType,
  AdminCaseStatus,
  TaxContractStatus,
  MonthlyStatus,
  MaterialStatus,
  InvoiceStatus,
  InvoiceType,
  PaymentStatus,
  PaymentMethod,
  DepositTransactionType,
  UserStatus,
  TaskStatus,
  BusinessType,
  BillingCycle,
  PermissionType,
  NoteType,
  StaffRelationType,
} from '../../common/constants/enums'

interface DictItem {
  value: string
  label: string
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
}

const LABEL_MAPS: Record<string, Record<string, string>> = {
  customer_type: { [CustomerType.PERSONAL]: '個人', [CustomerType.COMPANY]: '法人' },
  customer_status: { [CustomerStatus.ACTIVE]: '有効', [CustomerStatus.INACTIVE]: '無効' },
  service_type: { [ServiceType.ADMIN]: '行政書士', [ServiceType.TAX]: '税理士', [ServiceType.BOTH]: '両方' },
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
  invoice_type: { [InvoiceType.ADMIN]: '行政', [InvoiceType.TAX]: '税務', [InvoiceType.INTERNAL]: '内部' },
  payment_status: {
    [PaymentStatus.REGISTERED]: '登録済み',
    [PaymentStatus.VERIFIED]: '消込済み',
    [PaymentStatus.REFUNDED]: '返金済み',
    [PaymentStatus.REVERSED]: '取消済み',
  },
  payment_method: { [PaymentMethod.BANK]: '銀行振込', [PaymentMethod.CASH]: '現金', [PaymentMethod.OTHER]: 'その他' },
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
  note_type: { [NoteType.FOLLOW_UP]: 'フォローアップ', [NoteType.MEMO]: 'メモ', [NoteType.GENERAL]: '一般' },
  staff_relation_type: {
    [StaffRelationType.PRIMARY]: '主担当',
    [StaffRelationType.SECONDARY]: '副担当',
    [StaffRelationType.SUPPORT]: 'サポート',
  },
}

function toItems(map: Record<string, string>): DictItem[] {
  return Object.entries(map).map(([value, label]) => ({ value, label }))
}

@ApiTags('辞書')
@Controller('dictionaries')
@ApiBearerAuth()
export class DictionaryController {
  @Get()
  @ApiOperation({ summary: '全辞書タイプ一覧' })
  listTypes() {
    return Object.keys(LABEL_MAPS)
  }

  @Get(':type')
  @ApiOperation({ summary: '指定タイプの辞書データ取得' })
  @ApiParam({
    name: 'type',
    description: '辞書タイプ（例: customer_type, admin_case_status）',
  })
  getByType(@Param('type') type: string): DictItem[] {
    const map = LABEL_MAPS[type]
    if (!map) return []
    return toItems(map)
  }

  @Get('actions/labels')
  @ApiOperation({ summary: 'アクションラベル一覧' })
  getActionLabels(): Record<string, string> {
    return ACTION_LABELS
  }
}
