import { InternalServerErrorException } from '@jiaxinjiang/nest-exception';

export class RedisConnectRefusedException extends InternalServerErrorException {
  readonly code: number = 100201;
  readonly msg: string = 'Redis服务器拒绝连接';
}

export class RedisRetryTimeUsedException extends InternalServerErrorException {
  readonly code: number = 100202;
  readonly msg: string = 'Redis重试时间已用完';
}

export class RedisAttemptException extends InternalServerErrorException {
  readonly code: number = 100203;
  readonly msg: string = 'Redis尝试次数已达极限';
}

export class RedisClientNoReadyException extends InternalServerErrorException {
  readonly code: number = 100204;
  readonly msg: string = 'Redis客户端未连接';
}
