import { HttpService } from '@nestjs/axios';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { firstValueFrom } from 'rxjs';
import { UserService } from '../user/user.service';

interface WechatSessionResponse {
  openid?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly httpService: HttpService,
    private readonly userService: UserService,
    private readonly config: ConfigService,
  ) {}

  async login(code: string) {
    const { data } = await firstValueFrom(
      this.httpService.get<WechatSessionResponse>(
        'https://api.weixin.qq.com/sns/jscode2session',
        {
          params: {
            appid: this.config.get<string>('wechat.appid'),
            secret: this.config.get<string>('wechat.secret'),
            js_code: code,
            grant_type: 'authorization_code',
          },
        },
      ),
    );

    if (data.errcode || !data.openid) {
      throw new UnauthorizedException(data.errmsg || '微信登录失败');
    }

    let user = await this.userService.findByOpenid(data.openid);
    if (!user) {
      user = await this.userService.create({
        openid: data.openid,
        unionid: data.unionid,
      });
    }

    return this.signUser(user.id, user.openid, {
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
    });
  }

  async refresh(token: string) {
    try {
      const payload = this.jwtService.verify<{ sub: string; openid: string }>(
        token,
        { ignoreExpiration: true },
      );
      const user = await this.userService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('用户不存在');
      }
      return this.signUser(user.id, user.openid, {
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
      });
    } catch {
      throw new UnauthorizedException('token 无效');
    }
  }

  private signUser(
    userId: string,
    openid: string,
    extra: { nickname: string; avatarUrl: string },
  ) {
    const token = this.jwtService.sign({ sub: userId, openid });
    return {
      token,
      userId,
      ...extra,
    };
  }
}
