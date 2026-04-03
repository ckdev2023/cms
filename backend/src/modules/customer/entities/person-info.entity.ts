import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

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

  @Column({ type: 'date', nullable: true })
  residenceExpireDate: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne(() => Customer, (customer) => customer.personInfo, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;
}
