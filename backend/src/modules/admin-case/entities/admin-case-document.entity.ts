import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm'
import { AdminCase } from './admin-case.entity'
import { FileEntity } from '../../file/entities/file.entity'

@Entity('admin_case_documents')
export class AdminCaseDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index()
  @Column({ type: 'uuid' })
  adminCaseId: string

  @Column({ type: 'uuid' })
  fileId: string

  @Column({ type: 'varchar', length: 50, nullable: true })
  documentType: string | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark: string | null

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date

  @ManyToOne(() => AdminCase, (ac) => ac.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'admin_case_id' })
  adminCase: AdminCase

  @ManyToOne(() => FileEntity)
  @JoinColumn({ name: 'file_id' })
  file: FileEntity
}
