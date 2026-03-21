import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm'
import { FileAccessAction } from '../../../common/constants/enums'
import { FileEntity } from './file.entity'
import { User } from '../../auth/entities/user.entity'

@Entity('file_access_logs')
export class FileAccessLog {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index()
  @Column({ type: 'uuid' })
  fileId: string

  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId: string | null

  @Column({ type: 'varchar', length: 20 })
  action: FileAccessAction

  @Column({ type: 'varchar', length: 50, nullable: true })
  ipAddress: string | null

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date

  @ManyToOne(() => FileEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'file_id' })
  file: FileEntity

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null
}
