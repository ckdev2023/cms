import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Customer } from '../customer/entities/customer.entity';
import { VisaCase } from './entities/visa-case.entity';

/**
 * 为签证案件域提供客户与案件存在性校验，供多子服务复用以避免重复查询逻辑。
 */
@Injectable()
export class VisaCaseLookupService {
  constructor(
    @InjectRepository(VisaCase)
    private readonly visaCaseRepo: Repository<VisaCase>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
  ) {}

  /**
   * 校验签证案件主键是否存在，用于家属与日志等子资源操作前的门禁。
   *
   * @param visaCaseId - 待校验的案件 ID
   * @throws {NotFoundException} 案件不存在时抛出日语提示
   */
  async ensureVisaCaseExists(visaCaseId: string): Promise<void> {
    const exists = await this.visaCaseRepo.count({
      where: { id: visaCaseId },
    });
    if (!exists) {
      throw new NotFoundException('ビザ案件が見つかりません');
    }
  }

  /**
   * 校验客户主键是否存在，用于建案与资料路径写入前的门禁。
   *
   * @param customerId - 待校验的客户 ID
   * @throws {NotFoundException} 客户不存在时抛出日语提示
   */
  async ensureCustomerExists(customerId: string): Promise<void> {
    const exists = await this.customerRepo.count({
      where: { id: customerId },
    });
    if (!exists) {
      throw new NotFoundException('顧客が見つかりません');
    }
  }
}
