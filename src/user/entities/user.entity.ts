import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Bill } from '../../bill/entities/bill.entity';
import { Category } from '../../category/entities/category.entity';
import { Reminder } from '../../reminder/entities/reminder.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Index()
  @Column({ length: 64, unique: true })
  openid: string;

  @Column({ length: 64, nullable: true })
  unionid?: string;

  @Column({ name: 'nickname', length: 50, default: '新用户' })
  nickname: string;

  @Column({ name: 'avatar_url', length: 255, default: '' })
  avatarUrl: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Bill, (bill) => bill.user)
  bills: Bill[];

  @OneToMany(() => Category, (category) => category.user)
  categories: Category[];

  @OneToMany(() => Reminder, (reminder) => reminder.user)
  reminders: Reminder[];
}
