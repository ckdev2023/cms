import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Note } from '../customer/entities/note.entity';

/**
 * 查询最新案件日志命中补件判定规则的案件 ID，供提醒候选集、域统计与全局列表筛选复用。
 */
@Injectable()
export class VisaCaseSupplementLogCaseIdsService {
  constructor(
    @InjectRepository(Note)
    private readonly noteRepo: Repository<Note>,
  ) {}

  /**
   * 返回最新一条案件日志命中补件判定规则（与提醒桶 SUPPLEMENT 一致）的案件 ID 列表。
   *
   * 性能：相关子查询按 `visa_case_id` 取最新 `created_at` 行，依赖
   * `IDX_notes_visa_case_created_desc_active`（migration `1776300000000`）降低顺序扫描。
   *
   * @returns 去重后的 `visa_case_id` 列表
   */
  async findCaseIds(): Promise<string[]> {
    const results = await this.noteRepo.manager.query<
      { visa_case_id: string }[]
    >(
      `SELECT DISTINCT n.visa_case_id
       FROM notes n
       WHERE n.visa_case_id IS NOT NULL
         AND n.deleted_at IS NULL
         AND (n.log_type = 'SUPPLEMENT' OR (n.missing_items IS NOT NULL AND n.missing_items != ''))
         AND n.id = (
           SELECT n2.id FROM notes n2
           WHERE n2.visa_case_id = n.visa_case_id
             AND n2.deleted_at IS NULL
           ORDER BY n2.created_at DESC
           LIMIT 1
         )`,
    );
    return (results as { visa_case_id: string }[]).map((r) => r.visa_case_id);
  }
}
