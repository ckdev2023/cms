import { DataSource } from 'typeorm'
import { SnakeNamingStrategy } from '../common/naming-strategy'
import * as dotenv from 'dotenv'
import * as bcrypt from 'bcryptjs'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

async function seedDemo() {
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
    // ── 1. Look up role IDs ──
    const roles = await qr.query(`SELECT id, role_code FROM roles`)
    const roleIds: Record<string, string> = {}
    for (const r of roles) {
      roleIds[r.role_code] = r.id
    }

    if (!roleIds['STAFF'] || !roleIds['FINANCE']) {
      throw new Error('Roles STAFF and FINANCE must exist. Run `npm run seed` first.')
    }

    // ── 2. Create test users ──
    console.log('Creating test users...')
    const passwordHash = await bcrypt.hash('test1234', 10)
    const testUsers = [
      { username: 'tanaka', displayName: '田中太郎', email: 'tanaka@jimusho.local', roleCode: 'STAFF' },
      { username: 'suzuki', displayName: '鈴木花子', email: 'suzuki@jimusho.local', roleCode: 'STAFF' },
      { username: 'yamamoto', displayName: '山本一郎', email: 'yamamoto@jimusho.local', roleCode: 'FINANCE' },
    ]

    const userIds: Record<string, string> = {}
    for (const u of testUsers) {
      const existing = await qr.query(`SELECT id FROM users WHERE username = $1`, [u.username])
      if (existing.length > 0) {
        userIds[u.username] = existing[0].id
        console.log(`  User "${u.username}" already exists, skipped.`)
      } else {
        const [inserted] = await qr.query(
          `INSERT INTO users (id, username, password_hash, display_name, email, status)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, 'ACTIVE')
           RETURNING id`,
          [u.username, passwordHash, u.displayName, u.email],
        )
        userIds[u.username] = inserted.id
        await qr.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, [
          inserted.id,
          roleIds[u.roleCode],
        ])
        console.log(`  User "${u.username}" created (password: test1234, role: ${u.roleCode}).`)
      }
    }

    // Also get admin user id
    const adminRow = await qr.query(`SELECT id FROM users WHERE username = 'admin'`)
    if (adminRow.length > 0) userIds['admin'] = adminRow[0].id

    // ── 3. Create sample customers ──
    console.log('Creating sample customers...')
    const customers = [
      {
        code: 'C00001', type: 'COMPANY', name: '株式会社テクノロジー',
        phone: '03-1234-5678', email: 'info@techno.co.jp', address: '東京都千代田区丸の内1-1-1',
        serviceType: 'BOTH', ownerUsername: 'tanaka',
        company: { corporationNumber: '1234567890123', fiscalMonth: 3, representativeName: '佐藤健' },
      },
      {
        code: 'C00002', type: 'COMPANY', name: '合同会社グローバルトレード',
        phone: '06-9876-5432', email: 'contact@globaltrade.co.jp', address: '大阪府大阪市北区梅田2-2-2',
        serviceType: 'TAX', ownerUsername: 'suzuki',
        company: { corporationNumber: '9876543210987', fiscalMonth: 12, representativeName: '高橋美咲' },
      },
      {
        code: 'P00001', type: 'PERSONAL', name: 'グエン・バン・アン',
        phone: '080-1111-2222', email: 'nguyen@example.com', address: '東京都新宿区新宿3-3-3',
        serviceType: 'ADMIN', ownerUsername: 'tanaka',
        person: { nationality: 'ベトナム', residenceStatus: '技術・人文知識・国際業務', residenceExpireDate: '2027-06-15' },
      },
      {
        code: 'P00002', type: 'PERSONAL', name: 'リー・ウェイ',
        phone: '090-3333-4444', email: 'li.wei@example.com', address: '神奈川県横浜市中区山下町4-4-4',
        serviceType: 'ADMIN', ownerUsername: 'tanaka',
        person: { nationality: '中国', residenceStatus: '経営・管理', residenceExpireDate: '2026-12-01' },
      },
      {
        code: 'C00003', type: 'COMPANY', name: '株式会社サクラ食品',
        phone: '052-5555-6666', email: 'sakura@food.co.jp', address: '愛知県名古屋市中村区名駅5-5-5',
        serviceType: 'TAX', ownerUsername: 'suzuki',
        company: { corporationNumber: '5555666677778', fiscalMonth: 9, representativeName: '田村直樹' },
      },
    ]

    const customerIds: Record<string, string> = {}
    for (const c of customers) {
      const existing = await qr.query(`SELECT id FROM customers WHERE customer_code = $1`, [c.code])
      if (existing.length > 0) {
        customerIds[c.code] = existing[0].id
        console.log(`  Customer "${c.code}" already exists, skipped.`)
        continue
      }

      const ownerId = c.ownerUsername ? userIds[c.ownerUsername] : null
      const [inserted] = await qr.query(
        `INSERT INTO customers (id, customer_code, customer_type, customer_name, phone, email, address, service_type, owner_user_id, status)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE')
         RETURNING id`,
        [c.code, c.type, c.name, c.phone, c.email, c.address, c.serviceType, ownerId],
      )
      customerIds[c.code] = inserted.id

      if (c.type === 'COMPANY' && c.company) {
        await qr.query(
          `INSERT INTO company_info (id, customer_id, corporation_number, fiscal_month, representative_name)
           VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
          [inserted.id, c.company.corporationNumber, c.company.fiscalMonth, c.company.representativeName],
        )
      }

      if (c.type === 'PERSONAL' && c.person) {
        await qr.query(
          `INSERT INTO person_info (id, customer_id, nationality, residence_status, residence_expire_date)
           VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
          [inserted.id, c.person.nationality, c.person.residenceStatus, c.person.residenceExpireDate],
        )
      }

      console.log(`  Customer "${c.code} - ${c.name}" created.`)
    }

    // ── 4. Create sample admin cases ──
    console.log('Creating sample admin cases...')
    const cases = [
      {
        customerId: customerIds['P00001'], caseName: '在留資格変更許可申請',
        applicantName: 'グエン・バン・アン', residenceStatus: '技術・人文知識・国際業務',
        status: 'SUBMITTED', expireDate: '2027-06-15', ownerUsername: 'tanaka',
      },
      {
        customerId: customerIds['P00002'], caseName: '在留期間更新許可申請',
        applicantName: 'リー・ウェイ', residenceStatus: '経営・管理',
        status: 'MATERIAL_PENDING', expireDate: '2026-12-01', ownerUsername: 'tanaka',
      },
      {
        customerId: customerIds['P00001'], caseName: '就労資格証明書交付申請',
        applicantName: 'グエン・バン・アン', residenceStatus: '技術・人文知識・国際業務',
        status: 'COMPLETED', expireDate: null, ownerUsername: 'tanaka',
      },
    ]

    const caseIds: string[] = []
    for (const ac of cases) {
      if (!ac.customerId) continue
      const ownerId = ac.ownerUsername ? userIds[ac.ownerUsername] : null
      const [inserted] = await qr.query(
        `INSERT INTO admin_cases (id, customer_id, case_name, applicant_name, residence_status, status, expire_date, owner_user_id, created_by)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [ac.customerId, ac.caseName, ac.applicantName, ac.residenceStatus, ac.status, ac.expireDate, ownerId, ownerId],
      )
      caseIds.push(inserted.id)
      console.log(`  Case "${ac.caseName}" created.`)
    }

    // ── 5. Create sample tax contracts ──
    console.log('Creating sample tax contracts...')
    const contracts = [
      {
        customerId: customerIds['C00001'], contractName: '顧問契約（月次）',
        contractStatus: 'ACTIVE', billingCycle: 'MONTHLY',
        startDate: '2025-04-01', endDate: null, monthlyFee: 50000, ownerUsername: 'suzuki',
      },
      {
        customerId: customerIds['C00002'], contractName: '記帳代行契約',
        contractStatus: 'ACTIVE', billingCycle: 'MONTHLY',
        startDate: '2025-01-01', endDate: null, monthlyFee: 30000, ownerUsername: 'suzuki',
      },
      {
        customerId: customerIds['C00003'], contractName: '税務顧問契約',
        contractStatus: 'ACTIVE', billingCycle: 'MONTHLY',
        startDate: '2024-10-01', endDate: null, monthlyFee: 80000, ownerUsername: 'suzuki',
      },
    ]

    const contractIds: string[] = []
    for (const tc of contracts) {
      if (!tc.customerId) continue
      const ownerId = tc.ownerUsername ? userIds[tc.ownerUsername] : null
      const [inserted] = await qr.query(
        `INSERT INTO tax_contracts (id, customer_id, contract_name, contract_status, billing_cycle, start_date, end_date, monthly_fee, owner_user_id, created_by)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [tc.customerId, tc.contractName, tc.contractStatus, tc.billingCycle, tc.startDate, tc.endDate, tc.monthlyFee, ownerId, ownerId],
      )
      contractIds.push(inserted.id)
      console.log(`  Tax contract "${tc.contractName}" created.`)
    }

    // ── 6. Create sample invoices ──
    console.log('Creating sample invoices...')
    const invoices = [
      {
        customerId: customerIds['C00001'], invoiceNumber: 'INV-2026-001',
        title: '2026年3月顧問料', invoiceType: 'TAX', status: 'SENT',
        totalAmount: 55000, taxAmount: 5000, subtotal: 50000,
        items: [{ description: '顧問契約 2026年3月', quantity: 1, unitPrice: 50000, amount: 50000, taxRate: 10 }],
      },
      {
        customerId: customerIds['C00001'], invoiceNumber: 'INV-2026-002',
        title: '2026年2月顧問料', invoiceType: 'TAX', status: 'PAID',
        totalAmount: 55000, taxAmount: 5000, subtotal: 50000,
        items: [{ description: '顧問契約 2026年2月', quantity: 1, unitPrice: 50000, amount: 50000, taxRate: 10 }],
      },
      {
        customerId: customerIds['P00001'], invoiceNumber: 'INV-2026-003',
        title: '在留資格変更許可申請手数料', invoiceType: 'ADMIN', status: 'DRAFT',
        totalAmount: 110000, taxAmount: 10000, subtotal: 100000,
        items: [{ description: '在留資格変更許可申請 報酬', quantity: 1, unitPrice: 100000, amount: 100000, taxRate: 10 }],
      },
      {
        customerId: customerIds['C00002'], invoiceNumber: 'INV-2026-004',
        title: '2026年3月記帳代行', invoiceType: 'TAX', status: 'SENT',
        totalAmount: 33000, taxAmount: 3000, subtotal: 30000,
        items: [{ description: '記帳代行 2026年3月', quantity: 1, unitPrice: 30000, amount: 30000, taxRate: 10 }],
      },
    ]

    const invoiceIds: string[] = []
    for (const inv of invoices) {
      if (!inv.customerId) continue
      const [inserted] = await qr.query(
        `INSERT INTO invoices (id, customer_id, invoice_number, title, invoice_type, status, total_amount, tax_amount, subtotal, created_by)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [inv.customerId, inv.invoiceNumber, inv.title, inv.invoiceType, inv.status, inv.totalAmount, inv.taxAmount, inv.subtotal, userIds['yamamoto']],
      )
      invoiceIds.push(inserted.id)

      for (const item of inv.items) {
        await qr.query(
          `INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, amount, tax_rate)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
          [inserted.id, item.description, item.quantity, item.unitPrice, item.amount, item.taxRate],
        )
      }

      console.log(`  Invoice "${inv.invoiceNumber} - ${inv.title}" created.`)
    }

    // ── 7. Create sample notes ──
    console.log('Creating sample notes...')
    const notes = [
      { customerId: customerIds['P00001'], content: '初回面談実施。在留資格変更の要件を確認。', noteType: 'FOLLOW_UP' },
      { customerId: customerIds['P00001'], content: '必要書類リストを送付済み。', noteType: 'MEMO' },
      { customerId: customerIds['C00001'], content: '月次打ち合わせ。来期の節税対策について相談。', noteType: 'FOLLOW_UP' },
      { customerId: customerIds['C00002'], content: '契約更新時期。来月確認予定。', noteType: 'GENERAL' },
    ]

    for (const n of notes) {
      if (!n.customerId) continue
      await qr.query(
        `INSERT INTO notes (id, customer_id, content, note_type, created_by)
         VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
        [n.customerId, n.content, n.noteType, userIds['tanaka']],
      )
    }
    console.log(`  ${notes.length} notes created.`)

    await qr.commitTransaction()
    console.log('\n=== Demo data seed completed ===')
    console.log('\nTest accounts:')
    console.log('  admin    / admin123   (管理者)')
    console.log('  tanaka   / test1234   (業務スタッフ)')
    console.log('  suzuki   / test1234   (業務スタッフ)')
    console.log('  yamamoto / test1234   (財務担当)')
  } catch (error) {
    await qr.rollbackTransaction()
    console.error('Demo seed failed, transaction rolled back:', error)
    process.exit(1)
  } finally {
    await qr.release()
    await ds.destroy()
  }
}

seedDemo()
