import { Logger } from '@nestjs/common';
import type { QueryRunner } from 'typeorm';

import { MATERIAL_TEMPLATE_BASE_SEEDS } from './seed-material-templates.data';

const seedMaterialTemplatesLogger = new Logger('SeedMaterialTemplates');

interface IdRow {
  id: string;
}

/**
 * 幂等写入默认材料模板：仅当该 `case_type` 尚无活跃模板时插入主表与子项。
 *
 * @param queryRunner - 与主 seed 同一事务内的查询执行器
 * @returns 全部模板尝试处理完成后结束
 */
export async function seedMaterialTemplates(
  queryRunner: QueryRunner,
): Promise<void> {
  seedMaterialTemplatesLogger.log(
    'Seeding default material templates (idempotent)...',
  );

  for (const tpl of MATERIAL_TEMPLATE_BASE_SEEDS) {
    const existingRows = (await queryRunner.query(
      `SELECT id FROM material_templates
       WHERE case_type = $1 AND is_active = true AND deleted_at IS NULL
       LIMIT 1`,
      [tpl.caseType],
    )) as IdRow[];

    if (existingRows.length > 0) {
      seedMaterialTemplatesLogger.log(
        `Material template for case_type=${tpl.caseType} already exists, skipped.`,
      );
      continue;
    }

    const insertedRows = (await queryRunner.query(
      `INSERT INTO material_templates (
         id,
         created_at,
         updated_at,
         deleted_at,
         case_type,
         display_name,
         is_active
       )
       VALUES (gen_random_uuid(), now(), now(), NULL, $1, $2, true)
       RETURNING id`,
      [tpl.caseType, tpl.displayName],
    )) as IdRow[];

    const templateId = insertedRows[0].id;

    for (const item of tpl.items) {
      await queryRunner.query(
        `INSERT INTO material_template_items (
           id,
           created_at,
           updated_at,
           template_id,
           group_name,
           item_name,
           scope,
           sort_order,
           is_required
         )
         VALUES (
           gen_random_uuid(),
           now(),
           now(),
           $1,
           $2,
           $3,
           $4,
           $5,
           true
         )`,
        [templateId, item.groupName, item.itemName, item.scope, item.sortOrder],
      );
    }

    seedMaterialTemplatesLogger.log(
      `Material template created: ${tpl.caseType} (${tpl.items.length} items).`,
    );
  }
}
