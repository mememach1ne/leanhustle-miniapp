import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { StaffModule } from '../staff/staff.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TelegramAuthValidationService } from './services/telegram-auth-validation.service';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret:
          configService.get<string>('auth.jwtSecret') ??
          configService.get<string>('JWT_SECRET') ??
          process.env.JWT_SECRET ??
          '',
        signOptions: {
          expiresIn:
            (configService.get<string>('auth.jwtExpiresIn') ??
              configService.get<string>('JWT_EXPIRES_IN') ??
              process.env.JWT_EXPIRES_IN ??
              '1d') as never,
        },
      }),
    }),
    UsersModule,
    StaffModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, TelegramAuthValidationService, JwtAuthGuard],
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}
