import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm'
import { BaseEntity } from '../../../common/entities/base.entity'
import { NoteType } from '../../../common/constants/enums'
import { Customer } from './customer.entity'
import { User } from '../../auth/entities/user.entity'

@Entity('notes')
export class Note extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  customerId: string

  @Column({ type: 'text' })
  content: string

  @Column({ type: 'varchar', length: 30, default: NoteType.GENERAL })
  noteType: NoteType

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null

  @ManyToOne(() => Customer, (customer) => customer.notes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator: User | null
}
