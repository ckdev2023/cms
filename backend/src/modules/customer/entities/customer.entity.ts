import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
} from 'typeorm';

import {
  CustomerStatus,
  CustomerType,
  ServiceType,
} from '../../../common/constants/enums';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../auth/entities/user.entity';
import { CompanyInfo } from './company-info.entity';
import { CustomerStaffRelation } from './customer-staff-relation.entity';
import { Note } from './note.entity';
import { PersonInfo } from './person-info.entity';

/**
 * 映射客户主档及其聚合关联关系的持久化实体。
 */
@Entity('customers')
export class Customer extends BaseEntity {
  @Column({ type: 'varchar', length: 50, unique: true })
  customerCode: string;

  @Column({ type: 'varchar', length: 20 })
  customerType: CustomerType;

  @Index()
  @Column({ type: 'varchar', length: 200 })
  customerName: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  address: string | null;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  serviceType: ServiceType;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  ownerUserId: string | null;

  @Column({ type: 'varchar', length: 20, default: CustomerStatus.ACTIVE })
  status: CustomerStatus;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'owner_user_id' })
  owner: User | null;

  @OneToOne(() => CompanyInfo, (ci) => ci.customer, { cascade: true })
  companyInfo: CompanyInfo | null;

  @OneToOne(() => PersonInfo, (pi) => pi.customer, { cascade: true })
  personInfo: PersonInfo | null;

  @OneToMany(() => Note, (note) => note.customer)
  notes: Note[];

  @OneToMany(() => CustomerStaffRelation, (csr) => csr.customer)
  staffRelations: CustomerStaffRelation[];
}
