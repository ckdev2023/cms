import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import type { Request } from 'express'
import type { JwtPayload } from '../interfaces/jwt-payload.interface'

function extractFromQueryOrHeader(req: Request): string | null {
  const fromHeader = ExtractJwt.fromAuthHeaderAsBearerToken()(req)
  if (fromHeader) return fromHeader
  if (req.query?.token && typeof req.query.token === 'string') {
    return req.query.token
  }
  return null
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: extractFromQueryOrHeader,
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'default-secret'),
    })
  }

  validate(payload: JwtPayload) {
    return { id: payload.sub, username: payload.username }
  }
}
