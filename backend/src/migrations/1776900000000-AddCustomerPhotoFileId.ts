/**
 * 为 customers 表追加可选头像文件外键 `photo_file_id`，指向 `files` 并在删除文件时置空。
 */

import {
  type MigrationInterface,
  type QueryRunner,
  TableColumn,
  TableForeignKey,
} from 'typeorm';

/**
 * 执行 customers.photo_file_id 列与外键的创建与删除。
 */
export class AddCustomerPhotoFileId1776900000000 implements MigrationInterface {
  name = 'AddCustomerPhotoFileId1776900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'customers',
      new TableColumn({
        name: 'photo_file_id',
        type: 'uuid',
        isNullable: true,
      }),
    );

    await queryRunner.createForeignKey(
      'customers',
      new TableForeignKey({
        columnNames: ['photo_file_id'],
        referencedTableName: 'files',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        name: 'FK_customers_photo_file_id',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('customers', 'FK_customers_photo_file_id');
    await queryRunner.dropColumn('customers', 'photo_file_id');
  }
}
