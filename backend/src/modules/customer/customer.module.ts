import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CustomerController } from './customer.controller'
import { CustomerService } from './customer.service'
import { NoteController } from './note.controller'
import { NoteService } from './note.service'
import { Customer } from './entities/customer.entity'
import { CompanyInfo } from './entities/company-info.entity'
import { PersonInfo } from './entities/person-info.entity'
import { CustomerStaffRelation } from './entities/customer-staff-relation.entity'
import { Note } from './entities/note.entity'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Customer,
      CompanyInfo,
      PersonInfo,
      CustomerStaffRelation,
      Note,
    ]),
    AuthModule,
  ],
  controllers: [CustomerController, NoteController],
  providers: [CustomerService, NoteService],
  exports: [CustomerService, NoteService, TypeOrmModule],
})
export class CustomerModule {}
