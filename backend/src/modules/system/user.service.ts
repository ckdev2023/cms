import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { In, Repository } from 'typeorm';

import { UserStatus } from '../../common/constants/enums';
import { Role } from '../auth/entities/role.entity';
import { User } from '../auth/entities/user.entity';
import { CreateUserDto, QueryUserDto, UpdateUserDto } from './dto';

interface UserRoleSummary {
  id: string;
  roleName: string;
  roleCode: string;
}

interface UserResponse {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  status: UserStatus;
  roles: UserRoleSummary[];
  createdAt: Date;
  updatedAt: Date;
}

interface UserListResult {
  items: UserResponse[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
  ) {}

  /**
   * 创建新的系统用户并完成密码加密与角色绑定。
   *
   * @param dto - 包含账号、密码、展示名和角色列表的创建参数
   * @returns 新建后的用户响应对象
   * @throws {ConflictException} 用户名已被占用时抛出
   */
  async create(dto: CreateUserDto): Promise<UserResponse> {
    const existing = await this.userRepo.findOne({
      where: { username: dto.username },
      withDeleted: true,
    });

    if (existing) {
      throw new ConflictException('このユーザー名は既に使用されています');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = this.userRepo.create({
      username: dto.username,
      passwordHash,
      displayName: dto.displayName,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      status: UserStatus.ACTIVE,
    });

    if (dto.roleIds?.length) {
      user.roles = await this.roleRepo.findBy({ id: In(dto.roleIds) });
    }

    const saved = await this.userRepo.save(user);

    return this.toResponse(saved);
  }

  /**
   * 按分页、关键字、状态和角色条件查询用户列表。
   *
   * @param query - 用户列表查询参数
   * @returns 包含用户数据和分页信息的结果对象
   */
  async findAll(query: QueryUserDto): Promise<UserListResult> {
    const {
      page = 1,
      pageSize = 20,
      keyword,
      status,
      roleCode,
      sortBy,
      sortOrder,
    } = query;

    const qb = this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'role');

    if (keyword) {
      qb.andWhere(
        '(user.username ILIKE :kw OR user.displayName ILIKE :kw OR user.email ILIKE :kw)',
        { kw: `%${keyword}%` },
      );
    }

    if (status) {
      qb.andWhere('user.status = :status', { status });
    }

    if (roleCode) {
      qb.andWhere('role.roleCode = :roleCode', { roleCode });
    }

    const orderField = sortBy ? `user.${sortBy}` : 'user.createdAt';
    qb.orderBy(orderField, sortOrder === 'ASC' ? 'ASC' : 'DESC');
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((user) => this.toResponse(user)),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 根据用户 ID 查询用户详情和角色摘要。
   *
   * @param id - 用户主键 UUID
   * @returns 对应用户的响应对象
   * @throws {NotFoundException} 用户不存在时抛出
   */
  async findOne(id: string): Promise<UserResponse> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['roles'],
    });

    if (!user) {
      throw new NotFoundException('ユーザーが見つかりません');
    }

    return this.toResponse(user);
  }

  /**
   * 更新指定用户的展示字段、状态和角色绑定。
   *
   * @param id - 待更新用户的 UUID
   * @param dto - 允许修改的用户字段
   * @returns 更新后的用户响应对象
   * @throws {NotFoundException} 用户不存在时抛出
   */
  async update(id: string, dto: UpdateUserDto): Promise<UserResponse> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['roles'],
    });

    if (!user) {
      throw new NotFoundException('ユーザーが見つかりません');
    }

    if (dto.displayName !== undefined) {
      user.displayName = dto.displayName;
    }

    if (dto.email !== undefined) {
      user.email = dto.email || null;
    }

    if (dto.phone !== undefined) {
      user.phone = dto.phone || null;
    }

    if (dto.status !== undefined) {
      user.status = dto.status;
    }

    if (dto.roleIds !== undefined) {
      user.roles = dto.roleIds.length
        ? await this.roleRepo.findBy({ id: In(dto.roleIds) })
        : [];
    }

    const saved = await this.userRepo.save(user);

    return this.toResponse(saved);
  }

  /**
   * 重置指定用户密码并清空登录失败锁定状态。
   *
   * @param id - 目标用户的 UUID
   * @param newPassword - 新的明文密码；省略时回退到默认重置密码
   * @throws {NotFoundException} 用户不存在时抛出
   * @throws {BadRequestException} 新密码长度不足 6 位时抛出
   */
  async resetPassword(id: string, newPassword?: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('ユーザーが見つかりません');
    }

    const password = newPassword || 'password123';
    if (password.length < 6) {
      throw new BadRequestException('パスワードは6文字以上必要です');
    }

    user.passwordHash = await bcrypt.hash(password, 10);
    user.failedLoginCount = 0;
    user.lockedUntil = null;

    await this.userRepo.save(user);
  }

  /**
   * 在启用和停用之间切换指定用户的状态。
   *
   * @param id - 目标用户的 UUID
   * @returns 状态切换后的用户响应对象
   * @throws {NotFoundException} 用户不存在时抛出
   */
  async toggleStatus(id: string): Promise<UserResponse> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['roles'],
    });

    if (!user) {
      throw new NotFoundException('ユーザーが見つかりません');
    }

    user.status =
      user.status === UserStatus.ACTIVE
        ? UserStatus.INACTIVE
        : UserStatus.ACTIVE;

    const saved = await this.userRepo.save(user);

    return this.toResponse(saved);
  }

  /**
   * 逻辑删除指定用户，但禁止删除系统管理员账号。
   *
   * @param id - 待删除用户的 UUID
   * @throws {NotFoundException} 用户不存在时抛出
   * @throws {BadRequestException} 用户属于系统管理员时抛出
   */
  async remove(id: string): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['roles'],
    });

    if (!user) {
      throw new NotFoundException('ユーザーが見つかりません');
    }

    const isAdmin = user.roles?.some(
      (role) => role.roleCode === 'ADMIN' && role.isSystem,
    );
    if (isAdmin) {
      throw new BadRequestException('システム管理者は削除できません');
    }

    await this.userRepo.softRemove(user);
  }

  /**
   * 将用户实体裁剪为前端所需的稳定响应结构。
   *
   * @param user - 已加载角色关联的用户实体
   * @returns 不含密码等敏感字段的用户详情对象
   */
  private toResponse(user: User): UserResponse {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      phone: user.phone,
      status: user.status,
      roles: (user.roles ?? []).map((role) => ({
        id: role.id,
        roleName: role.roleName,
        roleCode: role.roleCode,
      })),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
