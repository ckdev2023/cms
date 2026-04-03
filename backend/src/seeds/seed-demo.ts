import { Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import type { QueryRunner } from 'typeorm';

import { createAppDataSource } from '../data-source';
import type { CustomerSeed } from './seed-demo.data';
import {
  ADMIN_CASE_TEMPLATES,
  CUSTOMERS,
  INVOICE_TEMPLATES,
  NOTE_TEMPLATES,
  TAX_CONTRACT_TEMPLATES,
  TEST_USERS,
} from './seed-demo.data';

interface IdRow {
  id: string;
}

interface RoleCodeRow extends IdRow {
  role_code: string;
}

type UserIdMap = Record<string, string>;
type CustomerIdMap = Record<string, string>;
type RoleIdMap = Record<string, string>;

const seedDemoLogger = new Logger('SeedDemoScript');

/**
 * 为企业客户补写公司资料扩展表记录。
 *
 * @param queryRunner - 当前事务使用的查询执行器
 * @param customerId - 已写入主表的客户主键
 * @param customer - 当前客户的演示数据模板
 * @returns 企业资料写入完成后结束
 */
async function insertCompanyInfo(
  queryRunner: QueryRunner,
  customerId: string,
  customer: CustomerSeed,
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
 * 为个人客户补写在留相关的扩展资料记录。
 *
 * @param queryRunner - 当前事务使用的查询执行器
 * @param customerId - 已写入主表的客户主键
 * @param customer - 当前客户的演示数据模板
 * @returns 个人资料写入完成后结束
 */
async function insertPersonInfo(
  queryRunner: QueryRunner,
  customerId: string,
  customer: CustomerSeed,
): Promise<void> {
  if (customer.type !== 'PERSONAL' || !customer.person) {
    return;
  }

  await queryRunner.query(
    `INSERT INTO person_info (
       id,
       customer_id,
       nationality,
       residence_status,
       residence_expire_date
     )
     VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
    [
      customerId,
      customer.person.nationality,
      customer.person.residenceStatus,
      customer.person.residenceExpireDate,
    ],
  );
}

/**
 * 从基础种子中读取角色编码到数据库主键的映射关系。
 *
 * @param queryRunner - 当前事务使用的查询执行器
 * @returns 供测试账号和数据归属关系复用的角色主键映射
 * @throws {Error} 基础种子尚未执行时抛出异常
 */
async function fetchRoleIds(queryRunner: QueryRunner): Promise<RoleIdMap> {
  const roleRows = (await queryRunner.query(
    'SELECT id, role_code FROM roles',
  )) as RoleCodeRow[];

  const roleIds: RoleIdMap = {};

  for (const roleRow of roleRows) {
    roleIds[roleRow.role_code] = roleRow.id;
  }

  if (!roleIds.STAFF || !roleIds.FINANCE) {
    throw new Error(
      'Roles STAFF and FINANCE must exist. Run `npm run seed` first.',
    );
  }

  return roleIds;
}

/**
 * 创建演示账号并补齐后续业务数据依赖的用户主键映射。
 *
 * @param queryRunner - 当前事务使用的查询执行器
 * @param roleIds - 基础角色编码到主键的映射
 * @returns 包含 admin 与测试账号的用户主键映射
 */
async function seedTestUsers(
  queryRunner: QueryRunner,
  roleIds: RoleIdMap,
): Promise<UserIdMap> {
  seedDemoLogger.log('Creating test users...');

  const userIds: UserIdMap = {};
  const passwordHash = await bcrypt.hash('test1234', 10);

  for (const user of TEST_USERS) {
    const existingRows = (await queryRunner.query(
      'SELECT id FROM users WHERE username = $1',
      [user.username],
    )) as IdRow[];

    if (existingRows.length > 0) {
      userIds[user.username] = existingRows[0].id;
      seedDemoLogger.log(`User "${user.username}" already exists, skipped.`);
      continue;
    }

    const insertedRows = (await queryRunner.query(
      `INSERT INTO users (id, username, password_hash, display_name, email, status)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'ACTIVE')
       RETURNING id`,
      [user.username, passwordHash, user.displayName, user.email],
    )) as IdRow[];

    userIds[user.username] = insertedRows[0].id;

    await queryRunner.query(
      'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
      [insertedRows[0].id, roleIds[user.roleCode]],
    );

    seedDemoLogger.log(
      `User "${user.username}" created (password: test1234, role: ${user.roleCode}).`,
    );
  }

  const adminRows = (await queryRunner.query(
    "SELECT id FROM users WHERE username = 'admin'",
  )) as IdRow[];

  if (adminRows.length > 0) {
    userIds.admin = adminRows[0].id;
  }

  return userIds;
}

/**
 * 创建演示客户并写入企业或个人扩展资料。
 *
 * @param queryRunner - 当前事务使用的查询执行器
 * @param userIds - 已写入数据库的用户主键映射
 * @returns 客户编码到数据库主键的映射
 */
async function seedCustomers(
  queryRunner: QueryRunner,
  userIds: UserIdMap,
): Promise<CustomerIdMap> {
  seedDemoLogger.log('Creating sample customers...');

  const customerIds: CustomerIdMap = {};

  for (const customer of CUSTOMERS) {
    const existingRows = (await queryRunner.query(
      'SELECT id FROM customers WHERE customer_code = $1',
      [customer.code],
    )) as IdRow[];

    if (existingRows.length > 0) {
      customerIds[customer.code] = existingRows[0].id;
      seedDemoLogger.log(
        `Customer "${customer.code}" already exists, skipped.`,
      );
      continue;
    }

    const ownerId = userIds[customer.ownerUsername] ?? null;
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
         status
       )
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE')
       RETURNING id`,
      [
        customer.code,
        customer.type,
        customer.name,
        customer.phone,
        customer.email,
        customer.address,
        customer.serviceType,
        ownerId,
      ],
    )) as IdRow[];

    const customerId = insertedRows[0].id;
    customerIds[customer.code] = customerId;

    await insertCompanyInfo(queryRunner, customerId, customer);
    await insertPersonInfo(queryRunner, customerId, customer);

    seedDemoLogger.log(
      `Customer "${customer.code} - ${customer.name}" created.`,
    );
  }

  return customerIds;
}

/**
 * 为演示中的个人客户写入行政案件样本。
 *
 * @param queryRunner - 当前事务使用的查询执行器
 * @param customerIds - 客户编码到主键的映射
 * @param userIds - 用户名到主键的映射
 * @returns 行政案件样本写入完成后结束
 */
async function seedAdminCases(
  queryRunner: QueryRunner,
  customerIds: CustomerIdMap,
  userIds: UserIdMap,
): Promise<void> {
  seedDemoLogger.log('Creating sample admin cases...');

  for (const adminCase of ADMIN_CASE_TEMPLATES) {
    const customerId = customerIds[adminCase.customerCode];

    if (!customerId) {
      continue;
    }

    const ownerId = userIds[adminCase.ownerUsername] ?? null;

    await queryRunner.query(
      `INSERT INTO admin_cases (
         id,
         customer_id,
         case_name,
         applicant_name,
         residence_status,
         status,
         expire_date,
         owner_user_id,
         created_by
       )
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        customerId,
        adminCase.caseName,
        adminCase.applicantName,
        adminCase.residenceStatus,
        adminCase.status,
        adminCase.expireDate,
        ownerId,
        ownerId,
      ],
    );

    seedDemoLogger.log(`Case "${adminCase.caseName}" created.`);
  }
}

/**
 * 为企业客户写入税务顾问合同样本。
 *
 * @param queryRunner - 当前事务使用的查询执行器
 * @param customerIds - 客户编码到主键的映射
 * @param userIds - 用户名到主键的映射
 * @returns 税务合同样本写入完成后结束
 */
async function seedTaxContracts(
  queryRunner: QueryRunner,
  customerIds: CustomerIdMap,
  userIds: UserIdMap,
): Promise<void> {
  seedDemoLogger.log('Creating sample tax contracts...');

  for (const contract of TAX_CONTRACT_TEMPLATES) {
    const customerId = customerIds[contract.customerCode];

    if (!customerId) {
      continue;
    }

    const ownerId = userIds[contract.ownerUsername] ?? null;

    await queryRunner.query(
      `INSERT INTO tax_contracts (
         id,
         customer_id,
         contract_name,
         contract_status,
         billing_cycle,
         start_date,
         end_date,
         monthly_fee,
         owner_user_id,
         created_by
       )
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        customerId,
        contract.contractName,
        contract.contractStatus,
        contract.billingCycle,
        contract.startDate,
        contract.endDate,
        contract.monthlyFee,
        ownerId,
        ownerId,
      ],
    );

    seedDemoLogger.log(`Tax contract "${contract.contractName}" created.`);
  }
}

/**
 * 写入带明细行的发票样本，覆盖税务与行政业务两类单据。
 *
 * @param queryRunner - 当前事务使用的查询执行器
 * @param customerIds - 客户编码到主键的映射
 * @param userIds - 用户名到主键的映射
 * @returns 发票与发票明细样本写入完成后结束
 * @throws {Error} 财务演示账号缺失时抛出异常
 */
async function seedInvoices(
  queryRunner: QueryRunner,
  customerIds: CustomerIdMap,
  userIds: UserIdMap,
): Promise<void> {
  seedDemoLogger.log('Creating sample invoices...');

  const createdBy = userIds.yamamoto;

  if (!createdBy) {
    throw new Error('Demo user "yamamoto" must exist before seeding invoices.');
  }

  for (const invoice of INVOICE_TEMPLATES) {
    const customerId = customerIds[invoice.customerCode];

    if (!customerId) {
      continue;
    }

    const insertedRows = (await queryRunner.query(
      `INSERT INTO invoices (
         id,
         customer_id,
         invoice_number,
         title,
         invoice_type,
         status,
         total_amount,
         tax_amount,
         subtotal,
         created_by
       )
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        customerId,
        invoice.invoiceNumber,
        invoice.title,
        invoice.invoiceType,
        invoice.status,
        invoice.totalAmount,
        invoice.taxAmount,
        invoice.subtotal,
        createdBy,
      ],
    )) as IdRow[];

    const invoiceId = insertedRows[0].id;

    for (const item of invoice.items) {
      await queryRunner.query(
        `INSERT INTO invoice_items (
           id,
           invoice_id,
           description,
           quantity,
           unit_price,
           amount,
           tax_rate
         )
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
        [
          invoiceId,
          item.description,
          item.quantity,
          item.unitPrice,
          item.amount,
          item.taxRate,
        ],
      );
    }

    seedDemoLogger.log(
      `Invoice "${invoice.invoiceNumber} - ${invoice.title}" created.`,
    );
  }
}

/**
 * 为演示客户补齐跟进记录与内部备注。
 *
 * @param queryRunner - 当前事务使用的查询执行器
 * @param customerIds - 客户编码到主键的映射
 * @param userIds - 用户名到主键的映射
 * @returns 客户备注样本写入完成后结束
 * @throws {Error} 业务演示账号缺失时抛出异常
 */
async function seedNotes(
  queryRunner: QueryRunner,
  customerIds: CustomerIdMap,
  userIds: UserIdMap,
): Promise<void> {
  seedDemoLogger.log('Creating sample notes...');

  const createdBy = userIds.tanaka;

  if (!createdBy) {
    throw new Error('Demo user "tanaka" must exist before seeding notes.');
  }

  let createdCount = 0;

  for (const note of NOTE_TEMPLATES) {
    const customerId = customerIds[note.customerCode];

    if (!customerId) {
      continue;
    }

    await queryRunner.query(
      `INSERT INTO notes (id, customer_id, content, note_type, created_by)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
      [customerId, note.content, note.noteType, createdBy],
    );
    createdCount += 1;
  }

  seedDemoLogger.log(`${createdCount} notes created.`);
}

/**
 * 在单个事务内写入演示账号、客户、案件、合同、发票和备注样本。
 *
 * @returns 演示数据写入完成后结束
 */
async function seedDemo(): Promise<void> {
  const dataSource = createAppDataSource(process.env, { logging: false });

  await dataSource.initialize();
  seedDemoLogger.log('Database connected.');

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.startTransaction();

  try {
    const roleIds = await fetchRoleIds(queryRunner);
    const userIds = await seedTestUsers(queryRunner, roleIds);
    const customerIds = await seedCustomers(queryRunner, userIds);

    await seedAdminCases(queryRunner, customerIds, userIds);
    await seedTaxContracts(queryRunner, customerIds, userIds);
    await seedInvoices(queryRunner, customerIds, userIds);
    await seedNotes(queryRunner, customerIds, userIds);

    await queryRunner.commitTransaction();
    seedDemoLogger.log('=== Demo data seed completed ===');
    seedDemoLogger.log('Test accounts:');
    seedDemoLogger.log('admin / admin123 (管理者)');
    seedDemoLogger.log('tanaka / test1234 (業務スタッフ)');
    seedDemoLogger.log('suzuki / test1234 (業務スタッフ)');
    seedDemoLogger.log('yamamoto / test1234 (財務担当)');
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
    await dataSource.destroy();
  }
}

seedDemo().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : '未知演示种子异常';
  const stack = error instanceof Error ? error.stack : undefined;

  seedDemoLogger.error(
    `Demo seed failed and transaction rolled back: ${message}`,
    stack,
  );
  process.exit(1);
});
