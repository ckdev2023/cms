import { DataSource } from 'typeorm'
import { SnakeNamingStrategy } from '../common/naming-strategy'
import * as dotenv from 'dotenv'
import * as bcrypt from 'bcryptjs'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const ROLES = [
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
]

const PERMISSION_MODULES = [
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
]

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
}

async function seed() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'jimusho_cms',
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: false,
    logging: false,
  })

  await ds.initialize()
  console.log('Database connected.')

  const qr = ds.createQueryRunner()
  await qr.startTransaction()

  try {
    // ── 1. Seed roles ──
    console.log('Seeding roles...')
    const roleIds: Record<string, string> = {}

    for (const role of ROLES) {
      const existing = await qr.query(
        `SELECT id FROM roles WHERE role_code = $1`,
        [role.roleCode],
      )
      if (existing.length > 0) {
        roleIds[role.roleCode] = existing[0].id
        console.log(`  Role "${role.roleCode}" already exists, skipped.`)
      } else {
        const [inserted] = await qr.query(
          `INSERT INTO roles (id, role_name, role_code, description, is_system)
           VALUES (gen_random_uuid(), $1, $2, $3, $4)
           RETURNING id`,
          [role.roleName, role.roleCode, role.description, role.isSystem],
        )
        roleIds[role.roleCode] = inserted.id
        console.log(`  Role "${role.roleCode}" created.`)
      }
    }

    // ── 2. Seed permissions ──
    console.log('Seeding permissions...')
    const permissionMap: Record<string, string> = {}
    let sortOrder = 0

    for (const mod of PERMISSION_MODULES) {
      for (const action of mod.actions) {
        const code = `${mod.module}:${action}`
        const name = `${mod.label} — ${ACTION_LABELS[action] || action}`

        const existing = await qr.query(
          `SELECT id FROM permissions WHERE permission_code = $1`,
          [code],
        )
        if (existing.length > 0) {
          permissionMap[code] = existing[0].id
        } else {
          const [inserted] = await qr.query(
            `INSERT INTO permissions (id, permission_code, permission_name, description, permission_type, module, sort_order)
             VALUES (gen_random_uuid(), $1, $2, $3, 'BUTTON', $4, $5)
             RETURNING id`,
            [code, name, null, mod.module, sortOrder],
          )
          permissionMap[code] = inserted.id
          console.log(`  Permission "${code}" created.`)
        }
        sortOrder++
      }
    }

    // ── 3. Assign permissions to roles ──
    console.log('Assigning permissions to roles...')
    const allPermCodes = Object.keys(permissionMap)

    for (const [roleCode, patterns] of Object.entries(ROLE_PERMISSIONS)) {
      const roleId = roleIds[roleCode]
      if (!roleId) continue

      const matchedCodes = patterns.includes('*')
        ? allPermCodes
        : allPermCodes.filter((code) =>
            patterns.some((p) => {
              if (p === code) return true
              if (p.endsWith(':*') && code.startsWith(p.replace(':*', ':')))
                return true
              return false
            }),
          )

      for (const code of matchedCodes) {
        const permId = permissionMap[code]
        const exists = await qr.query(
          `SELECT 1 FROM role_permissions WHERE role_id = $1 AND permission_id = $2`,
          [roleId, permId],
        )
        if (exists.length === 0) {
          await qr.query(
            `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)`,
            [roleId, permId],
          )
        }
      }
      console.log(
        `  Role "${roleCode}" → ${matchedCodes.length} permissions assigned.`,
      )
    }

    // ── 4. Seed admin user ──
    console.log('Seeding admin user...')
    const adminExists = await qr.query(
      `SELECT id FROM users WHERE username = 'admin'`,
    )

    let adminUserId: string
    if (adminExists.length > 0) {
      adminUserId = adminExists[0].id
      console.log('  Admin user already exists, skipped.')
    } else {
      const passwordHash = await bcrypt.hash('admin123', 10)
      const [inserted] = await qr.query(
        `INSERT INTO users (id, username, password_hash, display_name, email, status)
         VALUES (gen_random_uuid(), 'admin', $1, '管理者', 'admin@jimusho.local', 'ACTIVE')
         RETURNING id`,
        [passwordHash],
      )
      adminUserId = inserted.id
      console.log('  Admin user created (username: admin, password: admin123).')
    }

    // Assign ADMIN role to admin user
    const adminRoleLink = await qr.query(
      `SELECT 1 FROM user_roles WHERE user_id = $1 AND role_id = $2`,
      [adminUserId, roleIds['ADMIN']],
    )
    if (adminRoleLink.length === 0) {
      await qr.query(
        `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
        [adminUserId, roleIds['ADMIN']],
      )
      console.log('  Admin user → ADMIN role assigned.')
    }

    await qr.commitTransaction()
    console.log('\nSeed completed successfully.')
  } catch (error) {
    await qr.rollbackTransaction()
    console.error('Seed failed, transaction rolled back:', error)
    process.exit(1)
  } finally {
    await qr.release()
    await ds.destroy()
  }
}

seed()
