import { Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import type { QueryRunner } from 'typeorm';

import { createAppDataSource } from '../data-source';

interface RoleSeed {
  roleName: string;
  roleCode: string;
  description: string;
  isSystem: boolean;
}

interface PermissionModuleSeed {
  module: string;
  label: string;
  actions: string[];
}

interface IdRow {
  id: string;
}

type RoleIdMap = Record<string, string>;
type PermissionIdMap = Record<string, string>;

const seedLogger = new Logger('SeedScript');

const ROLES: ReadonlyArray<RoleSeed> = [
  {
    roleName: '管理者',
    roleCode: 'ADMIN',
    description: 'システム管理者 — 全モジュールの読み書き権限',
    isSystem: true,
  },
  {
    roleName: '業務スタッフ',
    roleCode: 'STAFF',
    description: '一般業務スタッフ — 顧客・案件・税務の操作権限',
    isSystem: true,
  },
  {
    roleName: '財務担当',
    roleCode: 'FINANCE',
    description: '財務担当者 — 請求・入金・預り金の操作権限',
    isSystem: true,
  },
];

const PERMISSION_MODULES: ReadonlyArray<PermissionModuleSeed> = [
  {
    module: 'customer',
    label: '顧客管理',
    actions: ['list', 'detail', 'create', 'edit', 'delete'],
  },
  {
    module: 'admin_case',
    label: '行政書士',
    actions: ['list', 'detail', 'create', 'edit', 'delete'],
  },
  {
    module: 'tax',
    label: '税理士',
    actions: ['list', 'detail', 'create', 'edit', 'delete'],
  },
  {
    module: 'finance',
    label: '財務管理',
    actions: ['list', 'detail', 'create', 'edit', 'delete', 'void'],
  },
  {
    module: 'file',
    label: 'ファイル管理',
    actions: ['list', 'upload', 'download', 'delete'],
  },
  {
    module: 'system',
    label: 'システム設定',
    actions: ['user_manage', 'role_manage', 'dict_manage'],
  },
  {
    module: 'log',
    label: '操作ログ',
    actions: ['list'],
  },
  {
    module: 'dashboard',
    label: 'ワークベンチ',
    actions: ['view'],
  },
];

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

const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: ['*'],
  STAFF: [
    'customer:*',
    'admin_case:*',
    'tax:*',
    'file:list',
    'file:upload',
    'file:download',
    'dashboard:view',
  ],
  FINANCE: [
    'customer:list',
    'customer:detail',
    'finance:*',
    'file:list',
    'file:upload',
    'file:download',
    'dashboard:view',
  ],
};

/**
 * 判断单个权限码是否匹配角色配置中的授权模式。
 *
 * @param pattern - 角色上声明的权限模式，支持精确值、`*` 和 `module:*`
 * @param code - 待判定的完整权限码
 * @returns 命中授权模式时返回 true
 */
function matchPermissionPattern(pattern: string, code: string): boolean {
  if (pattern === '*' || pattern === code) {
    return true;
  }

  return pattern.endsWith(':*') && code.startsWith(pattern.replace(':*', ':'));
}

/**
 * 根据角色配置的权限模式筛选出本次需要分配的权限码集合。
 *
 * @param patterns - 角色声明的权限模式列表
 * @param allPermissionCodes - 当前数据库中已建立的全部权限码
 * @returns 与角色授权模式匹配的权限码列表
 */
function collectMatchedPermissionCodes(
  patterns: readonly string[],
  allPermissionCodes: string[],
): string[] {
  if (patterns.includes('*')) {
    return allPermissionCodes;
  }

  return allPermissionCodes.filter((code) =>
    patterns.some((pattern) => matchPermissionPattern(pattern, code)),
  );
}

/**
 * 初始化系统角色并返回角色编码到数据库主键的映射。
 *
 * @param queryRunner - 当前事务使用的查询执行器
 * @returns 可供后续权限绑定复用的角色 ID 映射
 */
async function seedRoles(queryRunner: QueryRunner): Promise<RoleIdMap> {
  seedLogger.log('Seeding roles...');

  const roleIds: RoleIdMap = {};

  for (const role of ROLES) {
    const existingRows = (await queryRunner.query(
      'SELECT id FROM roles WHERE role_code = $1',
      [role.roleCode],
    )) as IdRow[];

    if (existingRows.length > 0) {
      roleIds[role.roleCode] = existingRows[0].id;
      seedLogger.log(`Role "${role.roleCode}" already exists, skipped.`);
      continue;
    }

    const insertedRows = (await queryRunner.query(
      `INSERT INTO roles (id, role_name, role_code, description, is_system)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)
       RETURNING id`,
      [role.roleName, role.roleCode, role.description, role.isSystem],
    )) as IdRow[];

    roleIds[role.roleCode] = insertedRows[0].id;
    seedLogger.log(`Role "${role.roleCode}" created.`);
  }

  return roleIds;
}

/**
 * 初始化权限主数据并返回权限码到数据库主键的映射。
 *
 * @param queryRunner - 当前事务使用的查询执行器
 * @returns 可供角色授权步骤复用的权限 ID 映射
 */
async function seedPermissions(
  queryRunner: QueryRunner,
): Promise<PermissionIdMap> {
  seedLogger.log('Seeding permissions...');

  const permissionMap: PermissionIdMap = {};
  let sortOrder = 0;

  for (const permissionModule of PERMISSION_MODULES) {
    for (const action of permissionModule.actions) {
      const code = `${permissionModule.module}:${action}`;
      const name = `${permissionModule.label} — ${ACTION_LABELS[action] ?? action}`;
      const existingRows = (await queryRunner.query(
        'SELECT id FROM permissions WHERE permission_code = $1',
        [code],
      )) as IdRow[];

      if (existingRows.length > 0) {
        permissionMap[code] = existingRows[0].id;
      } else {
        const insertedRows = (await queryRunner.query(
          `INSERT INTO permissions (
             id,
             permission_code,
             permission_name,
             description,
             permission_type,
             module,
             sort_order
           )
           VALUES (gen_random_uuid(), $1, $2, $3, 'BUTTON', $4, $5)
           RETURNING id`,
          [code, name, null, permissionModule.module, sortOrder],
        )) as IdRow[];

        permissionMap[code] = insertedRows[0].id;
        seedLogger.log(`Permission "${code}" created.`);
      }

      sortOrder += 1;
    }
  }

  return permissionMap;
}

/**
 * 根据角色到权限模式的映射关系写入角色权限关联表。
 *
 * @param queryRunner - 当前事务使用的查询执行器
 * @param roleIds - 已完成初始化的角色编码与主键映射
 * @param permissionMap - 已完成初始化的权限码与主键映射
 * @returns 角色权限绑定完成后结束
 */
async function assignPermissionsToRoles(
  queryRunner: QueryRunner,
  roleIds: RoleIdMap,
  permissionMap: PermissionIdMap,
): Promise<void> {
  seedLogger.log('Assigning permissions to roles...');

  const allPermissionCodes = Object.keys(permissionMap);

  for (const [roleCode, patterns] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleIds[roleCode];

    if (!roleId) {
      continue;
    }

    const matchedCodes = collectMatchedPermissionCodes(
      patterns,
      allPermissionCodes,
    );

    for (const code of matchedCodes) {
      const permissionId = permissionMap[code];
      const existingLinks = (await queryRunner.query(
        'SELECT 1 FROM role_permissions WHERE role_id = $1 AND permission_id = $2',
        [roleId, permissionId],
      )) as Array<Record<string, number>>;

      if (existingLinks.length === 0) {
        await queryRunner.query(
          'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)',
          [roleId, permissionId],
        );
      }
    }

    seedLogger.log(
      `Role "${roleCode}" -> ${matchedCodes.length} permissions assigned.`,
    );
  }
}

/**
 * 初始化管理员账号并确保其绑定 `ADMIN` 角色。
 *
 * @param queryRunner - 当前事务使用的查询执行器
 * @param adminRoleId - `ADMIN` 角色在数据库中的主键
 * @returns 管理员账号和角色绑定就绪后结束
 * @throws {Error} 未先创建 `ADMIN` 角色时抛出异常
 */
async function seedAdminUser(
  queryRunner: QueryRunner,
  adminRoleId: string | undefined,
): Promise<void> {
  if (!adminRoleId) {
    throw new Error('ADMIN role must exist before seeding admin user.');
  }

  seedLogger.log('Seeding admin user...');

  const adminRows = (await queryRunner.query(
    "SELECT id FROM users WHERE username = 'admin'",
  )) as IdRow[];

  let adminUserId: string;

  if (adminRows.length > 0) {
    adminUserId = adminRows[0].id;
    seedLogger.log('Admin user already exists, skipped.');
  } else {
    const passwordHash = await bcrypt.hash('admin123', 10);
    const insertedRows = (await queryRunner.query(
      `INSERT INTO users (id, username, password_hash, display_name, email, status)
       VALUES (gen_random_uuid(), 'admin', $1, '管理者', 'admin@jimusho.local', 'ACTIVE')
       RETURNING id`,
      [passwordHash],
    )) as IdRow[];

    adminUserId = insertedRows[0].id;
    seedLogger.log('Admin user created (username: admin, password: admin123).');
  }

  const adminRoleLinks = (await queryRunner.query(
    'SELECT 1 FROM user_roles WHERE user_id = $1 AND role_id = $2',
    [adminUserId, adminRoleId],
  )) as Array<Record<string, number>>;

  if (adminRoleLinks.length === 0) {
    await queryRunner.query(
      'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
      [adminUserId, adminRoleId],
    );
    seedLogger.log('Admin user -> ADMIN role assigned.');
  }
}

/**
 * 在单个事务内初始化角色、权限与管理员账号。
 *
 * @returns 基础种子写入完成后结束
 */
async function seed(): Promise<void> {
  const dataSource = createAppDataSource(process.env, { logging: false });

  await dataSource.initialize();
  seedLogger.log('Database connected.');

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.startTransaction();

  try {
    const roleIds = await seedRoles(queryRunner);
    const permissionMap = await seedPermissions(queryRunner);

    await assignPermissionsToRoles(queryRunner, roleIds, permissionMap);
    await seedAdminUser(queryRunner, roleIds.ADMIN);

    await queryRunner.commitTransaction();
    seedLogger.log('Seed completed successfully.');
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
    await dataSource.destroy();
  }
}

seed().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : '未知基础种子异常';
  const stack = error instanceof Error ? error.stack : undefined;

  seedLogger.error(
    `Seed failed and transaction rolled back: ${message}`,
    stack,
  );
  process.exit(1);
});
