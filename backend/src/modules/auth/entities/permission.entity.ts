import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { PermissionType } from '../../../common/constants/enums';
import { Role } from './role.entity';

/**
 * 定义系统权限点的持久化实体，并维护权限与角色的多对多关联关系。
 */
@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  permissionCode: string;

  @Column({ type: 'varchar', length: 100 })
  permissionName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  permissionType: PermissionType;

  @Index()
  @Column({ type: 'varchar', length: 50 })
  module: string;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToMany(() => Role, (role) => role.permissions)
  roles: Role[];
}
