import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { SystemController } from './system.controller'
import { DictionaryController } from './dictionary.controller'
import { UserController } from './user.controller'
import { RoleController } from './role.controller'
import { SystemService } from './system.service'
import { UserService } from './user.service'
import { RoleService } from './role.service'
import { User } from '../auth/entities/user.entity'
import { Role } from '../auth/entities/role.entity'
import { Permission } from '../auth/entities/permission.entity'

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
