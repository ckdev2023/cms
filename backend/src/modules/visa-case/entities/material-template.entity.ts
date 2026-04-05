import { Column, Entity, Index, OneToMany } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';
import { MaterialTemplateItem } from './material-template-item.entity';

/**
 * 材料模板主表，按签证案件类型预定义通用材料清单。
 *
 * 同一 `case_type` 下最多存在一个 `is_active = true` 的模板（由部分唯一索引保证）。
 * 模板变更不回溯已实例化到案件上的材料项（快照隔离），具体实例存储于 `visa_case_material_items`。
 */
@Entity('material_templates')
@Index('UQ_material_templates_case_type_active', ['caseType'], {
  unique: true,
  where: '"is_active" = true AND "deleted_at" IS NULL',
})
export class MaterialTemplate extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  caseType: string;

  @Column({ type: 'varchar', length: 200 })
  displayName: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => MaterialTemplateItem, (item) => item.template, {
    cascade: true,
  })
  items: MaterialTemplateItem[];
}
