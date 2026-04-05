import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { FamilyRelation } from '../../../common/constants/enums';
import { Customer } from './customer.entity';

/**
 * 映射个人客户补充在留信息的一对一持久化实体。
 */
@Entity('person_info')
export class PersonInfo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  customerId: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  nationality: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  residenceStatus: string | null;

  /**
   * 自然人护照号码主档字段（可空、不设库级唯一；口径见 docs/17 §1.12）。
   */
  @Column({
    name: 'passport_number',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  passportNumber: string | null;

  @Index('IDX_person_info_residence_expire_date', {
    where: '"residence_expire_date" IS NOT NULL',
  })
  @Column({ type: 'date', nullable: true })
  residenceExpireDate: Date | null;

  @Column({ type: 'boolean', default: false })
  isFamilyMember: boolean;

  @Column({ type: 'varchar', length: 30, nullable: true })
  familyRelation: FamilyRelation | null;

  @Column({ type: 'uuid', nullable: true })
  primaryCustomerId: string | null;

  @Column({ type: 'int', nullable: true })
  remindDaysBefore: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne(() => Customer, (customer) => customer.personInfo, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => Customer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'primary_customer_id' })
  primaryCustomer: Customer | null;
}
