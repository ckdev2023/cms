import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Permission } from '../auth/entities/permission.entity';
import { Role } from '../auth/entities/role.entity';
import { CreateRoleDto, QueryRoleDto, UpdateRoleDto } from './dto';

export interface RolePermissionSummary {
  id: string;
  permissionCode: string;
  permissionName: string;
  module: string;
}

export interface GroupedPermissionNode {
  module: string;
  children: RolePermissionSummary[];
}

export interface RoleResponse {
  id: string;
  roleName: string;
  roleCode: string;
  description: string | null;
  isSystem: boolean;
  permissionIds: string[];
  permissions: RolePermissionSummary[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleListResult {
  items: RoleResponse[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
  ) {}

  /**
   * 创建新的业务角色并保存其权限绑定关系。
   *
   * @param dto - 包含角色编码、名称和权限 ID 列表的创建参数
   * @returns 持久化后的角色响应对象
   * @throws {ConflictException} 角色编码已存在时抛出
   */
  async create(dto: CreateRoleDto): Promise<RoleResponse> {
    const existing = await this.roleRepo.findOne({
      where: { roleCode: dto.roleCode },
    });

    if (existing) {
      throw new ConflictException('このロールコードは既に使用されています');
    }

    const role = this.roleRepo.create({
      roleName: dto.roleName,
      roleCode: dto.roleCode,
      description: dto.description ?? null,
      isSystem: false,
    });

    if (dto.permissionIds?.length) {
      role.permissions = await this.permissionRepo.findBy({
        id: In(dto.permissionIds),
      });
    }

    const saved = await this.roleRepo.save(role);

    return this.toResponse(saved);
  }

  /**
   * 按分页、关键字和角色编码条件查询角色列表。
   *
   * @param query - 角色列表查询参数
   * @returns 包含角色数据和分页信息的结果对象
   */
  async findAll(query: QueryRoleDto): Promise<RoleListResult> {
    const {
      page = 1,
      pageSize = 20,
      keyword,
      roleCode,
      sortBy,
      sortOrder,
    } = query;

    const qb = this.roleRepo
      .createQueryBuilder('role')
      .leftJoinAndSelect('role.permissions', 'permission');

    if (keyword) {
      qb.andWhere('(role.roleName ILIKE :kw OR role.roleCode ILIKE :kw)', {
        kw: `%${keyword}%`,
      });
    }

    if (roleCode) {
      qb.andWhere('role.roleCode = :roleCode', { roleCode });
    }

    const orderField = sortBy ? `role.${sortBy}` : 'role.createdAt';
    qb.orderBy(orderField, sortOrder === 'ASC' ? 'ASC' : 'DESC');
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((role) => this.toResponse(role)),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 根据角色 ID 查询角色详情及其权限列表。
   *
   * @param id - 角色主键 UUID
   * @returns 对应角色的响应对象
   * @throws {NotFoundException} 角色不存在时抛出
   */
  async findOne(id: string): Promise<RoleResponse> {
    const role = await this.roleRepo.findOne({
      where: { id },
      relations: ['permissions'],
    });

    if (!role) {
      throw new NotFoundException('ロールが見つかりません');
    }

    return this.toResponse(role);
  }

  /**
   * 更新指定角色的基础信息和权限绑定关系。
   *
   * @param id - 待更新角色的 UUID
   * @param dto - 允许修改的角色字段
   * @returns 更新后的角色响应对象
   * @throws {NotFoundException} 角色不存在时抛出
   */
  async update(id: string, dto: UpdateRoleDto): Promise<RoleResponse> {
    const role = await this.roleRepo.findOne({
      where: { id },
      relations: ['permissions'],
    });

    if (!role) {
      throw new NotFoundException('ロールが見つかりません');
    }

    if (dto.roleName !== undefined) {
      role.roleName = dto.roleName;
    }

    if (dto.description !== undefined) {
      role.description = dto.description || null;
    }

    if (dto.permissionIds !== undefined) {
      role.permissions = dto.permissionIds.length
        ? await this.permissionRepo.findBy({ id: In(dto.permissionIds) })
        : [];
    }

    const saved = await this.roleRepo.save(role);

    return this.toResponse(saved);
  }

  /**
   * 删除指定的非系统内置角色。
   *
   * @param id - 待删除角色的 UUID
   * @throws {NotFoundException} 角色不存在时抛出
   * @throws {BadRequestException} 角色为系统内置角色时抛出
   */
  async remove(id: string): Promise<void> {
    const role = await this.roleRepo.findOne({ where: { id } });

    if (!role) {
      throw new NotFoundException('ロールが見つかりません');
    }

    if (role.isSystem) {
      throw new BadRequestException('システムロールは削除できません');
    }

    await this.roleRepo.remove(role);
  }

  /**
   * 读取全部权限并按模块聚合为树形节点。
   *
   * @returns 供角色授权界面直接消费的模块分组权限树
   */
  async getAllPermissionsGrouped(): Promise<GroupedPermissionNode[]> {
    const permissions = await this.permissionRepo.find({
      order: { module: 'ASC', sortOrder: 'ASC' },
    });

    const grouped: Record<string, GroupedPermissionNode> = {};

    for (const permission of permissions) {
      if (!grouped[permission.module]) {
        grouped[permission.module] = {
          module: permission.module,
          children: [],
        };
      }

      grouped[permission.module].children.push({
        id: permission.id,
        permissionCode: permission.permissionCode,
        permissionName: permission.permissionName,
        module: permission.module,
      });
    }

    return Object.values(grouped);
  }

  /**
   * 将角色实体裁剪为前端所需的稳定响应结构。
   *
   * @param role - 已加载权限关联的角色实体
   * @returns 角色详情和权限摘要对象
   */
  private toResponse(role: Role): RoleResponse {
    return {
      id: role.id,
      roleName: role.roleName,
      roleCode: role.roleCode,
      description: role.description,
      isSystem: role.isSystem,
      permissionIds: (role.permissions ?? []).map(
        (permission) => permission.id,
      ),
      permissions: (role.permissions ?? []).map((permission) => ({
        id: permission.id,
        permissionCode: permission.permissionCode,
        permissionName: permission.permissionName,
        module: permission.module,
      })),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }
}
