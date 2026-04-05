import { Logger } from '@nestjs/common';
import type { QueryRunner } from 'typeorm';

import { createAppDataSource } from '../data-source';
import type {
  OwnerUsername,
  RichCustomerSeed,
  RichVisaCaseSeed,
} from './seed-customer-rich.data';
import { RICH_CUSTOMERS } from './seed-customer-rich.data';

interface IdRow {
  id: string;
}

type UserIdMap = Partial<Record<OwnerUsername, string>>;
type CustomerIdMap = Record<string, string>;

const log = new Logger('SeedCustomerRich');

/**
 * 将演示用户名解析为数据库用户主键映射，缺失键时回退到管理员账号。
 *
 * @param queryRunner - 当前事务使用的查询执行器
 * @returns 供负责人与案件担当引用的用户主键映射
 */
async function fetchUserIdMap(queryRunner: QueryRunner): Promise<UserIdMap> {
  const rows = (await queryRunner.query(
    `SELECT id, username FROM users WHERE username = ANY($1::text[])`,
    [['tanaka', 'suzuki', 'admin', 'yamamoto']],
  )) as Array<{ id: string; username: string }>;

  const map: UserIdMap = {};

  for (const row of rows) {
    map[row.username as OwnerUsername] = row.id;
  }

  if (!map.admin) {
    const adminRows = (await queryRunner.query(
      "SELECT id FROM users WHERE username = 'admin' LIMIT 1",
    )) as IdRow[];

    if (adminRows.length === 0) {
      throw new Error(
        '管理员用户不存在。请先执行 `npm run seed` 再运行本脚本。',
      );
    }

    map.admin = adminRows[0].id;
  }

  return map;
}

/**
 * 解析负责人用户名对应的数据库用户主键，未配置时返回 null。
 *
 * @param userMap - 用户名到用户主键的映射
 * @param username - 客户主档上的负责人登录名
 * @returns 可写入 `owner_user_id` 的用户主键或 null
 */
function resolveOwnerId(
  userMap: UserIdMap,
  username: OwnerUsername,
): string | null {
  return userMap[username] ?? userMap.admin ?? null;
}

/**
 * 写入企业客户的 `company_info` 扩展行。
 *
 * @param queryRunner - 当前事务使用的查询执行器
 * @param customerId - 已落库的客户主键
 * @param customer - 当前条目的演示数据
 * @returns 写入完成或跳过（非法人客户）后结束
 */
async function insertCompanyInfo(
  queryRunner: QueryRunner,
  customerId: string,
  customer: RichCustomerSeed,
): Promise<void> {
  if (customer.type !== 'COMPANY' || !customer.company) {
    return;
  }

  await queryRunner.query(
    `INSERT INTO company_info (
       id,
       customer_id,
       corporation_number,
       fiscal_month,
       representative_name
     )
     VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
    [
      customerId,
      customer.company.corporationNumber,
      customer.company.fiscalMonth,
      customer.company.representativeName,
    ],
  );
}

/**
 * 写入个人客户的 `person_info` 行，含家族成员与在留提醒字段。
 *
 * @param queryRunner - 当前事务使用的查询执行器
 * @param customerId - 已落库的客户主键
 * @param customer - 当前条目的演示数据
 * @param customerIds - 已解析的客户编码到主键映射（用于回填主申请人）
 * @returns 写入完成或跳过（非个人客户）后结束
 */
async function insertPersonInfo(
  queryRunner: QueryRunner,
  customerId: string,
  customer: RichCustomerSeed,
  customerIds: CustomerIdMap,
): Promise<void> {
  if (customer.type !== 'PERSONAL' || !customer.person) {
    return;
  }

  const p = customer.person;
  const primaryId = p.primaryCustomerCode
    ? (customerIds[p.primaryCustomerCode] ?? null)
    : null;

  if (p.primaryCustomerCode && !primaryId) {
    throw new Error(
      `家族成员 "${customer.code}" 引用的主申请人 "${p.primaryCustomerCode}" 未先写入，请调整数据顺序。`,
    );
  }

  await queryRunner.query(
    `INSERT INTO person_info (
       id,
       customer_id,
       nationality,
       residence_status,
       residence_expire_date,
       is_family_member,
       family_relation,
       primary_customer_id,
       remind_days_before
     )
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      customerId,
      p.nationality,
      p.residenceStatus,
      p.residenceExpireDate,
      p.isFamilyMember ?? false,
      p.familyRelation ?? null,
      primaryId,
      p.remindDaysBefore ?? null,
    ],
  );
}

/**
 * 写入客户与内部员工的担当关系，重复组合时静默跳过。
 *
 * @param queryRunner - 当前事务使用的查询执行器
 * @param customerId - 客户主键
 * @param userId - 员工用户主键
 * @param relationType - 主担当 / 副担当 / 支援
 * @returns 插入或跳过完成后结束
 */
async function insertStaffRelationIfAbsent(
  queryRunner: QueryRunner,
  customerId: string,
  userId: string,
  relationType: string,
): Promise<void> {
  await queryRunner.query(
    `INSERT INTO customer_staff_relations (id, customer_id, user_id, relation_type)
     VALUES (gen_random_uuid(), $1, $2, $3)
     ON CONFLICT (customer_id, user_id) DO NOTHING`,
    [customerId, userId, relationType],
  );
}

/**
 * 为客户主档追加跟进备注，可选写入下次跟进时刻。
 *
 * @param queryRunner - 当前事务使用的查询执行器
 * @param customerId - 客户主键
 * @param content - 备注正文
 * @param noteType - 备注分类
 * @param createdBy - 录入人用户主键
 * @param nextFollowUpAt - 下次跟进时刻，可为 null
 * @returns 插入完成后结束
 */
async function insertCustomerNote(
  queryRunner: QueryRunner,
  customerId: string,
  content: string,
  noteType: string,
  createdBy: string,
  nextFollowUpAt: string | null,
): Promise<void> {
  await queryRunner.query(
    `INSERT INTO notes (
       id,
       customer_id,
       content,
       note_type,
       created_by,
       next_follow_up_at
     )
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
    [customerId, content, noteType, createdBy, nextFollowUpAt],
  );
}

/**
 * 根据编码查找客户显示名称，用于案件家属快照字段。
 *
 * @param code - 客户编码
 * @returns 客户名称或编码回退
 */
function nameByCustomerCode(code: string): string {
  const row = RICH_CUSTOMERS.find((c) => c.code === code);

  return row?.name ?? code;
}

/**
 * 解析主申请人客户主键与幂等用 import_reference 字符串。
 *
 * @param visaSeed - 案件字段与成员列表
 * @param customerIds - 客户编码到主键映射
 * @returns 主申请人客户主键与取込参照キー
 */
function resolveVisaCasePrimaryRef(
  visaSeed: RichVisaCaseSeed,
  customerIds: CustomerIdMap,
): { primaryCustomerId: string; importRef: string } {
  const primaryMember = visaSeed.members.find((m) => m.isPrimary);

  if (!primaryMember) {
    throw new Error('visaCase.members 必须包含一名 isPrimary 主申请人。');
  }

  const primaryCustomerId = customerIds[primaryMember.customerCode];

  if (!primaryCustomerId) {
    throw new Error(`主申请人客户 "${primaryMember.customerCode}" 未找到。`);
  }

  return {
    primaryCustomerId,
    importRef: `SEED-RICH-${primaryMember.customerCode}`,
  };
}

/**
 * 写入签证案件主表一行并返回新案件主键。
 *
 * @param queryRunner - 当前事务使用的查询执行器
 * @param visaSeed - 案件业务字段
 * @param primaryCustomerId - 主申请人客户主键
 * @param importRef - 幂等取込参照キー
 * @param userMap - 用户登录名到主键映射
 * @returns 新建 `visa_cases.id`
 */
async function insertVisaCaseRow(
  queryRunner: QueryRunner,
  visaSeed: RichVisaCaseSeed,
  primaryCustomerId: string,
  importRef: string,
  userMap: UserIdMap,
): Promise<string> {
  const assignedTo = visaSeed.assignedOwnerUsername
    ? resolveOwnerId(userMap, visaSeed.assignedOwnerUsername)
    : null;
  const createdBy = resolveOwnerId(userMap, 'tanaka') ?? userMap.admin ?? null;
  const isFamilyCase = visaSeed.members.length > 1;

  const inserted = (await queryRunner.query(
    `INSERT INTO visa_cases (
       id,
       customer_id,
       case_type,
       case_status,
       is_family_case,
       family_link_mode,
       internal_primary_customer_id,
       assigned_to,
       expire_date,
       next_follow_up_at,
       material_status,
       fee_status,
       memo,
       import_reference,
       created_by
     )
     VALUES (
       gen_random_uuid(),
       $1, $2, $3, $4, $5, $6,
       $7, $8, $9, $10, $11, $12, $13, $14
     )
     RETURNING id`,
    [
      primaryCustomerId,
      visaSeed.caseType,
      visaSeed.caseStatus,
      isFamilyCase,
      isFamilyCase ? 'INTERNAL' : null,
      isFamilyCase ? primaryCustomerId : null,
      assignedTo,
      visaSeed.expireDate,
      visaSeed.nextFollowUpAt ?? null,
      visaSeed.materialStatus ?? null,
      visaSeed.feeStatus ?? null,
      visaSeed.memo ?? null,
      importRef,
      createdBy,
    ],
  )) as IdRow[];

  return inserted[0].id;
}

/**
 * 为已创建的签证案件写入 `visa_case_family_members` 多行。
 *
 * @param queryRunner - 当前事务使用的查询执行器
 * @param visaCaseId - 案件主键
 * @param visaSeed - 含成员列表的种子
 * @param customerIds - 客户编码到主键映射
 * @returns 全部成员行写入完成后结束
 */
async function insertVisaCaseMemberRows(
  queryRunner: QueryRunner,
  visaCaseId: string,
  visaSeed: RichVisaCaseSeed,
  customerIds: CustomerIdMap,
): Promise<void> {
  for (const m of visaSeed.members) {
    const memberCustomerId = customerIds[m.customerCode];

    if (!memberCustomerId) {
      throw new Error(`案件成员客户 "${m.customerCode}" 未找到。`);
    }

    await queryRunner.query(
      `INSERT INTO visa_case_family_members (
         id,
         visa_case_id,
         customer_id,
         member_role,
         is_primary,
         display_name_snapshot
       )
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
      [
        visaCaseId,
        memberCustomerId,
        m.memberRole,
        m.isPrimary,
        nameByCustomerCode(m.customerCode),
      ],
    );
  }
}

/**
 * 在幂等键控制下写入签证案件及案件级家属关联。
 *
 * @param queryRunner - 当前事务使用的查询执行器
 * @param visaSeed - 案件字段与成员列表
 * @param customerIds - 客户编码到主键映射
 * @param userMap - 用户登录名到主键映射
 * @returns 新建或已存在跳过后结束
 */
async function seedVisaCaseIfAbsent(
  queryRunner: QueryRunner,
  visaSeed: RichVisaCaseSeed,
  customerIds: CustomerIdMap,
  userMap: UserIdMap,
): Promise<void> {
  const { primaryCustomerId, importRef } = resolveVisaCasePrimaryRef(
    visaSeed,
    customerIds,
  );

  const existing = (await queryRunner.query(
    `SELECT id FROM visa_cases
     WHERE customer_id = $1 AND import_reference = $2 AND deleted_at IS NULL
     LIMIT 1`,
    [primaryCustomerId, importRef],
  )) as IdRow[];

  if (existing.length > 0) {
    log.log(`Visa case "${importRef}" already exists, skipped.`);
    return;
  }

  const visaCaseId = await insertVisaCaseRow(
    queryRunner,
    visaSeed,
    primaryCustomerId,
    importRef,
    userMap,
  );

  await insertVisaCaseMemberRows(
    queryRunner,
    visaCaseId,
    visaSeed,
    customerIds,
  );

  log.log(`Visa case "${importRef}" created (${visaSeed.caseType}).`);
}

/**
 * 若客户编码不存在则插入主档及扩展信息，否则仅回填 `customerIds`。
 *
 * @param queryRunner - 当前事务使用的查询执行器
 * @param customer - 单条高仿真客户种子
 * @param userMap - 用户主键映射
 * @param customerIds - 客户编码到主键的可变映射
 * @param noteAuthor - 备注与审计用录入人
 * @returns 处理完成后结束
 */
async function ensureRichCustomerRow(
  queryRunner: QueryRunner,
  customer: RichCustomerSeed,
  userMap: UserIdMap,
  customerIds: CustomerIdMap,
  noteAuthor: string,
): Promise<void> {
  const existingRows = (await queryRunner.query(
    'SELECT id FROM customers WHERE customer_code = $1',
    [customer.code],
  )) as IdRow[];

  if (existingRows.length > 0) {
    customerIds[customer.code] = existingRows[0].id;
    log.log(`Customer "${customer.code}" already exists, skipped.`);
    return;
  }

  const ownerId = resolveOwnerId(userMap, customer.ownerUsername);
  const phone = customer.phone.trim() === '' ? null : customer.phone;
  const email = customer.email.trim() === '' ? null : customer.email;

  const insertedRows = (await queryRunner.query(
    `INSERT INTO customers (
       id,
       customer_code,
       customer_type,
       customer_name,
       phone,
       email,
       address,
       service_type,
       owner_user_id,
       status,
       created_by
     )
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', $9)
     RETURNING id`,
    [
      customer.code,
      customer.type,
      customer.name,
      phone,
      email,
      customer.address,
      customer.serviceType,
      ownerId,
      noteAuthor,
    ],
  )) as IdRow[];

  const customerId = insertedRows[0].id;
  customerIds[customer.code] = customerId;

  await insertCompanyInfo(queryRunner, customerId, customer);
  await insertPersonInfo(queryRunner, customerId, customer, customerIds);

  const relations = customer.staffRelations ?? [
    { ownerUsername: customer.ownerUsername, relationType: 'PRIMARY' },
  ];

  for (const rel of relations) {
    const uid = resolveOwnerId(userMap, rel.ownerUsername);

    if (uid) {
      await insertStaffRelationIfAbsent(
        queryRunner,
        customerId,
        uid,
        rel.relationType,
      );
    }
  }

  for (const note of customer.notes ?? []) {
    await insertCustomerNote(
      queryRunner,
      customerId,
      note.content,
      note.noteType,
      noteAuthor,
      note.nextFollowUpAt ?? null,
    );
  }

  log.log(`Customer "${customer.code}" (${customer.name}) created.`);
}

/**
 * 在单事务内写入高仿真客户中心数据（主档、扩展表、担当、备注、签证案件）。
 *
 * @returns 种子脚本正常结束时结束
 */
async function seedCustomerRich(): Promise<void> {
  const dataSource = createAppDataSource(process.env, { logging: false });

  await dataSource.initialize();
  log.log('Database connected.');

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.startTransaction();

  try {
    const userMap = await fetchUserIdMap(queryRunner);
    const customerIds: CustomerIdMap = {};
    const noteAuthor =
      resolveOwnerId(userMap, 'tanaka') ?? userMap.admin ?? null;

    if (!noteAuthor) {
      throw new Error('无法解析备注录入人用户，请确保存在 admin 或 tanaka。');
    }

    for (const customer of RICH_CUSTOMERS) {
      await ensureRichCustomerRow(
        queryRunner,
        customer,
        userMap,
        customerIds,
        noteAuthor,
      );
    }

    for (const customer of RICH_CUSTOMERS) {
      if (customer.visaCase) {
        await seedVisaCaseIfAbsent(
          queryRunner,
          customer.visaCase,
          customerIds,
          userMap,
        );
      }
    }

    await queryRunner.commitTransaction();
    log.log('=== Customer rich seed completed ===');
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
    await dataSource.destroy();
  }
}

seedCustomerRich().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : '未知客户中心种子异常';
  const stack = error instanceof Error ? error.stack : undefined;

  log.error(`Customer rich seed failed: ${message}`, stack);
  process.exit(1);
});
