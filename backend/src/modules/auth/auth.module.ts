import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { StringValue } from 'ms';

import { LoginLog } from '../log/entities/login-log.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';
import { User } from './entities/user.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionGuard } from './guards/permission.guard';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role, Permission, LoginLog]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const jwtExpiresIn = (config.get<string>('JWT_EXPIRES_IN') ??
          '8h') as StringValue;

        return {
          secret: config.get<string>('JWT_SECRET', 'default-secret'),
          signOptions: {
            expiresIn: jwtExpiresIn,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    LocalStrategy,
    JwtAuthGuard,
    PermissionGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
  exports: [AuthService, TypeOrmModule],
})
export class AuthModule {}
