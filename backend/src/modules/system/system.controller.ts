import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('システム設定')
@Controller('system')
export class SystemController {}
