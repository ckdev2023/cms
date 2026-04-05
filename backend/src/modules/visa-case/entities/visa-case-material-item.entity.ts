import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { MaterialItemStatus } from '../../../common/constants/enums';
import { User } from '../../auth/entities/user.entity';
import { MaterialTemplateItem } from './material-template-item.entity';
import { VisaCase } from './visa-case.entity';
import { VisaCaseFamilyMember } from './visa-case-family-member.entity';

/**
 * 案件材料实例，从模板实例化后独立存在，支持逐项勾选与补件追踪。
 *
 * `template_item_id IS NULL` 表示操作员手动新增的额外材料项。
 * `visa_case_family_member_id IS NULL` 表示案件级材料；非空时表示成员级材料。
 * `item_status` 采用三值枚举（NOT_COLLECTED / COLLECTED / NOT_APPLICABLE），
 * 其中 NOT_APPLICABLE 不参与建议 `material_status` 的计算。
 */
@Entity('visa_case_material_items')
export class VisaCaseMaterialItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  visaCaseId: string;

  @Column({ type: 'uuid', nullable: true })
  templateItemId: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  visaCaseFamilyMemberId: string | null;

  @Column({ type: 'varchar', length: 100 })
  groupName: string;

  @Column({ type: 'varchar', length: 200 })
  itemName: string;

  @Column({
    type: 'varchar',
    length: 30,
    default: MaterialItemStatus.NOT_COLLECTED,
  })
  itemStatus: MaterialItemStatus;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'text', nullable: true })
  remark: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  collectedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => VisaCase, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'visa_case_id' })
  visaCase: VisaCase;

  @ManyToOne(() => MaterialTemplateItem, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'template_item_id' })
  templateItem: MaterialTemplateItem | null;

  @ManyToOne(() => VisaCaseFamilyMember, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'visa_case_family_member_id' })
  familyMember: VisaCaseFamilyMember | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;
}
