import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { FileController } from './file.controller'
import { FileService } from './file.service'
import { FileEntity } from './entities/file.entity'
import { FileAccessLog } from './entities/file-access-log.entity'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([FileEntity, FileAccessLog]),
    AuthModule,
  ],
  controllers: [FileController],
  providers: [FileService],
  exports: [FileService, TypeOrmModule],
})
export class FileModule {}
