import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BillType, Category } from '../../category/entities/category.entity';
import { User } from '../../user/entities/user.entity';

@Entity('bills')
@Index('idx_user_date', ['userId', 'billDate'])
@Index('idx_user_deleted', ['userId', 'isDeleted'])
export class Bill {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'user_id', type: 'bigint' })
  userId: string;

  @Column({ name: 'category_id', type: 'bigint' })
  categoryId: string;

  @Column({ name: 'amount_cents', type: 'bigint' })
  amountCents: string;

  @Column({ type: 'enum', enum: BillType })
  type: BillType;

  @Column({ length: 200, default: '' })
  remark: string;

  @Column({ name: 'bill_date', type: 'date' })
  billDate: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'is_deleted', default: false })
  isDeleted: boolean;

  @ManyToOne(() => User, (user) => user.bills)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Category, (category) => category.bills)
  @JoinColumn({ name: 'category_id' })
  category: Category;
}
