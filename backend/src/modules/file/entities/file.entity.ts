import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm'
import { BaseEntity } from '../../../common/entities/base.entity'
import { BusinessType } from '../../../common/constants/enums'
import { User } from '../../auth/entities/user.entity'

@Entity('files')
export class FileEntity extends BaseEntity {
  @Index()
  @Column({ type: 'uuid', nullable: true })
  customerId: string | null

  @Index()
  @Column({ type: 'varchar', length: 30 })
  businessType: BusinessType

  @Index()
  @Column({ type: 'uuid', nullable: true })
  relatedId: string | null

  @Column({ type: 'varchar', length: 255 })
  fileName: string

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null

  @Column({ type: 'varchar', length: 1000 })
  filePath: string

  @Column({ type: 'varchar', length: 20, nullable: true })
  fileExt: string | null

  @Column({ type: 'bigint', nullable: true })
  fileSize: number | null

  @Column({ type: 'varchar', length: 100, nullable: true })
  mimeType: string | null

  @Column({ type: 'uuid', nullable: true })
  uploadedBy: string | null

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'uploaded_by' })
  uploader: User | null
}
