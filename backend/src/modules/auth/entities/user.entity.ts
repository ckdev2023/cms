import {
  Entity,
  Column,
  Index,
  ManyToMany,
  JoinTable,
} from 'typeorm'
import { BaseEntity } from '../../../common/entities/base.entity'
import { UserStatus } from '../../../common/constants/enums'
import { Role } from './role.entity'

@Entity('users')
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 50, unique: true })
  username: string

  @Column({ type: 'varchar', length: 255 })
  passwordHash: string

  @Column({ type: 'varchar', length: 100 })
  displayName: string

  @Column({ type: 'varchar', length: 120, nullable: true })
  email: string | null

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null

  @Index()
  @Column({ type: 'varchar', length: 20, default: UserStatus.ACTIVE })
  status: UserStatus

  @Column({ type: 'int', default: 0 })
  failedLoginCount: number

  @Column({ type: 'timestamptz', nullable: true })
  lockedUntil: Date | null

  @ManyToMany(() => Role, (role) => role.users, { eager: false })
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
  })
  roles: Role[]
}
