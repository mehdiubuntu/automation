import { DefaultNamingStrategy, NamingStrategyInterface, Table } from 'typeorm'

export class CustomNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
  private maxLength = 128

  private truncate(name: string): string {
    return name.length > this.maxLength ? name.substring(0, this.maxLength) : name
  }

  tableName(className: string, customName?: string): string {
    return customName ?? className
  }

  // columnName(
  //   propertyName: string,
  //   customName: string,
  //   embeddedPrefixes: string[],
  // ): string {
  //   return customName ?? propertyName;
  // }

  primaryKeyName(tableOrName: Table | string, columnNames: string[]): string {
    const columns = columnNames.join('_')
    return this.truncate(`PK_${typeof tableOrName === 'string' ? tableOrName : tableOrName.name}_${columns}`)
  }

  foreignKeyName(tableOrName: Table | string, columnNames: string[], _referencedTablePath?: string, _referencedColumnNames?: string[]): string {
    return this.truncate(`FK_${typeof tableOrName === 'string' ? tableOrName : tableOrName.name}_${_referencedTablePath}`)
  }

  indexName(tableOrName: Table | string, columnNames: string[], where?: string): string {
    const columns = columnNames.join('_')
    return this.truncate(`IX_${typeof tableOrName === 'string' ? tableOrName : tableOrName.name}_${columns}`)
  }

  // =======================
  // == UNIQUE CONSTRAINT ==
  // =======================
  uniqueConstraintName(tableOrName: Table | string, columnNames: string[]): string {
    const columns = columnNames.join('_')
    return this.truncate(`UX_${typeof tableOrName === 'string' ? tableOrName : tableOrName.name}_${columns}`)
  }

  checkConstraintName(tableOrName: Table | string, expression: string, isEnum?: boolean): string {
    return this.truncate(`CK_${typeof tableOrName === 'string' ? tableOrName : tableOrName.name}`)
  }

  defaultConstraintName(tableOrName: Table | string, columnName: string): string {
    return this.truncate(`DF_${typeof tableOrName === 'string' ? tableOrName : tableOrName.name}_${columnName}`)
  }

  joinTableName(firstTableName: string, secondTableName: string, firstPropertyName: string, secondPropertyName: string): string {
    return this.truncate(`${firstTableName}_${secondTableName}`)
  }

  joinColumnName(relationName: string, referencedColumnName: string): string {
    return this.truncate(`${relationName}_${referencedColumnName}`)
  }

  joinTableColumnName(tableName: string, propertyName: string, columnName?: string): string {
    return this.truncate(`${tableName}_${columnName ?? propertyName}`)
  }

  joinTableInverseColumnName(tableName: string, propertyName: string, columnName?: string): string {
    return this.truncate(`${tableName}_${columnName ?? propertyName}_inverse`)
  }
}
