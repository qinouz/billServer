import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('reminders')
@Unique('uk_user', ['userId'])
export class Reminder {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'user_id', type: 'bigint' })
  userId: string;

  @Column({ name: 'reminder_time', type: 'time' })
  reminderTime: string;

  @Column({ name: 'is_enabled', default: true })
  isEnabled: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.reminders)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
