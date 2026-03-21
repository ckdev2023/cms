import { Controller } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { SystemService } from './system.service'

@ApiTags('システム設定')
@Controller('system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}
}
