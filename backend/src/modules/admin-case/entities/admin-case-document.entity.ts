import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { FileEntity } from '../../file/entities/file.entity';
import { AdminCase } from './admin-case.entity';

/**
 * 映射行政案件与文件资料的关联记录，保存资料类型、备注与上传文件绑定关系。
 */
@Entity('admin_case_documents')
export class AdminCaseDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  adminCaseId: string;

  @Column({ type: 'uuid' })
  fileId: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  documentType: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => AdminCase, (ac) => ac.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'admin_case_id' })
  adminCase: AdminCase;

  @ManyToOne(() => FileEntity)
  @JoinColumn({ name: 'file_id' })
  file: FileEntity;
}
