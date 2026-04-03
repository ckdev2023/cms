import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { NoteType } from '../../../common/constants/enums';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../auth/entities/user.entity';
import { Customer } from './customer.entity';

/**
 * 记录客户跟进备注与创建人的持久化实体。
 */
@Entity('notes')
export class Note extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  customerId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 30, default: NoteType.GENERAL })
  noteType: NoteType;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @ManyToOne(() => Customer, (customer) => customer.notes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;
}
