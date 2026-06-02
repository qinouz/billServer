import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Bill } from '../../bill/entities/bill.entity';
import { User } from '../../user/entities/user.entity';

export enum BillType {
  Income = 'income',
  Expense = 'expense',
}

@Entity('categories')
@Index('idx_user_type', ['userId', 'type'])
export class Category {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'user_id', type: 'bigint', nullable: true })
  userId?: string | null;

  @Column({ length: 50 })
  name: string;

  @Column({ length: 50, default: '' })
  icon: string;

  @Column({ type: 'enum', enum: BillType })
  type: BillType;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_system', default: false })
  isSystem: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.categories, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  @OneToMany(() => Bill, (bill) => bill.category)
  bills: Bill[];
}
