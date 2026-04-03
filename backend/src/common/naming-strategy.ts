import type { NamingStrategyInterface } from 'typeorm';
import { DefaultNamingStrategy } from 'typeorm';

/**
 * 将 TypeScript / ORM 中的驼峰命名统一转换为数据库使用的下划线命名。
 *
 * @param str - 来自实体名、属性名或关联名的原始标识符
 * @returns 适用于 PostgreSQL 表名和列名的 snake_case 字符串
 */
function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

/**
 * 为 TypeORM 生成统一的 snake_case 数据库对象名称。
 *
 * 该策略覆盖表名、列名、中间表和关联字段，避免实体层命名风格泄漏到数据库 schema。
 */
export class SnakeNamingStrategy
  extends DefaultNamingStrategy
  implements NamingStrategyInterface
{
  /**
   * 生成实体对应的物理表名，优先保留显式声明的表名。
   *
   * @param targetName - 实体类名或默认推导出的表名
   * @param userSpecifiedName - `@Entity()` 中手动指定的表名；未指定时为 `undefined`
   * @returns 优先返回用户声明的表名，否则回退为 snake_case 的实体名
   */
  tableName(targetName: string, userSpecifiedName: string | undefined): string {
    return userSpecifiedName ?? toSnakeCase(targetName);
  }

  /**
   * 生成普通列或嵌入对象列的数据库字段名。
   *
   * @param propertyName - 实体属性名
   * @param customName - `@Column()` 中显式指定的列名；未指定时为 `undefined`
   * @param embeddedPrefixes - 嵌入对象展开后的前缀路径列表
   * @returns 带嵌入前缀的最终列名；无嵌入前缀时仅返回属性列名
   */
  columnName(
    propertyName: string,
    customName: string | undefined,
    embeddedPrefixes: string[],
  ): string {
    const name = customName ?? toSnakeCase(propertyName);
    const embeddedPrefix = this.buildEmbeddedPrefix(embeddedPrefixes);

    return embeddedPrefix ? `${embeddedPrefix}_${name}` : name;
  }

  /**
   * 生成关联属性在数据库中的默认名称。
   *
   * @param propertyName - 实体上的关联属性名
   * @returns 转换为 snake_case 的关联名
   */
  relationName(propertyName: string): string {
    return toSnakeCase(propertyName);
  }

  /**
   * 生成外键列名，保持“关联名 + 引用列名”的稳定命名结构。
   *
   * @param relationName - 关联属性名
   * @param referencedColumnName - 目标实体被引用的列名
   * @returns 形如 `customer_id` 的外键列名
   */
  joinColumnName(relationName: string, referencedColumnName: string): string {
    return toSnakeCase(`${relationName}_${referencedColumnName}`);
  }

  /**
   * 生成多对多关联中间表的表名。
   *
   * @param firstTableName - 当前侧实体的物理表名
   * @param _secondTableName - 另一侧实体的物理表名；当前策略未使用，以下划线前缀避免未使用告警
   * @param firstPropertyName - 当前侧实体上的关联属性名
   * @returns 以当前表名和关联属性名拼接出的中间表名
   */
  joinTableName(
    firstTableName: string,
    _secondTableName: string,
    firstPropertyName: string,
  ): string {
    return `${firstTableName}_${toSnakeCase(firstPropertyName)}`;
  }

  /**
   * 生成中间表中指向当前实体的关联列名。
   *
   * @param tableName - 当前实体对应的物理表名
   * @param propertyName - 当前实体上的关联属性名
   * @param columnName - 显式指定的关联列名；未指定时回退到属性名
   * @returns 以表名为前缀的中间表关联列名
   */
  joinTableColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return this.buildJoinTableColumnName(tableName, propertyName, columnName);
  }

  /**
   * 生成中间表中指向关联端实体的反向列名。
   *
   * @param tableName - 关联端实体对应的物理表名
   * @param propertyName - 关联端实体上的属性名
   * @param columnName - 显式指定的关联列名；未指定时回退到属性名
   * @returns 以关联端表名为前缀的中间表反向列名
   */
  joinTableInverseColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return this.buildJoinTableColumnName(tableName, propertyName, columnName);
  }

  /**
   * 将嵌入对象的前缀路径折叠为单个 snake_case 前缀片段。
   *
   * @param embeddedPrefixes - TypeORM 提供的嵌入对象前缀数组
   * @returns 用下划线拼接后的前缀；无前缀时返回空字符串
   */
  private buildEmbeddedPrefix(embeddedPrefixes: string[]): string {
    return embeddedPrefixes.map((prefix) => toSnakeCase(prefix)).join('_');
  }

  /**
   * 为多对多中间表生成统一的“表名 + 列名”字段名。
   *
   * @param tableName - 中间表列所归属实体的物理表名
   * @param propertyName - 默认回退使用的实体属性名
   * @param columnName - 显式配置的关联列名；省略时回退到属性名
   * @returns 拼接后的中间表列名
   */
  private buildJoinTableColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return `${tableName}_${columnName ?? toSnakeCase(propertyName)}`;
  }
}
