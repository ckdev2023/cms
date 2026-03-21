import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm'

function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase()
}

export class SnakeNamingStrategy
  extends DefaultNamingStrategy
  implements NamingStrategyInterface
{
  tableName(targetName: string, userSpecifiedName: string | undefined): string {
    return userSpecifiedName ?? toSnakeCase(targetName)
  }

  columnName(
    propertyName: string,
    customName: string | undefined,
    embeddedPrefixes: string[],
  ): string {
    const name = customName ?? toSnakeCase(propertyName)
    return embeddedPrefixes.length
      ? embeddedPrefixes.map((p) => toSnakeCase(p)).join('_') + '_' + name
      : name
  }

  relationName(propertyName: string): string {
    return toSnakeCase(propertyName)
  }

  joinColumnName(
    relationName: string,
    referencedColumnName: string,
  ): string {
    return toSnakeCase(`${relationName}_${referencedColumnName}`)
  }

  joinTableName(
    firstTableName: string,
    _secondTableName: string,
    firstPropertyName: string,
  ): string {
    return `${firstTableName}_${toSnakeCase(firstPropertyName)}`
  }

  joinTableColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return `${tableName}_${columnName ?? toSnakeCase(propertyName)}`
  }

  joinTableInverseColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return `${tableName}_${columnName ?? toSnakeCase(propertyName)}`
  }
}
