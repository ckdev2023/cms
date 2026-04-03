import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BusinessType } from '../../../common/constants/enums';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../auth/entities/user.entity';

/**
 * 映射文件主表，并维护业务归属、存储路径与上传人关联等元数据。
 */
@Entity('files')
export class FileEntity extends BaseEntity {
  @Index()
  @Column({ type: 'uuid', nullable: true })
  customerId: string | null;

  @Index()
  @Column({ type: 'varchar', length: 30 })
  businessType: BusinessType;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  relatedId: string | null;

  @Column({ type: 'varchar', length: 255 })
  fileName: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 1000 })
  filePath: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  fileExt: string | null;

  @Column({ type: 'bigint', nullable: true })
  fileSize: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  mimeType: string | null;

  @Column({ type: 'uuid', nullable: true })
  uploadedBy: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'uploaded_by' })
  uploader: User | null;
}
