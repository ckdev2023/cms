import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CustomerType } from '../../common/constants/enums';
import { Customer } from './entities/customer.entity';

/**
 * 负责客户编码生成与唯一性校验，供创建主档前占用检查使用。
 */
@Injectable()
export class CustomerCodeService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
  ) {}

  /**
   * 检查客户编码是否已被现有记录占用。
   *
   * @param code - 需要校验的客户编码
   * @returns 编码已存在时返回 true
   */
  async checkCodeExists(code: string): Promise<boolean> {
    const count = await this.customerRepo.count({
      where: { customerCode: code },
    });
    return count > 0;
  }

  /**
   * 按客户类型生成下一个可用的客户编码。
   *
   * @param type - 客户类型，用于决定公司或个人编码前缀
   * @returns 形如 `C00001` 或 `P00001` 的客户编码
   * @throws {ConflictException} 生成出的编码已被占用时
   */
  async generateCustomerCode(type: CustomerType): Promise<string> {
    const prefix = type === CustomerType.COMPANY ? 'C' : 'P';
    const lastCustomer = await this.customerRepo
      .createQueryBuilder('c')
      .where('c.customerCode LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('c.customerCode', 'DESC')
      .getOne();

    let nextNum = 1;
    if (lastCustomer) {
      const numPart = lastCustomer.customerCode.slice(prefix.length);
      const parsed = parseInt(numPart, 10);
      if (!isNaN(parsed)) {
        nextNum = parsed + 1;
      }
    }

    const code = `${prefix}${String(nextNum).padStart(5, '0')}`;

    if (await this.checkCodeExists(code)) {
      throw new ConflictException(`顧客コード ${code} は既に存在します`);
    }

    return code;
  }
}
