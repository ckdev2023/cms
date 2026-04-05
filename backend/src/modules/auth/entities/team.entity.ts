import { Column, Entity, Index, JoinTable, ManyToMany } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from './user.entity';

/**
 * 映射签证域数据范围「团队」维度的可配置成员集合主表，供管理者维护团队名称与成员多对多绑定。
 */
@Entity('teams')
export class Team extends BaseEntity {
  @Index()
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @ManyToMany(() => User, (user) => user.teams, { eager: false })
  @JoinTable({
    name: 'team_users',
    joinColumn: { name: 'team_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' },
  })
  members: User[];
}
