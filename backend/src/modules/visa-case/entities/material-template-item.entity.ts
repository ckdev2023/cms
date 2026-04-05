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

import { MaterialItemScope } from '../../../common/constants/enums';
import { MaterialTemplate } from './material-template.entity';

/**
 * 模板材料项，定义单个材料的名称、分组、归属维度与排序。
 *
 * `scope = CASE` 表示案件级材料（实例化时仅创建一条）；
 * `scope = MEMBER` 表示成员级材料（实例化时按已挂载家属各创建一条）。
 * `is_required` 预留必需/可选区分，P1 暂不在建议值计算中区分权重。
 */
@Entity('material_template_items')
export class MaterialTemplateItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  templateId: string;

  @Column({ type: 'varchar', length: 100 })
  groupName: string;

  @Column({ type: 'varchar', length: 200 })
  itemName: string;

  @Column({ type: 'varchar', length: 20, default: MaterialItemScope.CASE })
  scope: MaterialItemScope;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'boolean', default: true })
  isRequired: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => MaterialTemplate, (template) => template.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'template_id' })
  template: MaterialTemplate;
}
