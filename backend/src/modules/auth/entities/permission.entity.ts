import {
  Entity,
  Column,
  ManyToMany,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  Index,
} from 'typeorm'
import { PermissionType } from '../../../common/constants/enums'
import { Role } from './role.entity'

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 100, unique: true })
  permissionCode: string

  @Column({ type: 'varchar', length: 100 })
  permissionName: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null

  @Index()
  @Column({ type: 'varchar', length: 20 })
  permissionType: PermissionType

  @Index()
  @Column({ type: 'varchar', length: 50 })
  module: string

  @Column({ type: 'int', default: 0 })
  sortOrder: number

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date

  @ManyToMany(() => Role, (role) => role.permissions)
  roles: Role[]
}
