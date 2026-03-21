import { Injectable, NotFoundException, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Note } from './entities/note.entity'
import { Customer } from './entities/customer.entity'
import { CreateNoteDto } from './dto/create-note.dto'
import { UpdateNoteDto } from './dto/update-note.dto'
import { QueryNoteDto } from './dto/query-note.dto'
import { NoteType } from '../../common/constants/enums'

@Injectable()
export class NoteService {
  private readonly logger = new Logger(NoteService.name)

  constructor(
    @InjectRepository(Note)
    private readonly noteRepo: Repository<Note>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
  ) {}

  async create(customerId: string, dto: CreateNoteDto, userId?: string): Promise<Note> {
    await this.ensureCustomerExists(customerId)

    const note = this.noteRepo.create({
      customerId,
      content: dto.content,
      noteType: dto.noteType ?? NoteType.GENERAL,
      createdBy: userId ?? null,
    })

    const saved = await this.noteRepo.save(note)
    this.logger.log(`Note created for customer ${customerId} by user ${userId}`)
    return this.findOne(customerId, saved.id)
  }

  async findAll(customerId: string, query: QueryNoteDto) {
    await this.ensureCustomerExists(customerId)

    const { page = 1, pageSize = 20, noteType, sortOrder = 'DESC' } = query

    const qb = this.noteRepo
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.creator', 'creator')
      .where('n.customerId = :customerId', { customerId })

    if (noteType) {
      qb.andWhere('n.noteType = :noteType', { noteType })
    }

    qb.orderBy('n.createdAt', sortOrder)
    qb.skip((page - 1) * pageSize).take(pageSize)

    const [items, total] = await qb.getManyAndCount()

    return {
      items: items.map((n) => this.toResponseDto(n)),
      total,
      page,
      pageSize,
    }
  }

  async findOne(customerId: string, noteId: string): Promise<Note> {
    const note = await this.noteRepo.findOne({
      where: { id: noteId, customerId },
      relations: ['creator'],
    })

    if (!note) {
      throw new NotFoundException('メモが見つかりません')
    }

    return note
  }

  async update(customerId: string, noteId: string, dto: UpdateNoteDto): Promise<Note> {
    const note = await this.findOne(customerId, noteId)

    if (dto.content !== undefined) note.content = dto.content
    if (dto.noteType !== undefined) note.noteType = dto.noteType

    await this.noteRepo.save(note)
    this.logger.log(`Note ${noteId} updated for customer ${customerId}`)
    return this.findOne(customerId, noteId)
  }

  async remove(customerId: string, noteId: string): Promise<void> {
    const note = await this.findOne(customerId, noteId)
    await this.noteRepo.softRemove(note)
    this.logger.log(`Note ${noteId} soft-deleted for customer ${customerId}`)
  }

  private async ensureCustomerExists(customerId: string): Promise<void> {
    const exists = await this.customerRepo.count({ where: { id: customerId } })
    if (!exists) {
      throw new NotFoundException('顧客が見つかりません')
    }
  }

  private toResponseDto(note: Note) {
    return {
      id: note.id,
      customerId: note.customerId,
      content: note.content,
      noteType: note.noteType,
      createdBy: note.createdBy,
      creatorName: note.creator?.displayName ?? null,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    }
  }
}
