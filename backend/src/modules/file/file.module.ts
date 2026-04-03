import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { FileEntity } from './entities/file.entity';
import { FileAccessLog } from './entities/file-access-log.entity';
import { FileController } from './file.controller';
import { FileService } from './file.service';

/**
 * 组装文件上传、查询和访问日志所需的控制器与持久化依赖。
 */
@Module({
  imports: [TypeOrmModule.forFeature([FileEntity, FileAccessLog]), AuthModule],
  controllers: [FileController],
  providers: [FileService],
  exports: [FileService, TypeOrmModule],
})
export class FileModule {}
