import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, In, ILike } from 'typeorm'
import * as bcrypt from 'bcryptjs'
import { User } from '../auth/entities/user.entity'
import { Role } from '../auth/entities/role.entity'
import { CreateUserDto, UpdateUserDto, QueryUserDto } from './dto'
import { UserStatus } from '../../common/constants/enums'

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
  ) {}

  async create(dto: CreateUserDto) {
    const existing = await this.userRepo.findOne({
      where: { username: dto.username },
      withDeleted: true,
    })
    if (existing) {
      throw new ConflictException('このユーザー名は既に使用されています')
    }

    const passwordHash = await bcrypt.hash(dto.password, 10)

    const user = this.userRepo.create({
      username: dto.username,
      passwordHash,
      displayName: dto.displayName,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      status: UserStatus.ACTIVE,
    })

    if (dto.roleIds?.length) {
      user.roles = await this.roleRepo.findBy({ id: In(dto.roleIds) })
    }

    const saved = await this.userRepo.save(user)
    return this.toResponse(saved)
  }

  async findAll(query: QueryUserDto) {
    const { page = 1, pageSize = 20, keyword, status, roleCode, sortBy, sortOrder } = query

    const qb = this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'role')

    if (keyword) {
      qb.andWhere(
        '(user.username ILIKE :kw OR user.displayName ILIKE :kw OR user.email ILIKE :kw)',
        { kw: `%${keyword}%` },
      )
    }

    if (status) {
      qb.andWhere('user.status = :status', { status })
    }

    if (roleCode) {
      qb.andWhere('role.roleCode = :roleCode', { roleCode })
    }

    const orderField = sortBy ? `user.${sortBy}` : 'user.createdAt'
    qb.orderBy(orderField, sortOrder === 'ASC' ? 'ASC' : 'DESC')

    qb.skip((page - 1) * pageSize).take(pageSize)

    const [items, total] = await qb.getManyAndCount()
    return {
      items: items.map((u) => this.toResponse(u)),
      total,
      page,
      pageSize,
    }
  }

  async findOne(id: string) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['roles'],
    })
    if (!user) throw new NotFoundException('ユーザーが見つかりません')
    return this.toResponse(user)
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['roles'],
    })
    if (!user) throw new NotFoundException('ユーザーが見つかりません')

    if (dto.displayName !== undefined) user.displayName = dto.displayName
    if (dto.email !== undefined) user.email = dto.email || null
    if (dto.phone !== undefined) user.phone = dto.phone || null
    if (dto.status !== undefined) user.status = dto.status

    if (dto.roleIds !== undefined) {
      user.roles = dto.roleIds.length
        ? await this.roleRepo.findBy({ id: In(dto.roleIds) })
        : []
    }

    const saved = await this.userRepo.save(user)
    return this.toResponse(saved)
  }

  async resetPassword(id: string, newPassword?: string) {
    const user = await this.userRepo.findOne({ where: { id } })
    if (!user) throw new NotFoundException('ユーザーが見つかりません')

    const password = newPassword || 'password123'
    if (password.length < 6) {
      throw new BadRequestException('パスワードは6文字以上必要です')
    }

    user.passwordHash = await bcrypt.hash(password, 10)
    user.failedLoginCount = 0
    user.lockedUntil = null
    await this.userRepo.save(user)
  }

  async toggleStatus(id: string) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['roles'],
    })
    if (!user) throw new NotFoundException('ユーザーが見つかりません')

    user.status =
      user.status === UserStatus.ACTIVE
        ? UserStatus.INACTIVE
        : UserStatus.ACTIVE

    const saved = await this.userRepo.save(user)
    return this.toResponse(saved)
  }

  async remove(id: string) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['roles'],
    })
    if (!user) throw new NotFoundException('ユーザーが見つかりません')

    const isAdmin = user.roles?.some((r) => r.roleCode === 'ADMIN' && r.isSystem)
    if (isAdmin) {
      throw new BadRequestException('システム管理者は削除できません')
    }

    await this.userRepo.softRemove(user)
  }

  private toResponse(user: User) {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      phone: user.phone,
      status: user.status,
      roles: (user.roles ?? []).map((r) => ({
        id: r.id,
        roleName: r.roleName,
        roleCode: r.roleCode,
      })),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
  }
}
