import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, In } from 'typeorm'
import { Role } from '../auth/entities/role.entity'
import { Permission } from '../auth/entities/permission.entity'
import { CreateRoleDto, UpdateRoleDto, QueryRoleDto } from './dto'

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
  ) {}

  async create(dto: CreateRoleDto) {
    const existing = await this.roleRepo.findOne({
      where: { roleCode: dto.roleCode },
    })
    if (existing) {
      throw new ConflictException('このロールコードは既に使用されています')
    }

    const role = this.roleRepo.create({
      roleName: dto.roleName,
      roleCode: dto.roleCode,
      description: dto.description ?? null,
      isSystem: false,
    })

    if (dto.permissionIds?.length) {
      role.permissions = await this.permissionRepo.findBy({
        id: In(dto.permissionIds),
      })
    }

    const saved = await this.roleRepo.save(role)
    return this.toResponse(saved)
  }

  async findAll(query: QueryRoleDto) {
    const { page = 1, pageSize = 20, keyword, roleCode, sortBy, sortOrder } = query

    const qb = this.roleRepo
      .createQueryBuilder('role')
      .leftJoinAndSelect('role.permissions', 'permission')

    if (keyword) {
      qb.andWhere(
        '(role.roleName ILIKE :kw OR role.roleCode ILIKE :kw)',
        { kw: `%${keyword}%` },
      )
    }

    if (roleCode) {
      qb.andWhere('role.roleCode = :roleCode', { roleCode })
    }

    const orderField = sortBy ? `role.${sortBy}` : 'role.createdAt'
    qb.orderBy(orderField, sortOrder === 'ASC' ? 'ASC' : 'DESC')

    qb.skip((page - 1) * pageSize).take(pageSize)

    const [items, total] = await qb.getManyAndCount()
    return {
      items: items.map((r) => this.toResponse(r)),
      total,
      page,
      pageSize,
    }
  }

  async findOne(id: string) {
    const role = await this.roleRepo.findOne({
      where: { id },
      relations: ['permissions'],
    })
    if (!role) throw new NotFoundException('ロールが見つかりません')
    return this.toResponse(role)
  }

  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.roleRepo.findOne({
      where: { id },
      relations: ['permissions'],
    })
    if (!role) throw new NotFoundException('ロールが見つかりません')

    if (dto.roleName !== undefined) role.roleName = dto.roleName
    if (dto.description !== undefined) role.description = dto.description || null

    if (dto.permissionIds !== undefined) {
      role.permissions = dto.permissionIds.length
        ? await this.permissionRepo.findBy({ id: In(dto.permissionIds) })
        : []
    }

    const saved = await this.roleRepo.save(role)
    return this.toResponse(saved)
  }

  async remove(id: string) {
    const role = await this.roleRepo.findOne({ where: { id } })
    if (!role) throw new NotFoundException('ロールが見つかりません')

    if (role.isSystem) {
      throw new BadRequestException('システムロールは削除できません')
    }

    await this.roleRepo.remove(role)
  }

  async getAllPermissionsGrouped() {
    const permissions = await this.permissionRepo.find({
      order: { module: 'ASC', sortOrder: 'ASC' },
    })

    const grouped: Record<
      string,
      { module: string; children: Array<{ id: string; permissionCode: string; permissionName: string }> }
    > = {}

    for (const p of permissions) {
      if (!grouped[p.module]) {
        grouped[p.module] = { module: p.module, children: [] }
      }
      grouped[p.module].children.push({
        id: p.id,
        permissionCode: p.permissionCode,
        permissionName: p.permissionName,
      })
    }

    return Object.values(grouped)
  }

  private toResponse(role: Role) {
    return {
      id: role.id,
      roleName: role.roleName,
      roleCode: role.roleCode,
      description: role.description,
      isSystem: role.isSystem,
      permissionIds: (role.permissions ?? []).map((p) => p.id),
      permissions: (role.permissions ?? []).map((p) => ({
        id: p.id,
        permissionCode: p.permissionCode,
        permissionName: p.permissionName,
        module: p.module,
      })),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    }
  }
}
