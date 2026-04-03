import { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';
import { DataSource, type DataSourceOptions } from 'typeorm';

import { SnakeNamingStrategy } from './common/naming-strategy';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

interface DatabaseRuntimeConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  synchronize: boolean;
  logging: boolean;
  migrationsRun: boolean;
  ssl?: {
    rejectUnauthorized: false;
  };
}

interface DataSourceOverrides {
  entities?: string[];
  logging?: boolean;
  migrations?: string[];
  migrationsRun?: boolean;
  namingStrategy?: SnakeNamingStrategy;
  ssl?: {
    rejectUnauthorized: false;
  };
  synchronize?: boolean;
}

/**
 * 将环境变量中的布尔配置统一解析为显式布尔值。
 *
 * @param value - 来自环境变量或 ConfigService 的原始值
 * @param fallback - 未提供配置时使用的默认值
 * @returns 规范化后的布尔结果
 */
function toBoolean(
  value: boolean | string | undefined,
  fallback: boolean,
): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value === 'true';
  }

  return fallback;
}

/**
 * 将环境变量中的端口配置解析为数字，异常时回退默认值。
 *
 * @param value - 来自环境变量或 ConfigService 的原始端口值
 * @param fallback - 端口缺失或非法时使用的默认值
 * @returns 可安全传给 TypeORM 的数字端口
 */
function toNumber(
  value: number | string | undefined,
  fallback: number,
): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsedValue = Number.parseInt(value, 10);
    return Number.isNaN(parsedValue) ? fallback : parsedValue;
  }

  return fallback;
}

/**
 * 汇总数据库连接所需的运行时配置，供 Nest 启动和 CLI 脚本复用。
 *
 * @param values - 来自环境变量或 ConfigService 的原始数据库配置集合
 * @returns 已补齐默认值和生产环境 SSL 配置的数据库运行时参数
 */
function buildDatabaseRuntimeConfig(values: {
  nodeEnv?: string;
  host?: string;
  port?: number | string;
  username?: string;
  password?: string;
  database?: string;
  synchronize?: boolean | string;
  logging?: boolean | string;
  migrationsRun?: boolean | string;
}): DatabaseRuntimeConfig {
  const isProduction = values.nodeEnv === 'production';

  return {
    host: values.host ?? 'localhost',
    port: toNumber(values.port, 5432),
    username: values.username ?? 'postgres',
    password: values.password ?? 'postgres',
    database: values.database ?? 'jimusho_cms',
    synchronize: toBoolean(values.synchronize, false),
    logging: toBoolean(values.logging, !isProduction),
    migrationsRun: toBoolean(values.migrationsRun, false),
    ...(isProduction && { ssl: { rejectUnauthorized: false as const } }),
  };
}

/**
 * 为 NestJS 运行时构造 TypeORM 模块配置。
 *
 * @param configService - 用于读取环境变量的 Nest 配置服务
 * @returns 适用于 `TypeOrmModule.forRootAsync` 的连接配置
 */
export function createTypeOrmModuleOptions(
  configService: ConfigService,
): TypeOrmModuleOptions {
  const runtimeConfig = buildDatabaseRuntimeConfig({
    nodeEnv: configService.get<string>('NODE_ENV'),
    host: configService.get<string>('DB_HOST'),
    port: configService.get<number>('DB_PORT'),
    username: configService.get<string>('DB_USERNAME'),
    password: configService.get<string>('DB_PASSWORD'),
    database: configService.get<string>('DB_DATABASE'),
    synchronize: configService.get<string>('DB_SYNCHRONIZE'),
    logging: configService.get<string>('DB_LOGGING'),
    migrationsRun: configService.get<string>('DB_MIGRATIONS_RUN'),
  });

  return {
    type: 'postgres',
    ...runtimeConfig,
    autoLoadEntities: true,
    migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
    namingStrategy: new SnakeNamingStrategy(),
  };
}

/**
 * 为 TypeORM CLI 和种子脚本构造数据源配置。
 *
 * @param env - 当前进程可见的环境变量集合
 * @returns 适用于 `new DataSource()` 的配置对象
 */
export function createDataSourceOptions(
  env: NodeJS.ProcessEnv = process.env,
  overrides: DataSourceOverrides = {},
): DataSourceOptions {
  const runtimeConfig = buildDatabaseRuntimeConfig({
    nodeEnv: env.NODE_ENV,
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
    synchronize: env.DB_SYNCHRONIZE,
    logging: env.DB_LOGGING,
    migrationsRun: env.DB_MIGRATIONS_RUN,
  });

  return {
    type: 'postgres',
    ...runtimeConfig,
    entities: ['src/**/*.entity.ts'],
    migrations: ['src/migrations/*.ts'],
    namingStrategy: new SnakeNamingStrategy(),
    ...overrides,
  };
}

/**
 * 创建供脚本或工具显式初始化的数据源实例。
 *
 * @param env - 当前脚本使用的环境变量集合
 * @returns 尚未初始化的 TypeORM 数据源
 */
export function createAppDataSource(
  env: NodeJS.ProcessEnv = process.env,
  overrides: DataSourceOverrides = {},
): DataSource {
  return new DataSource(createDataSourceOptions(env, overrides));
}

const appDataSource = createAppDataSource();

export default appDataSource;
