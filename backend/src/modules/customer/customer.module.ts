import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { FileEntity } from '../file/entities/file.entity';
import { VisaCaseModule } from '../visa-case/visa-case.module';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { CustomerCodeService } from './customer-code.service';
import { CustomerListPrimaryVisaCaseService } from './customer-list-primary-visa-case.service';
import { CustomerProfileService } from './customer-profile.service';
import { CustomerVisaDerivedRiskService } from './customer-visa-derived-risk.service';
import { CompanyInfo } from './entities/company-info.entity';
import { Customer } from './entities/customer.entity';
import { CustomerStaffRelation } from './entities/customer-staff-relation.entity';
import { Note } from './entities/note.entity';
import { PersonInfo } from './entities/person-info.entity';
import { NoteController } from './note.controller';
import { NoteService } from './note.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Customer,
      CompanyInfo,
      PersonInfo,
      CustomerStaffRelation,
      Note,
      FileEntity,
    ]),
    AuthModule,
    VisaCaseModule,
  ],
  controllers: [CustomerController, NoteController],
  providers: [
    CustomerCodeService,
    CustomerProfileService,
    CustomerVisaDerivedRiskService,
    CustomerListPrimaryVisaCaseService,
    CustomerService,
    NoteService,
  ],
  exports: [CustomerService, NoteService, TypeOrmModule],
})
export class CustomerModule {}
