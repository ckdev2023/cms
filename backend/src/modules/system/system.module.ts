import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Permission } from '../auth/entities/permission.entity';
import { Role } from '../auth/entities/role.entity';
import { User } from '../auth/entities/user.entity';
import { DictionaryController } from './dictionary.controller';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Permission])],
  controllers: [
    SystemController,
    DictionaryController,
    UserController,
    RoleController,
  ],
  providers: [SystemService, UserService, RoleService],
  exports: [SystemService, UserService, RoleService],
})
export class SystemModule {}
